// Seeded mock data for the entire portal. Keep shapes stable so a real backend
// can be swapped in by replacing this module without touching presentation code.

export type ID = string;

export type LeadStatus = "new" | "contacted" | "qualified" | "prospect" | "customer" | "lost";
export type QuoteStatus = "pending" | "approved" | "rejected" | "changes_requested";
export type CustomerStatus = "submitted" | "review" | "approved" | "rejected";
export type CarrierStatus = "pending" | "approved" | "rejected";
export type LoadStatus =
  | "quoted"
  | "approved"
  | "booked"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "pod_received"
  | "invoiced"
  | "paid"
  | "commission_ready";
export type CommissionStatus = "locked" | "pending" | "paid";
export type ApprovalKind =
  "customer" | "credit" | "quote" | "carrier" | "load" | "user_access" | "commission";

export type AgentLite = { id: ID; name: string; team: string; commissionPct: number };

export const teams = ["Alpha", "Bravo", "Charlie", "Delta"];

export const agents: AgentLite[] = [
  { id: "a1", name: "Dana Jenkins", team: "Alpha", commissionPct: 70 },
  { id: "a2", name: "Marcus Reed", team: "Alpha", commissionPct: 65 },
  { id: "a3", name: "Priya Shah", team: "Bravo", commissionPct: 65 },
  { id: "a4", name: "Liam Chen", team: "Bravo", commissionPct: 60 },
  { id: "a5", name: "Sofia Alvarez", team: "Charlie", commissionPct: 70 },
  { id: "a6", name: "Noah Brooks", team: "Charlie", commissionPct: 60 },
  { id: "a7", name: "Ava Patel", team: "Delta", commissionPct: 65 },
  { id: "a8", name: "Ethan Wood", team: "Delta", commissionPct: 60 },
];

export type User = {
  id: ID;
  name: string;
  email: string;
  role:
    | "admin"
    | "ghost"
    | "ops_manager"
    | "team_manager"
    | "leadagent"
    | "agent"
    | "trainee"
    | "accounting"
    | "suspended";
  team: string;
  status: "active" | "suspended";
  lastLogin: string;
  commissionPct: number;
};

export const users: User[] = [
  {
    id: "u1",
    name: "Dana Jenkins",
    email: "dana@djfreight.com",
    role: "admin",
    team: "Alpha",
    status: "active",
    lastLogin: daysAgo(0.1),
    commissionPct: 70,
  },
  {
    id: "u2",
    name: "Marcus Reed",
    email: "marcus@djfreight.com",
    role: "ops_manager",
    team: "Alpha",
    status: "active",
    lastLogin: daysAgo(0.4),
    commissionPct: 65,
  },
  {
    id: "u3",
    name: "Priya Shah",
    email: "priya@djfreight.com",
    role: "team_manager",
    team: "Bravo",
    status: "active",
    lastLogin: daysAgo(1),
    commissionPct: 65,
  },
  {
    id: "u4",
    name: "Liam Chen",
    email: "liam@djfreight.com",
    role: "agent",
    team: "Bravo",
    status: "active",
    lastLogin: daysAgo(0.2),
    commissionPct: 60,
  },
  {
    id: "u5",
    name: "Sofia Alvarez",
    email: "sofia@djfreight.com",
    role: "agent",
    team: "Charlie",
    status: "active",
    lastLogin: daysAgo(2),
    commissionPct: 70,
  },
  {
    id: "u6",
    name: "Noah Brooks",
    email: "noah@djfreight.com",
    role: "trainee",
    team: "Charlie",
    status: "active",
    lastLogin: daysAgo(0.8),
    commissionPct: 0,
  },
  {
    id: "u7",
    name: "Ava Patel",
    email: "ava@djfreight.com",
    role: "agent",
    team: "Delta",
    status: "active",
    lastLogin: daysAgo(3),
    commissionPct: 65,
  },
  {
    id: "u8",
    name: "Ethan Wood",
    email: "ethan@djfreight.com",
    role: "agent",
    team: "Delta",
    status: "suspended",
    lastLogin: daysAgo(40),
    commissionPct: 60,
  },
  {
    id: "u9",
    name: "Hannah Lee",
    email: "hannah@djfreight.com",
    role: "accounting",
    team: "Ops",
    status: "active",
    lastLogin: daysAgo(0.3),
    commissionPct: 0,
  },
  {
    id: "u10",
    name: "Owen Park",
    email: "owen@djfreight.com",
    role: "agent",
    team: "Alpha",
    status: "active",
    lastLogin: daysAgo(0.6),
    commissionPct: 60,
  },
  {
    id: "u11",
    name: "Isabella Cruz",
    email: "isabella@djfreight.com",
    role: "agent",
    team: "Bravo",
    status: "active",
    lastLogin: daysAgo(1.2),
    commissionPct: 65,
  },
  {
    id: "u12",
    name: "Jack Morgan",
    email: "jack@djfreight.com",
    role: "team_manager",
    team: "Delta",
    status: "active",
    lastLogin: daysAgo(0.5),
    commissionPct: 65,
  },
  {
    id: "u13",
    name: "Mia Thompson",
    email: "mia@djfreight.com",
    role: "trainee",
    team: "Alpha",
    status: "active",
    lastLogin: daysAgo(4),
    commissionPct: 0,
  },
  {
    id: "u14",
    name: "Carlos Rivera",
    email: "carlos@djfreight.com",
    role: "agent",
    team: "Charlie",
    status: "active",
    lastLogin: daysAgo(0.9),
    commissionPct: 60,
  },
  {
    id: "u15",
    name: "Zoe Kim",
    email: "zoe@djfreight.com",
    role: "agent",
    team: "Delta",
    status: "active",
    lastLogin: daysAgo(2.5),
    commissionPct: 65,
  },
];

export type Lead = {
  id: ID;
  company: string;
  contact: string;
  email: string;
  phone: string;
  status: LeadStatus;
  agentId: ID;
  lastActivity: string;
  notes: string;
  shippingNotes: string;
  activities: Activity[];
};

export type Activity = {
  id: ID;
  kind: "call" | "note" | "followup" | "task";
  body: string;
  by: string;
  at: string;
};

const companies = [
  "Nordic Steel Co.",
  "Sunbelt Produce",
  "Atlas Aerospace",
  "Cascade Brewing",
  "Midwest Lumber",
  "Pacific Polymers",
  "Granite Construction",
  "Lone Star Foods",
  "Evergreen Paper",
  "Ironclad Fasteners",
  "Bluebird Logistics",
  "Summit Apparel",
  "Verde Organics",
  "Harbor Chemicals",
  "Forge Metals",
  "Kestrel Electronics",
  "Riverside Beverages",
  "Copperline Cables",
  "Anvil Tooling",
  "Tundra Cold Storage",
  "Magnolia Textiles",
  "Obsidian Glass",
  "Helix Pharma",
  "Brightwater Bottling",
];

const contacts = [
  "John Garcia",
  "Emily Wright",
  "Daniel Cho",
  "Olivia Bennett",
  "Ryan Murphy",
  "Hailey Singh",
  "Trevor Adams",
  "Maya Robinson",
];
const cities = [
  "Dallas, TX",
  "Atlanta, GA",
  "Chicago, IL",
  "Long Beach, CA",
  "Newark, NJ",
  "Phoenix, AZ",
  "Denver, CO",
  "Memphis, TN",
  "Charlotte, NC",
  "Seattle, WA",
  "Houston, TX",
  "Miami, FL",
];
const equipment = ["Dry Van", "Reefer", "Flatbed", "Step Deck", "Power Only"];
const commodities = [
  "Palletized Goods",
  "Frozen Foods",
  "Steel Coils",
  "Lumber",
  "Electronics",
  "Auto Parts",
  "Beverages",
  "Apparel",
];

const leadStatuses: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "prospect",
  "customer",
  "lost",
];

export const leads: Lead[] = companies.map((company, i) => ({
  id: `l${i + 1}`,
  company,
  contact: pick(contacts, i),
  email: `${company.split(" ")[0].toLowerCase()}@example.com`,
  phone: `(${300 + i}) ${100 + i}-${1000 + i * 7}`,
  status: leadStatuses[i % leadStatuses.length],
  agentId: agents[i % agents.length].id,
  lastActivity: daysAgo((i * 1.7) % 30),
  notes: "Interested in weekly Dallas → Atlanta lanes, dry van.",
  shippingNotes: "Prefers AM pickups. Lift gate required at delivery.",
  activities: [
    {
      id: `act-${i}-1`,
      kind: "call",
      body: "Intro call — discussed lane needs.",
      by: agents[i % agents.length].name,
      at: daysAgo(i * 1.7),
    },
    {
      id: `act-${i}-2`,
      kind: "note",
      body: "Sent rate sheet for Q1 lanes.",
      by: agents[i % agents.length].name,
      at: daysAgo(i * 1.7 + 1),
    },
    {
      id: `act-${i}-3`,
      kind: "followup",
      body: "Follow up next Tuesday after weekly meeting.",
      by: agents[i % agents.length].name,
      at: daysAgo(i * 1.7 + 2),
    },
  ],
}));

export type Customer = {
  id: ID;
  company: string;
  contact: string;
  email: string;
  phone: string;
  creditLimit: number;
  creditStatus: "pending" | "approved" | "rejected";
  status: CustomerStatus;
  agentId: ID;
  createdAt: string;
};

export const customers: Customer[] = companies.slice(0, 18).map((company, i) => ({
  id: `c${i + 1}`,
  company,
  contact: pick(contacts, i),
  email: `ap@${company.split(" ")[0].toLowerCase()}.com`,
  phone: `(${400 + i}) ${200 + i}-${2000 + i * 3}`,
  creditLimit: [25000, 50000, 75000, 100000, 150000][i % 5],
  creditStatus: (["approved", "approved", "pending", "approved", "rejected", "pending"] as const)[
    i % 6
  ],
  status: (["approved", "approved", "review", "approved", "submitted", "rejected"] as const)[i % 6],
  agentId: agents[i % agents.length].id,
  createdAt: daysAgo(30 + i * 2),
}));

export type Quote = {
  id: ID;
  customerId: ID;
  origin: string;
  destination: string;
  equipment: string;
  commodity: string;
  weight: number;
  pickupDate: string;
  customerRate: number;
  carrierEstimate: number;
  status: QuoteStatus;
  agentId: ID;
  notes: string;
  createdAt: string;
  comments: { by: string; at: string; body: string }[];
};

export const quotes: Quote[] = Array.from({ length: 22 }, (_, i) => {
  const cr = 1800 + ((i * 137) % 4500);
  return {
    id: `q${i + 1}`,
    customerId: customers[i % customers.length].id,
    origin: cities[i % cities.length],
    destination: cities[(i + 3) % cities.length],
    equipment: equipment[i % equipment.length],
    commodity: commodities[i % commodities.length],
    weight: 8000 + ((i * 1200) % 30000),
    pickupDate: daysAhead(i % 14),
    customerRate: cr,
    carrierEstimate: Math.round(cr * 0.78),
    status: (
      [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
        "approved",
        "pending",
      ] as QuoteStatus[]
    )[i % 6],
    agentId: agents[i % agents.length].id,
    notes: "Customer requested expedited transit.",
    createdAt: daysAgo(i),
    comments:
      i % 3 === 0
        ? [
            {
              by: "Dana Jenkins",
              at: daysAgo(i - 0.5),
              body: "Margin too tight — bump customer rate by $150.",
            },
          ]
        : [],
  };
});

export type Carrier = {
  id: ID;
  name: string;
  mc: string;
  dot: string;
  contact: string;
  phone: string;
  status: CarrierStatus;
  vetting: {
    authority: boolean;
    insurance: boolean;
    safety: boolean;
    fraud: boolean;
    compliance: boolean;
  };
  createdAt: string;
};

const carrierNames = [
  "Redline Trucking",
  "Coastline Carriers",
  "Mountain Haul",
  "Plains Express",
  "Skyway Freight",
  "Eagle Logistics",
  "Diamond Drayage",
  "Heartland Transport",
  "Pacific Pathways",
  "Northern Star Express",
  "Ironhorse Freight",
  "Silver Spoke",
  "Crossroads Carriers",
  "Riverbend Trucking",
  "Summit Transport",
  "Vanguard Lines",
  "Beacon Freight Co.",
  "Cedar Valley Transport",
  "Granite Peak Logistics",
  "Black Bear Trucking",
];

export const carriers: Carrier[] = carrierNames.map((name, i) => {
  const allGood = i % 4 !== 2 && i % 7 !== 3;
  return {
    id: `cr${i + 1}`,
    name,
    mc: `MC-${100000 + i * 137}`,
    dot: `DOT-${2000000 + i * 311}`,
    contact: pick(contacts, i + 1),
    phone: `(${500 + i}) ${300 + i}-${3000 + i * 5}`,
    status: allGood ? (i % 5 === 0 ? "pending" : "approved") : "rejected",
    vetting: {
      authority: true,
      insurance: i % 6 !== 5,
      safety: i % 7 !== 3,
      fraud: i % 8 !== 4,
      compliance: i % 5 !== 4,
    },
    createdAt: daysAgo(40 + i),
  };
});

export type LoadDoc = {
  kind: "rate_con" | "bol" | "pod" | "invoice" | "cust_doc" | "carrier_doc";
  uploaded: boolean;
  uploadedAt?: string;
};

export type Load = {
  id: ID;
  ref: string;
  customerId: ID;
  carrierId: ID;
  agentId: ID;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  customerRate: number;
  carrierPay: number;
  status: LoadStatus;
  equipment: string;
  weight: number;
  history: { status: LoadStatus; at: string }[];
  docs: LoadDoc[];
};

const loadStatuses: LoadStatus[] = [
  "quoted",
  "approved",
  "booked",
  "picked_up",
  "in_transit",
  "delivered",
  "pod_received",
  "invoiced",
  "paid",
  "commission_ready",
];

export const loads: Load[] = Array.from({ length: 30 }, (_, i) => {
  const cr = 2200 + ((i * 263) % 5400);
  const cp = Math.round(cr * (0.72 + (i % 7) * 0.01));
  const status = loadStatuses[i % loadStatuses.length];
  return {
    id: `ld${i + 1}`,
    ref: `DJF-${10240 + i}`,
    customerId: customers[i % customers.length].id,
    carrierId: carriers[i % carriers.length].id,
    agentId: agents[i % agents.length].id,
    origin: cities[i % cities.length],
    destination: cities[(i + 4) % cities.length],
    pickupDate: daysAgo(10 - (i % 10)),
    deliveryDate: daysAgo(5 - (i % 5)),
    customerRate: cr,
    carrierPay: cp,
    status,
    equipment: equipment[i % equipment.length],
    weight: 9000 + ((i * 950) % 32000),
    history: loadStatuses.slice(0, (i % loadStatuses.length) + 1).map((s, j) => ({
      status: s,
      at: daysAgo(12 - j),
    })),
    docs: [
      { kind: "rate_con", uploaded: true, uploadedAt: daysAgo(10) },
      { kind: "bol", uploaded: i % 3 !== 0, uploadedAt: daysAgo(8) },
      {
        kind: "pod",
        uploaded: ["delivered", "pod_received", "invoiced", "paid", "commission_ready"].includes(
          status,
        ),
        uploadedAt: daysAgo(4),
      },
      {
        kind: "invoice",
        uploaded: ["invoiced", "paid", "commission_ready"].includes(status),
        uploadedAt: daysAgo(3),
      },
      { kind: "cust_doc", uploaded: i % 4 !== 0 },
      { kind: "carrier_doc", uploaded: i % 5 !== 0 },
    ],
  };
});

export type CommissionRecord = {
  id: ID;
  loadId: ID;
  agentId: ID;
  grossMargin: number;
  pct: number;
  amount: number;
  status: CommissionStatus;
  payDate?: string;
};

export const commissions: CommissionRecord[] = loads.map((l, i) => {
  const margin = l.customerRate - l.carrierPay;
  const agent = agents.find((a) => a.id === l.agentId)!;
  const amount = Math.round(margin * (agent.commissionPct / 100));
  const status: CommissionStatus =
    l.status === "paid" ? "paid" : l.status === "commission_ready" ? "pending" : "locked";
  return {
    id: `cm${i + 1}`,
    loadId: l.id,
    agentId: l.agentId,
    grossMargin: margin,
    pct: agent.commissionPct,
    amount,
    status: i % 5 === 0 ? "paid" : status,
    payDate: i % 5 === 0 ? daysAgo(i) : undefined,
  };
});

export type DocItem = {
  id: ID;
  name: string;
  category: "Training" | "SOP" | "Forms" | "Contracts" | "Policies" | "Templates";
  size: string;
  version: string;
  updatedAt: string;
  access: ("admin" | "manager" | "agent")[];
};

export const docLibrary: DocItem[] = [
  {
    id: "d1",
    name: "Agent Onboarding Handbook.pdf",
    category: "Training",
    size: "2.4 MB",
    version: "v3.1",
    updatedAt: daysAgo(10),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d2",
    name: "Quote Approval SOP.pdf",
    category: "SOP",
    size: "640 KB",
    version: "v1.4",
    updatedAt: daysAgo(20),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d3",
    name: "Carrier Packet Template.docx",
    category: "Templates",
    size: "180 KB",
    version: "v2.0",
    updatedAt: daysAgo(5),
    access: ["admin", "manager"],
  },
  {
    id: "d4",
    name: "MSA — Standard Customer.pdf",
    category: "Contracts",
    size: "320 KB",
    version: "v4.2",
    updatedAt: daysAgo(45),
    access: ["admin", "manager"],
  },
  {
    id: "d5",
    name: "Anti-Fraud Policy.pdf",
    category: "Policies",
    size: "210 KB",
    version: "v1.0",
    updatedAt: daysAgo(60),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d6",
    name: "W9 Form.pdf",
    category: "Forms",
    size: "120 KB",
    version: "v1.0",
    updatedAt: daysAgo(90),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d7",
    name: "Cold-Call Script.pdf",
    category: "Training",
    size: "90 KB",
    version: "v2.1",
    updatedAt: daysAgo(15),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d8",
    name: "Detention Claim Template.xlsx",
    category: "Templates",
    size: "75 KB",
    version: "v1.2",
    updatedAt: daysAgo(8),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d9",
    name: "Carrier Agreement.pdf",
    category: "Contracts",
    size: "410 KB",
    version: "v3.0",
    updatedAt: daysAgo(70),
    access: ["admin", "manager"],
  },
  {
    id: "d10",
    name: "Data Retention Policy.pdf",
    category: "Policies",
    size: "140 KB",
    version: "v1.1",
    updatedAt: daysAgo(100),
    access: ["admin", "manager"],
  },
  {
    id: "d11",
    name: "Booking Workflow SOP.pdf",
    category: "SOP",
    size: "780 KB",
    version: "v2.3",
    updatedAt: daysAgo(25),
    access: ["admin", "manager", "agent"],
  },
  {
    id: "d12",
    name: "Daily Activity Log Template.xlsx",
    category: "Templates",
    size: "60 KB",
    version: "v1.0",
    updatedAt: daysAgo(35),
    access: ["admin", "manager", "agent"],
  },
];

export type OnboardingDoc = {
  id: ID;
  type: "W9" | "W8BEN" | "Agreement" | "Tax Form" | "ID" | "Other";
  status: "missing" | "submitted" | "approved" | "rejected";
  uploadedAt?: string;
};

export const onboardingDocs: OnboardingDoc[] = [
  { id: "o1", type: "W9", status: "approved", uploadedAt: daysAgo(120) },
  { id: "o2", type: "Agreement", status: "approved", uploadedAt: daysAgo(120) },
  { id: "o3", type: "ID", status: "submitted", uploadedAt: daysAgo(3) },
  { id: "o4", type: "Tax Form", status: "missing" },
  { id: "o5", type: "Other", status: "rejected", uploadedAt: daysAgo(7) },
];

export type Approval = {
  id: ID;
  kind: ApprovalKind;
  title: string;
  requestedBy: string;
  at: string;
  refId: ID;
};

export const approvals: Approval[] = [
  ...customers
    .filter((c) => c.status === "submitted" || c.status === "review")
    .slice(0, 4)
    .map((c, i) => ({
      id: `ap-c-${i}`,
      kind: "customer" as const,
      title: `Onboard ${c.company}`,
      requestedBy: agents.find((a) => a.id === c.agentId)!.name,
      at: daysAgo(i + 1),
      refId: c.id,
    })),
  ...quotes
    .filter((q) => q.status === "pending" || q.status === "changes_requested")
    .slice(0, 5)
    .map((q, i) => ({
      id: `ap-q-${i}`,
      kind: "quote" as const,
      title: `Quote ${q.id.toUpperCase()} — ${q.origin} → ${q.destination}`,
      requestedBy: agents.find((a) => a.id === q.agentId)!.name,
      at: daysAgo(i * 0.5),
      refId: q.id,
    })),
  ...carriers
    .filter((c) => c.status === "pending")
    .slice(0, 3)
    .map((c, i) => ({
      id: `ap-cr-${i}`,
      kind: "carrier" as const,
      title: `Vet carrier ${c.name}`,
      requestedBy: "System",
      at: daysAgo(i + 0.3),
      refId: c.id,
    })),
  {
    id: "ap-l-1",
    kind: "load",
    title: `Book load ${loads[0].ref}`,
    requestedBy: agents[0].name,
    at: daysAgo(0.2),
    refId: loads[0].id,
  },
  {
    id: "ap-u-1",
    kind: "user_access",
    title: "Promote Liam Chen to team manager",
    requestedBy: "Priya Shah",
    at: daysAgo(2),
    refId: "u4",
  },
  {
    id: "ap-cm-1",
    kind: "commission",
    title: "Release commission run — Mar wk 3",
    requestedBy: "Hannah Lee",
    at: daysAgo(0.6),
    refId: "cm-run-3",
  },
];

export type Notif = {
  id: ID;
  kind:
    | "lead"
    | "quote"
    | "approval"
    | "rejection"
    | "change_req"
    | "missing_docs"
    | "followup"
    | "kpi";
  title: string;
  body: string;
  at: string;
  read: boolean;
};

export const notifications: Notif[] = [
  {
    id: "n1",
    kind: "approval",
    title: "Quote approved",
    body: "Q3 — Dallas → Atlanta approved by Dana.",
    at: daysAgo(0.05),
    read: false,
  },
  {
    id: "n2",
    kind: "lead",
    title: "New lead assigned",
    body: "Bluebird Logistics assigned to you.",
    at: daysAgo(0.3),
    read: false,
  },
  {
    id: "n3",
    kind: "missing_docs",
    title: "Missing POD",
    body: "Load DFR-10248 missing POD upload.",
    at: daysAgo(1),
    read: false,
  },
  {
    id: "n4",
    kind: "change_req",
    title: "Changes requested",
    body: "Quote Q12 needs rate revision.",
    at: daysAgo(1.4),
    read: true,
  },
  {
    id: "n5",
    kind: "followup",
    title: "Follow-up reminder",
    body: "Call Sunbelt Produce at 2pm.",
    at: daysAgo(0.1),
    read: false,
  },
  {
    id: "n6",
    kind: "kpi",
    title: "Weekly KPI summary ready",
    body: "Gross margin up 8% WoW.",
    at: daysAgo(2),
    read: true,
  },
  {
    id: "n7",
    kind: "rejection",
    title: "Carrier rejected",
    body: "Eagle Logistics failed insurance check.",
    at: daysAgo(3),
    read: true,
  },
];

export type AuditEvent = {
  id: ID;
  at: string;
  user: string;
  action: string;
  target: string;
  ip: string;
};

const actions = [
  "login",
  "logout",
  "upload",
  "download",
  "create",
  "edit",
  "delete",
  "approval",
  "role_change",
  "password_reset",
];
export const auditEvents: AuditEvent[] = Array.from({ length: 40 }, (_, i) => ({
  id: `au${i}`,
  at: daysAgo(i * 0.3),
  user: users[i % users.length].name,
  action: actions[i % actions.length],
  target:
    i % 3 === 0
      ? `Load ${loads[i % loads.length].ref}`
      : i % 3 === 1
        ? `Quote q${(i % 20) + 1}`
        : `User ${users[i % users.length].email}`,
  ip: `10.0.${(i * 7) % 250}.${(i * 13) % 250}`,
}));

export type DailyLog = {
  id: ID;
  date: string;
  calls: number;
  followups: number;
  notes: string;
  checkedIn?: string;
  checkedOut?: string;
};

export const dailyLogs: DailyLog[] = Array.from({ length: 14 }, (_, i) => ({
  id: `dl${i}`,
  date: daysAgo(i).slice(0, 10),
  calls: 8 + ((i * 3) % 14),
  followups: 4 + ((i * 2) % 9),
  notes: "Worked Dallas lane prospecting, sent 3 quote follow-ups.",
  checkedIn: `${8 + (i % 2)}:${i % 2 ? "15" : "00"} AM`,
  checkedOut: `${5 + (i % 3)}:${i % 2 ? "30" : "45"} PM`,
}));

// helpers
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}
function daysAhead(d: number): string {
  return new Date(Date.now() + d * 86400000).toISOString();
}
function pick<T>(arr: T[], i: number): T {
  return arr[Math.abs(i) % arr.length];
}

export function getAgentName(id: ID): string {
  return agents.find((a) => a.id === id)?.name ?? "—";
}
export function getCustomerName(id: ID): string {
  return customers.find((c) => c.id === id)?.company ?? "—";
}
export function getCarrierName(id: ID): string {
  return carriers.find((c) => c.id === id)?.name ?? "—";
}
