# Data Cleanup Feature

## Overview
This feature automatically manages old data to keep the database clean and improve application performance. Three types of data are cleaned up:

1. **Read Notifications** - Deleted 24 hours after being marked as read
2. **Unread Notifications** - Deleted after 2 weeks if not read
3. **Session/Login Logs** - Deleted after 2 months

## How It Works

### Notifications

#### 1. Read Notification Cleanup
When a notification is marked as read, a `readAt` timestamp is recorded in the database. This allows the system to track exactly when the notification was read.

#### 2. Unread Notification Cleanup
Unread notifications are tracked by their `createdAt` timestamp. Notifications unread for more than 2 weeks are automatically deleted.

#### 3. Auto-Deletion Criteria
Notifications are deleted if:
- **Read notifications**: `isRead: true` AND `readAt < 24 hours ago`
- **Unread notifications**: `isRead: false` AND `createdAt < 2 weeks ago`

#### 4. Session/Login Log Cleanup

## Implementation Details

### Schema Changes
Added `readAt` field to the Notification model:
```typescript
readAt?: Date; // Timestamp when notification was marked as read
```

### API Endpoints

#### 1. Mark Notification as Read (Existing)
**POST** `/api/notifications`
```json
{
  "action": "mark_read",
  "id": "notification-id" // or omit to mark all as read
}
```

When marked as read, the `readAt` timestamp is automatically set to the current time.

#### 2. Manual Cleanup (Admin Only)
**POST** `/api/admin/cleanup`

Manually trigger cleanup of notifications older than 24 hours. Requires admin or owner role.

Response:
```json
{
  "ok": true,
  "message": "Cleanup complete. Deleted X old read notifications.",
  "deletedCount": 42,
  "timestamp": "2026-07-21T10:30:00Z"
}
```

#### 3. Per-User Cleanup (Optional)
**POST** `/api/notifications`
```json
{
  "action": "cleanup_old"
}
```

Triggers cleanup for all notifications in the system (not just the current user). Returns count of deleted notifications.

## Setting Up Scheduled Cleanup

To automatically run cleanup on a schedule, you have several options:

### Option 1: Cron Job (Recommended)
Add a cron job to run the cleanup endpoint periodically:

```bash
# Every 6 hours
0 */6 * * * curl -X POST https://your-domain/api/admin/cleanup \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Option 2: Application Startup
Add cleanup to your application initialization in `src/start.ts`:

```typescript
import { cleanupOldReadNotifications } from "./lib/notification";

// Run cleanup on startup
await cleanupOldReadNotifications();

// Then run periodically (e.g., every 6 hours)
setInterval(() => {
  cleanupOldReadNotifications().catch(err => 
    console.error("Scheduled cleanup failed:", err)
  );
}, 6 * 60 * 60 * 1000);
```

### Option 3: Worker/Background Job
Use a background job queue (Bull, RabbitMQ, etc.) to schedule cleanup:

```typescript
// In your job processor
import { cleanupOldReadNotifications } from "./lib/notification";

jobQueue.add("cleanup-old-notifications", {}, {
  repeat: {
    every: 6 * 60 * 60 * 1000, // 6 hours
  },
});

jobQueue.process("cleanup-old-notifications", async () => {
  return await cleanupOldReadNotifications();
});
```

### Option 4: AWS Lambda / Cloud Functions
Create a scheduled function:

```typescript
import { connectDb } from "./lib/db";
import { cleanupOldReadNotifications } from "./lib/notification";

export async function handler(event: any) {
  await connectDb();
  const result = await cleanupOldReadNotifications();
  return {
    statusCode: 200,
    body: JSON.stringify(result),
  };
}
```

## Monitoring

### Check Database Sizes
Monitor your collections:

```bash
# MongoDB
# Notifications collection
db.notifications.countDocuments()
db.notifications.countDocuments({ isRead: true })
db.notifications.countDocuments({ isRead: false })
db.notifications.countDocuments({ readAt: { $exists: true } })

# LoginHistory collection
db.loginhistories.countDocuments()
```

### Cleanup Logs

Cleanup operations are logged to the console with detailed information:
```
[notification] Cleanup complete: deleted X old read notifications and Y old unread notifications (total: Z)
[session-log] Cleanup complete: deleted X old session logs
```

## Customizing Cleanup Periods

To change the cleanup periods, edit `src/lib/notification.ts`:

### Notification Cleanup Periods
```typescript
// cleanupOldNotifications() function:
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

// Examples:
// 48 hours: new Date(Date.now() - 48 * 60 * 60 * 1000)
// 1 week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
// 1 month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
```

### Session Log Cleanup Period
```typescript
// cleanupOldSessionLogs() function:
const twoMonthsAgo = new Date();
twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

// Examples:
// 1 month: twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 1)
// 3 months: twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 3)
// 6 months: twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 6)
Indexes are created for efficient cleanup queries:

**Notifications:**
- `readAt` index for finding read notifications older than 24 hours
- `isRead, createdAt` compound index for finding unread notifications

**LoginHistory:**
- `createdAt` index for efficiently finding old session logs
readAt: { type: Date, required: false, index: true }
```

This ensures the cleanup query `{ isRead: true, readAt: { $lt: twentyFourHoursAgo } }` performs efficiently.

## Performance Considerations

- **Cleanup runs fast**: With proper indexing, cleanup deletes thousands of records in seconds
- **Off-peak scheduling**: Run cleanup during low-traffic hours
- **Batch deletion**: Cleanup uses `deleteMany` for atomic, efficient deletion
- **No impact on unread**: Unread notifications are never affected

## Troubleshooting
`/api/admin/cleanup` endpoint requires admin-level access.

### Notifications Not Being Deleted
Check that:
- `readAt` timestamp is being set for read notifications: `db.notifications.findOne({ isRead: true })` should show `readAt` field
- `createdAt` exists for unread notifications
- Verify cleanup is being called (check logs for `[notification] Cleanup complete`)
- Ensure appropriate time has passed (24+ hours for read, 2+ weeks for unread)

### Session Logs Not Being Deleted
Check that:
- LoginHistory records have `createdAt` timestamp
- At least 2 months have passed since creation
- Run manual cleanup and check results
Migration Notes for Existing Installations

### Notifications
1. Existing read notifications will not have a `readAt` timestamp
2. These notifications will not be deleted until marked as read again
3. Optionally, backfill `readAt` for existing read notifications:

```javascript
// MongoDB shell
db.notifications.updateMany(
  { isRead: true, readAt: { $exists: false } },
  { $set: { readAt: new Date() } }
);
```

### Session/Login History
- Existing records will be cleaned up based on their `createdAt` timestamp
- Records older than 2 months will be eligible for cleanup immediately
// MongoDB shell
db.notifications.updateMany(
  { isRead: true, readAt: { $exists: false } },
  { $set: { readAt: new Date() } }
);
```

Then they would be eligible for deletion 24 hours from the migration date.
