import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mongoUri =
  process.env.MONGO_URI ||
  "mongodb://djs-portal:djsport%40ltex%40s@ac-05gm0cw-shard-00-00.5odo9dw.mongodb.net:27017,ac-05gm0cw-shard-00-01.5odo9dw.mongodb.net:27017,ac-05gm0cw-shard-00-02.5odo9dw.mongodb.net:27017/?ssl=true&replicaSet=atlas-u9n2kr-shard-0&authSource=admin&appName=djs-tms";
const dbName = process.env.MONGO_DB_NAME || "freight-agent-portal";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,
    role: String,
    status: String,
    teamId: mongoose.Schema.Types.ObjectId,
    lastLoginAt: Date,
    createdAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const teamSchema = new mongoose.Schema(
  {
    name: String,
    managerId: mongoose.Schema.Types.ObjectId,
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const leadSchema = new mongoose.Schema(
  {
    ownerId: mongoose.Schema.Types.ObjectId,
    companyName: String,
    contactName: String,
    contactPhone: String,
    contactEmail: String,
    location: String,
    laneOrNeed: String,
    status: String,
    creditStatus: String,
    notes: [{ authorId: mongoose.Schema.Types.ObjectId, text: String, createdAt: Date }],
  },
  { timestamps: true },
);

const quoteRequestSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    lane: { origin: String, destination: String },
    equipmentType: String,
    commodity: String,
    customerRate: Number,
    carrierCost: Number,
    marginAmount: Number,
    marginPercent: Number,
    notes: String,
    status: String,
    reviewedBy: mongoose.Schema.Types.ObjectId,
    reviewNotes: String,
    reviewedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const dailyActivityLogSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    date: String,
    checkedInAt: String,
    checkedOutAt: String,
    calls: Number,
    followups: Number,
    notes: String,
  },
  { timestamps: true },
);

const onboardingRequirementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true },
    required: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const customerSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    companyName: String,
    contactName: String,
    contactPhone: String,
    contactEmail: String,
    creditLimit: Number,
    creditStatus: String,
    status: String,
    notes: String,
    shippingNotes: String,
  },
  { timestamps: true },
);

const loadStatusHistorySchema = new mongoose.Schema(
  {
    status: String,
    changedBy: mongoose.Schema.Types.ObjectId,
    changedAt: Date,
  },
  { _id: false },
);

const loadSchema = new mongoose.Schema(
  {
    quoteRequestId: mongoose.Schema.Types.ObjectId,
    agentId: mongoose.Schema.Types.ObjectId,
    carrierId: mongoose.Schema.Types.ObjectId,
    customerName: String,
    lane: String,
    status: String,
    statusHistory: { type: [loadStatusHistorySchema], default: [] },
    grossMargin: Number,
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
  },
  { timestamps: true },
);

const commissionSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    loadId: mongoose.Schema.Types.ObjectId,
    grossMarginAmount: Number,
    commissionTier: String,
    commissionPercent: Number,
    commissionAmount: Number,
    payoutStatus: String,
    payoutDate: Date,
    month: Number,
    year: Number,
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Team = mongoose.models.Team || mongoose.model("Team", teamSchema);
const Lead = mongoose.models.Lead || mongoose.model("Lead", leadSchema);
const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
const QuoteRequest =
  mongoose.models.QuoteRequest || mongoose.model("QuoteRequest", quoteRequestSchema);
const DailyActivityLog =
  mongoose.models.DailyActivityLog || mongoose.model("DailyActivityLog", dailyActivityLogSchema);
const Load = mongoose.models.Load || mongoose.model("Load", loadSchema);
const Commission = mongoose.models.Commission || mongoose.model("Commission", commissionSchema);
const OnboardingRequirement =
  mongoose.models.OnboardingRequirement ||
  mongoose.model("OnboardingRequirement", onboardingRequirementSchema);
//commented strings here
async function seed() {
  //     console.log("MONGO_URI:", process.env.MONGO_URI);
  // console.log("Using URI:", mongoUri);
  await mongoose.connect(mongoUri, { dbName });
  console.log(`Connected to ${dbName}`);

  await Promise.all([
    User.deleteMany({}),
    Team.deleteMany({}),
    Lead.deleteMany({}),
    Customer.deleteMany({}),
    QuoteRequest.deleteMany({}),
    DailyActivityLog.deleteMany({}),
    Load.deleteMany({}),
    Commission.deleteMany({}),
    OnboardingRequirement.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("Welcome2026!A1", 12);

  await OnboardingRequirement.create([
    {
      key: "w9",
      label: "W-9",
      description: "Federal tax form",
      required: true,
      active: true,
      displayOrder: 1,
    },
    {
      key: "agreement",
      label: "Agreement",
      description: "Signed onboarding agreement",
      required: true,
      active: true,
      displayOrder: 2,
    },
    {
      key: "id",
      label: "Government ID",
      description: "Photo ID",
      required: true,
      active: true,
      displayOrder: 3,
    },
    {
      key: "tax_form",
      label: "Tax Form",
      description: "Additional tax documentation",
      required: true,
      active: true,
      displayOrder: 4,
    },
    {
      key: "other",
      label: "Other",
      description: "Any additional supporting document",
      required: false,
      active: true,
      displayOrder: 5,
    },
  ]);

  const roleSeeds = [
    {
      name: "Danny Eden",
      email: "danny@djfreight.com",
      role: "admin",
      status: "active",
      password: "Danny@2026!Q7x",
    },
    {
      name: "Danny Eden 2",
      email: "danny2@djsfreightbroker.com",
      role: "admin",
      status: "active",
      password: "Danny@2026!Q7x",
    },
    {
      name: "Billy Smith",
      email: "billy@djsfreightbroker.com",
      role: "ops_manager",
      status: "active",
      password: "Billy@2026!M9p",
    },
    {
      name: "Joshua Harrison",
      email: "joshua@djsfreightbroker.com",
      role: "ops_manager",
      status: "active",
      password: "Joshua@2026!L2m",
    },
    {
      name: "Emily Canrobert",
      email: "emily.canrobert@djsfreightbroker.com",
      role: "ops_manager",
      status: "active",
      password: "Emily@2026!R4t",
    },
    {
      name: "Gray Miller",
      email: "gray.miller@djsfreightbroker.com",
      role: "ops_manager",
      status: "active",
      password: "Gray@2026!K8n",
    },
    {
      name: "Team Manager One",
      email: "teammanager.one@djfreight.com",
      role: "team_manager",
      status: "active",
      password: "Welcome2026!A1",
    },
    {
      name: "Lead Agent One",
      email: "leadagent.one@djfreight.com",
      role: "leadagent",
      status: "active",
      password: "Welcome2026!A1",
    },
    {
      name: "Agent One",
      email: "agent.one@djfreight.com",
      role: "agent",
      status: "active",
      password: "Welcome2026!A1",
    },
    {
      name: "Trainee One",
      email: "trainee.one@djfreight.com",
      role: "trainee",
      status: "trainee",
      password: "Welcome2026!A1",
    },
    {
      name: "Accounting One",
      email: "accounting.one@djfreight.com",
      role: "accounting",
      status: "active",
      password: "Welcome2026!A1",
    },
    {
      name: "Suspended One",
      email: "suspended.one@djfreight.com",
      role: "suspended",
      status: "inactive",
      password: "Welcome2026!A1",
    },
  ];

  const seededUsers = await Promise.all(
    roleSeeds.map(async ({ name, email, role, status, password }) => {
      const passwordHash = await bcrypt.hash(password, 12);
      return User.create({
        name,
        email,
        password: passwordHash,
        role,
        status,
      });
    }),
  );

  const admin = seededUsers.find((user) => user.email === "danny@djfreight.com");
  const opsManager = seededUsers.find((user) => user.name === "Billy Smith");
  const agent = seededUsers.find((user) => user.email === "agent.one@djfreight.com");
  const trainee = seededUsers.find((user) => user.email === "trainee.one@djfreight.com");

  if (!admin || !opsManager || !agent || !trainee) {
    throw new Error("Required seeded users were not created successfully.");
  }

  const team = await Team.create({
    name: "Alpha Team",
    managerId: admin._id,
    memberIds: [admin._id, opsManager._id, trainee._id],
  });

  await Lead.create([
    {
      ownerId: admin._id,
      companyName: "Nordic Steel Co.",
      contactName: "John Garcia",
      contactPhone: "(214) 555-0100",
      contactEmail: "john@nordicsteel.com",
      location: "Dallas, TX",
      laneOrNeed: "Dallas to Atlanta dry van",
      status: "new",
      creditStatus: "approved",
      notes: [{ authorId: admin._id, text: "Interested in weekly lanes.", createdAt: new Date() }],
    },
    {
      ownerId: agent._id,
      companyName: "Sunbelt Produce",
      contactName: "Emily Wright",
      contactPhone: "(404) 555-0199",
      contactEmail: "emily@sunbeltproduce.com",
      location: "Atlanta, GA",
      laneOrNeed: "Reefer freight for produce",
      status: "warm",
      creditStatus: "pending",
      notes: [
        { authorId: agent._id, text: "Follow up after pricing sheet.", createdAt: new Date() },
      ],
    },
  ]);

  await Customer.create([
    {
      agentId: admin._id,
      companyName: "Northwind Logistics",
      contactName: "Alicia Brooks",
      contactPhone: "(214) 555-0123",
      contactEmail: "alicia@northwind.com",
      creditLimit: 75000,
      creditStatus: "approved",
      status: "approved",
      notes: "Weekly dry van lanes from Dallas to Atlanta.",
      shippingNotes: "Prefers AM pickups.",
    },
    {
      agentId: agent._id,
      companyName: "Blue Harbor Foods",
      contactName: "Marcus Chen",
      contactPhone: "(404) 555-0144",
      contactEmail: "marcus@blueharbor.com",
      creditLimit: 50000,
      creditStatus: "pending",
      status: "review",
      notes: "Needs reefer coverage for produce.",
      shippingNotes: "Requires temperature monitoring.",
    },
  ]);

  await QuoteRequest.create({
    agentId: agent._id,
    lane: { origin: "Dallas, TX", destination: "Chicago, IL" },
    equipmentType: "Dry Van",
    commodity: "Palletized Goods",
    customerRate: 2200,
    carrierCost: 1700,
    marginAmount: 500,
    marginPercent: 22.73,
    notes: "Customer requested expedited transit.",
    status: "pending_approval",
  });

  const loadA = await Load.create({
    quoteRequestId: new mongoose.Types.ObjectId(),
    agentId: agent._id,
    carrierId: new mongoose.Types.ObjectId(),
    customerName: "Northwind Logistics",
    lane: "Dallas, TX to Atlanta, GA",
    status: "commission_ready",
    grossMargin: 800,
    statusHistory: [{ status: "commission_ready", changedBy: agent._id, changedAt: new Date() }],
    documentIds: [],
  });

  const loadB = await Load.create({
    quoteRequestId: new mongoose.Types.ObjectId(),
    agentId: agent._id,
    carrierId: new mongoose.Types.ObjectId(),
    customerName: "Blue Harbor Foods",
    lane: "Atlanta, GA to Chicago, IL",
    status: "commission_ready",
    grossMargin: 1200,
    statusHistory: [{ status: "commission_ready", changedBy: agent._id, changedAt: new Date() }],
    documentIds: [],
  });

  await Commission.create([
    {
      agentId: agent._id,
      loadId: loadA._id,
      grossMarginAmount: 800,
      commissionTier: "Standard",
      commissionPercent: 10,
      commissionAmount: 80,
      payoutStatus: "pending",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
    {
      agentId: agent._id,
      loadId: loadB._id,
      grossMarginAmount: 1200,
      commissionTier: "Premium",
      commissionPercent: 12,
      commissionAmount: 144,
      payoutStatus: "processing",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    },
  ]);

  await DailyActivityLog.create([
    {
      userId: admin._id,
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      checkedInAt: "08:00 AM",
      checkedOutAt: "05:15 PM",
      calls: 8,
      followups: 4,
      notes: "Followed up with Dallas prospects and uploaded documents.",
    },
    {
      userId: admin._id,
      date: new Date().toISOString().slice(0, 10),
      checkedInAt: "09:30 AM",
      checkedOutAt: "06:00 PM",
      calls: 6,
      followups: 3,
      notes: "Reviewed carrier rate sheets and cleared backlog.",
    },
  ]);

  console.log("Seed complete");
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
