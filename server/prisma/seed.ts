import { getPrisma } from "../src/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = getPrisma();
  console.log("Starting idempotent database seeding...");

  // 1. Seed Categories
  const categories = [
    { name: "Account and Access", description: "Login issues, password resets, role permissions, and access grants" },
    { name: "Hardware", description: "Laptops, monitors, printers, docking stations, and peripherals" },
    { name: "Software", description: "Application crashes, license activation, installation, and updates" },
    { name: "Network", description: "Wi-Fi connectivity, VPN issues, DNS problems, and slow speed" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: { name: cat.name, description: cat.description },
    });
  }
  console.log("Categories seeded successfully.");

  // 2. Seed Related Systems
  const relatedSystems = [
    { name: "Email", code: "SYS-EMAIL", description: "University email and calendar services" },
    { name: "Campus Wi-Fi", code: "SYS-WIFI", description: "On-campus wireless network infrastructure" },
    { name: "VPN", code: "SYS-VPN", description: "Virtual Private Network secure remote access" },
    { name: "LEB2 App", code: "SYS-LEB2", description: "Learning Environment Building 2 platform" },
    { name: "Grade Submission App", code: "SYS-GRADES", description: "Academic grade submission portal" },
    { name: "Printer", code: "SYS-PRINT", description: "Campus network printers and print servers" },
  ];

  for (const sys of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { code: sys.code },
      update: { name: sys.name, description: sys.description },
      create: { name: sys.name, code: sys.code, description: sys.description },
    });
  }
  console.log("Related Systems seeded successfully.");

  // Standard bcrypt hashed password for test accounts: "Password123!"
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  // 3. Seed Users (Requesters, IT Staff, Administrators)
  // Requirements:
  // - At least 4 active Requesters, 1 inactive Requester
  // - At least 3 active IT Staff, 1 inactive IT Staff
  // - At least 1 active Administrator account
  const usersToSeed = [
    // --- Requesters (4 active, 1 inactive) ---
    {
      email: "jennifer.anderson@kmutt.ac.th",
      fullName: "Jennifer Anderson",
      role: "REQUESTER" as const,
      department: "Computer Engineering",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "david.lee@kmutt.ac.th",
      fullName: "David Lee",
      role: "REQUESTER" as const,
      department: "Information Technology",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "sarah.johnson@kmutt.ac.th",
      fullName: "Sarah Johnson",
      role: "REQUESTER" as const,
      department: "Digital Media",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "emily.davis@toktickit.com",
      fullName: "Emily Davis",
      role: "REQUESTER" as const,
      department: "Sales & Marketing",
      isActive: true,
      mustChangePassword: true,
    },
    {
      email: "inactive.test@kmutt.ac.th",
      fullName: "Inactive Requester Test",
      role: "REQUESTER" as const,
      department: "Testing Department",
      isActive: false,
      mustChangePassword: true,
    },

    // --- IT Staff (3 active, 1 inactive) ---
    {
      email: "michael.brown@toktickit.com",
      fullName: "Michael Brown",
      role: "IT_STAFF" as const,
      department: "IT Support Tier 2",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "lisa.martinez@toktickit.com",
      fullName: "Lisa Martinez",
      role: "IT_STAFF" as const,
      department: "IT Operations",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "james.wilson@toktickit.com",
      fullName: "James Wilson",
      role: "IT_STAFF" as const,
      department: "Systems Engineering",
      isActive: true,
      mustChangePassword: true,
    },
    {
      email: "kevin.patel@toktickit.com",
      fullName: "Kevin Patel",
      role: "IT_STAFF" as const,
      department: "IT Support",
      isActive: false,
      mustChangePassword: true,
    },

    // --- Administrators (2 active) ---
    {
      email: "admin@toktickit.com",
      fullName: "System Administrator",
      role: "ADMINISTRATOR" as const,
      department: "IT Administration",
      isActive: true,
      mustChangePassword: false,
    },
    {
      email: "john.smith@toktickit.com",
      fullName: "John Smith",
      role: "ADMINISTRATOR" as const,
      department: "IT Management",
      isActive: true,
      mustChangePassword: false,
    },
  ];

  const seededUsers = new Map<string, any>();

  for (const u of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        name: u.fullName,
        role: u.role,
        department: u.department,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
      },
      create: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        name: u.fullName,
        role: u.role,
        department: u.department,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
      },
    });
    seededUsers.set(u.email, user);

    // Also synchronize RequesterUser for Lab 2 backwards-compatibility
    if (u.role === "REQUESTER") {
      await prisma.requesterUser.upsert({
        where: { email: u.email },
        update: {
          name: u.fullName,
          department: u.department,
          isActive: u.isActive,
        },
        create: {
          id: user.id, // Match the User ID exactly
          name: u.fullName,
          email: u.email,
          department: u.department,
          isActive: u.isActive,
        },
      });
    }
  }
  console.log("Users and Development Requesters seeded successfully.");

  // Fetch Lookups
  const allCats = await prisma.category.findMany();
  const allSys = await prisma.relatedSystem.findMany();
  const catMap = new Map(allCats.map((c) => [c.name, c.id]));
  const sysMap = new Map(allSys.map((s) => [s.code, s.id]));

  const jennifer = seededUsers.get("jennifer.anderson@kmutt.ac.th");
  const david = seededUsers.get("david.lee@kmutt.ac.th");
  const sarah = seededUsers.get("sarah.johnson@kmutt.ac.th");
  const emily = seededUsers.get("emily.davis@toktickit.com");
  const michael = seededUsers.get("michael.brown@toktickit.com");
  const lisa = seededUsers.get("lisa.martinez@toktickit.com");

  // 4. Seed Detailed Sample Tickets with Comments and Internal Notes
  const sampleTickets = [
    {
      ticketNumber: "TKT-2025-001234",
      requesterId: jennifer.id,
      assignedToId: michael.id,
      categoryId: catMap.get("Hardware") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-VPN") || allSys[0].id,
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "IN_PROGRESS" as const,
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week's Windows update.",
      resolutionSummary: null,
      comments: [
        {
          id: "cmt-seed-1",
          authorId: michael.id,
          content: "We are investigating the issue on your device. We'll update you shortly.",
        },
        {
          id: "cmt-seed-2",
          authorId: jennifer.id,
          content: "Thank you for the update. Please let me know if you need any additional information.",
        },
      ],
      internalNotes: [
        {
          id: "note-seed-1",
          authorId: michael.id,
          content: "Battery diagnostic tool indicates cell degradation at 45%. Hardware replacement authorized under warranty.",
        },
        {
          id: "note-seed-2",
          authorId: michael.id,
          content: "Ordered replacement battery part #BAT-9921. Delivery expected tomorrow morning.",
        },
      ],
    },
    {
      ticketNumber: "TKT-2026-000002",
      requesterId: david.id,
      assignedToId: lisa.id,
      categoryId: catMap.get("Network") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-VPN") || allSys[0].id,
      requestedPriority: "HIGH" as const,
      itPriority: "HIGH" as const,
      currentStatus: "OPEN" as const,
      summary: "Cannot connect to VPN from home office",
      description: "Authentication fails repeatedly via Cisco AnyConnect with timeout error.",
      resolutionSummary: null,
      comments: [
        {
          id: "cmt-seed-3",
          authorId: lisa.id,
          content: "Can you please verify if you are connecting through university Wi-Fi or home network?",
        },
      ],
      internalNotes: [
        {
          id: "note-seed-3",
          authorId: lisa.id,
          content: "Checked RADIUS authentication logs. No rejection observed, suspect DNS routing issue on client ISP.",
        },
      ],
    },
    {
      ticketNumber: "TKT-2026-000003",
      requesterId: jennifer.id,
      assignedToId: michael.id,
      categoryId: catMap.get("Software") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-EMAIL") || allSys[0].id,
      requestedPriority: "MEDIUM" as const,
      itPriority: "LOW" as const,
      currentStatus: "IN_PROGRESS" as const,
      summary: "Outlook freezing during message sync",
      description: "Outlook desktop application freezes completely when syncing large shared folders.",
      resolutionSummary: null,
      comments: [],
      internalNotes: [],
    },
    {
      ticketNumber: "TKT-2026-000004",
      requesterId: sarah.id,
      assignedToId: null, // Unassigned
      categoryId: catMap.get("Account and Access") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-LEB2") || allSys[0].id,
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "NEW" as const,
      summary: "New employee access request for LEB2 platform",
      description: "Please grant instructor access for our new faculty member starting next Monday.",
      resolutionSummary: null,
      comments: [],
      internalNotes: [],
    },
    {
      ticketNumber: "TKT-2026-000005",
      requesterId: emily.id,
      assignedToId: michael.id,
      categoryId: catMap.get("Hardware") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-PRINT") || allSys[0].id,
      requestedPriority: "MEDIUM" as const,
      itPriority: "LOW" as const,
      currentStatus: "WAITING_FOR_REQUESTER" as const,
      summary: "Office printer keeps showing offline error",
      description: "Printer on 4th floor shows offline despite being connected via ethernet.",
      resolutionSummary: null,
      comments: [
        {
          id: "cmt-seed-4",
          authorId: michael.id,
          content: "Could you please check the IP address displayed on the printer physical screen?",
        },
      ],
      internalNotes: [],
    },
    {
      ticketNumber: "TKT-2026-000006",
      requesterId: jennifer.id,
      assignedToId: lisa.id,
      categoryId: catMap.get("Hardware") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-EMAIL") || allSys[0].id,
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "RESOLVED" as const,
      summary: "Docking station dual display detection issue",
      description: "Second monitor is not recognized when connecting through Dell Thunderbolt dock.",
      resolutionSummary: "Updated Thunderbolt firmware to 4.12 and installed latest Intel Graphics driver. Both displays working normally.",
      comments: [
        {
          id: "cmt-seed-5",
          authorId: lisa.id,
          content: "Firmware update completed. Both monitors should now be operational.",
        },
        {
          id: "cmt-seed-6",
          authorId: jennifer.id,
          content: "Both screens are working perfectly now. Thank you!",
        },
      ],
      internalNotes: [
        {
          id: "note-seed-4",
          authorId: lisa.id,
          content: "Known Dell firmware bug resolved in release 4.12.",
        },
      ],
    },
    {
      ticketNumber: "TKT-2026-000007",
      requesterId: david.id,
      assignedToId: lisa.id,
      categoryId: catMap.get("Software") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-GRADES") || allSys[0].id,
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      currentStatus: "CLOSED" as const,
      summary: "Request software installation for MATLAB 2026",
      description: "Need MATLAB 2026 academic license deployed to lab workstation.",
      resolutionSummary: "Installed MATLAB 2026 with campus network license and verified toolboxes.",
      comments: [],
      internalNotes: [],
    },
  ];

  for (const t of sampleTickets) {
    const { comments, internalNotes, ...ticketData } = t;

    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: ticketData.ticketNumber },
      update: {
        requesterId: ticketData.requesterId,
        assignedToId: ticketData.assignedToId,
        categoryId: ticketData.categoryId,
        relatedSystemId: ticketData.relatedSystemId,
        requestedPriority: ticketData.requestedPriority,
        itPriority: ticketData.itPriority,
        currentStatus: ticketData.currentStatus,
        summary: ticketData.summary,
        description: ticketData.description,
        resolutionSummary: ticketData.resolutionSummary,
      },
      create: ticketData,
    });

    // Idempotent Comments
    for (const c of comments) {
      await prisma.comment.upsert({
        where: { id: c.id },
        update: { content: c.content },
        create: {
          id: c.id,
          ticketId: ticket.id,
          authorId: c.authorId,
          content: c.content,
        },
      });
    }

    // Idempotent Internal Notes
    for (const n of internalNotes) {
      await prisma.internalNote.upsert({
        where: { id: n.id },
        update: { content: n.content },
        create: {
          id: n.id,
          ticketId: ticket.id,
          authorId: n.authorId,
          content: n.content,
        },
      });
    }
  }

  // 5. Seed Additional User Tickets for Lab 2 pagination tests
  const seedBatchTickets = async (user: any, startSeq: number, count: number) => {
    if (!user) return;
    const priorities: ("LOW" | "MEDIUM" | "HIGH" | "URGENT")[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    const statuses: ("NEW" | "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED")[] = [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "PENDING",
      "RESOLVED",
      "CLOSED",
    ];

    for (let i = 0; i < count; i++) {
      const seqStr = String(startSeq + i).padStart(6, "0");
      const ticketNumber = `TKT-2026-${seqStr}`;
      const cat = allCats[i % allCats.length];
      const sys = allSys[i % allSys.length];
      const priority = priorities[i % priorities.length];
      const status = statuses[i % statuses.length];
      const daysAgo = Math.floor(i * 2);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      await prisma.ticket.upsert({
        where: { ticketNumber },
        update: {
          requesterId: user.id,
          categoryId: cat.id,
          relatedSystemId: sys.id,
          requestedPriority: priority,
          itPriority: priority,
          currentStatus: status,
          summary: `Support request #${i + 1} for ${user.fullName}`,
          description: `Detailed description for support request #${i + 1} filed by ${user.fullName}.`,
        },
        create: {
          ticketNumber,
          requesterId: user.id,
          categoryId: cat.id,
          relatedSystemId: sys.id,
          requestedPriority: priority,
          itPriority: priority,
          currentStatus: status,
          summary: `Support request #${i + 1} for ${user.fullName}`,
          description: `Detailed description for support request #${i + 1} filed by ${user.fullName}.`,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
  };

  await seedBatchTickets(jennifer, 101, 20);
  await seedBatchTickets(david, 201, 20);

  console.log("Seeding completed successfully and idempotently.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });