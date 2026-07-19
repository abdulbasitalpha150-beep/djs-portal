import { connectDb } from "../../lib/db";
import { getSessionUserFromRequest, requireRole } from "../../lib/auth";
import { errorResponse, jsonResponse, parseJson, parseZod } from "../../lib/api";
import { User } from "../../models/user";
import { emitSystemAlert, type SenderContext } from "../../lib/notification";
import mongoose from "mongoose";
import { z } from "zod";

const resetSystemSchema = z.object({
  password: z.string().min(1),
  confirmation: z.string().refine((value) => value === "RESET", {
    message: "Type RESET to confirm",
  }),
});

export async function resetSystemHandler(request: Request) {
  const user = await getSessionUserFromRequest(request);
  const sessionUser = requireRole(user, ["admin"]);
  const body = await parseJson(request);
  const payload = parseZod(resetSystemSchema, body);

  await connectDb();

  const adminUser = await User.findById(sessionUser.id).exec();
  if (!adminUser) {
    return errorResponse("Admin user not found", 404);
  }

  const validPassword = await adminUser.comparePassword(payload.password);
  if (!validPassword) {
    return errorResponse("Incorrect password", 401);
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database unavailable");
  }

  const collections = await db.listCollections().toArray();
  for (const collection of collections) {
    if (collection.name === "users") continue;
    await db.collection(collection.name).deleteMany({});
  }

  // Emit system alert after reset
  void emitSystemAlert(
    {
      title: "System reset performed",
      message: `Admin ${sessionUser.name} performed a full system reset. All data except user accounts has been deleted.`,
      priority: "critical",
      metadata: { adminId: sessionUser.id, adminName: sessionUser.name },
    },
    {
      userId: sessionUser.id,
      name: sessionUser.name,
      role: sessionUser.role,
      teamId: sessionUser.teamId,
    } as SenderContext,
  );

  return jsonResponse({ message: "System reset complete" });
}
