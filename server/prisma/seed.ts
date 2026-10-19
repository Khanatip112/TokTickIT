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
  const james = seededUsers.get("james.wilson@toktickit.com");
  const admin = seededUsers.get("admin@toktickit.com");

  // 4. Seed Detailed Sample Tickets with Comments, Internal Notes, and Actions Taken
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
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000001",
          actionDateTime: new Date("2026-10-15T09:30:00.000Z"),
          description: "Ran hardware diagnostic suite to evaluate battery wear and health state.",
          result: "PARTIAL",
          performedById: michael.id,
          followUpRequired: true,
          followUpNote: "Battery health at 45%; order replacement part from vendor.",
          attachmentNotes: "battery-report-01.html",
        },
        {
          id: "a0000000-0000-4000-8000-000000000002",
          actionDateTime: new Date("2026-10-16T14:15:00.000Z"),
          description: "Replaced physical battery pack with part #BAT-9921 and performed initial charging test.",
          result: "SUCCESS",
          performedById: lisa.id, // Demonstrates BR-02: Action taken by IT staff other than ticket owner
          followUpRequired: false,
          followUpNote: null,
          attachmentNotes: "warranty-check.png",
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
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000003",
          actionDateTime: new Date("2026-10-16T11:00:00.000Z"),
          description: "Inspected RADIUS authentication logs and verified user profile credentials.",
          result: "PENDING",
          performedById: lisa.id,
          followUpRequired: true,
          followUpNote: "Request client ISP routing trace from user.",
          attachmentNotes: "radius-auth-log.txt",
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
      actionsTaken: [], // 0 Actions Taken on IN_PROGRESS ticket
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
      actionsTaken: [], // 0 Actions Taken on NEW ticket
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
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000004",
          actionDateTime: new Date("2026-10-17T08:45:00.000Z"),
          description: "Attempted remote ping to network printer IP; device unreachable on subnet.",
          result: "FAILED",
          performedById: michael.id,
          followUpRequired: true,
          followUpNote: "Awaiting physical confirmation of ethernet cable connection from office staff.",
          attachmentNotes: "ping-timeout.png",
        },
      ],
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
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000005",
          actionDateTime: new Date("2026-10-17T13:00:00.000Z"),
          description: "Updated Thunderbolt dock firmware to version 4.12.",
          result: "PARTIAL",
          performedById: lisa.id,
          followUpRequired: true,
          followUpNote: "Need to update host GPU driver to match dock firmware.",
          attachmentNotes: null,
        },
        {
          id: "a0000000-0000-4000-8000-000000000006",
          actionDateTime: new Date("2026-10-17T15:30:00.000Z"),
          description: "Installed latest Intel Graphics driver and verified dual 4K external display configuration.",
          result: "SUCCESS",
          performedById: james.id,
          followUpRequired: false,
          followUpNote: null,
          attachmentNotes: "dual-display-verification.png",
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
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000007",
          actionDateTime: new Date("2026-10-14T10:00:00.000Z"),
          description: "Deployed MATLAB 2026 with university concurrent campus network license.",
          result: "SUCCESS",
          performedById: lisa.id,
          followUpRequired: false,
          followUpNote: null,
          attachmentNotes: "matlab-license-activation.pdf",
        },
      ],
    },
    {
      ticketNumber: "TKT-2026-000008",
      requesterId: jennifer.id,
      assignedToId: michael.id,
      categoryId: catMap.get("Network") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-WIFI") || allSys[0].id,
      requestedPriority: "URGENT" as const,
      itPriority: "URGENT" as const,
      currentStatus: "REOPENED" as const,
      summary: "Campus Wi-Fi drops intermittently in Building 3",
      description: "Wi-Fi connections disconnect every 10 minutes during classes in Building 3 lecture halls.",
      resolutionSummary: null,
      comments: [
        {
          id: "cmt-seed-7",
          authorId: jennifer.id,
          content: "The disconnections started again this morning during the lecture.",
        },
      ],
      internalNotes: [
        {
          id: "note-seed-5",
          authorId: michael.id,
          content: "Reopened ticket due to recurring interference on access point cluster.",
        },
      ],
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000008",
          actionDateTime: new Date("2026-10-18T09:00:00.000Z"),
          description: "Rebooted access point AP-B3-201 and refreshed DHCP lease table.",
          result: "PARTIAL",
          performedById: michael.id,
          followUpRequired: true,
          followUpNote: "Issue recurred after 2 hours; scheduled RF interference scan.",
          attachmentNotes: "rf-channel-map.png",
        },
        {
          id: "a0000000-0000-4000-8000-000000000009",
          actionDateTime: new Date("2026-10-18T14:30:00.000Z"),
          description: "Adjusted transmission power on adjacent 5GHz channels to minimize co-channel interference.",
          result: "PENDING",
          performedById: lisa.id,
          followUpRequired: true,
          followUpNote: "Monitor signal-to-noise ratio during peak class hours.",
          attachmentNotes: null,
        },
      ],
    },
    {
      ticketNumber: "TKT-2026-000009",
      requesterId: david.id,
      assignedToId: null, // Unassigned
      categoryId: catMap.get("Software") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-LEB2") || allSys[0].id,
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      currentStatus: "CANCELLED" as const,
      summary: "Duplicate grade submission inquiry",
      description: "Request was filed twice by accident. Please cancel this ticket.",
      resolutionSummary: "Cancelled at requester request as duplicate.",
      comments: [],
      internalNotes: [],
      actionsTaken: [], // 0 Actions Taken on CANCELLED ticket
    },
    {
      ticketNumber: "TKT-2026-000010",
      requesterId: sarah.id,
      assignedToId: null, // Unassigned, URGENT priority
      categoryId: catMap.get("Network") || allCats[0].id,
      relatedSystemId: sysMap.get("SYS-VPN") || allSys[0].id,
      requestedPriority: "URGENT" as const,
      itPriority: "URGENT" as const,
      currentStatus: "OPEN" as const,
      summary: "Core VPN gateway cluster node failing health probe",
      description: "Gateway 2 cluster node failing health check probe; remote connections experiencing packet loss.",
      resolutionSummary: null,
      comments: [],
      internalNotes: [
        {
          id: "note-seed-6",
          authorId: admin.id,
          content: "Failover initiated automatically. Monitoring failover node stability.",
        },
      ],
      actionsTaken: [
        {
          id: "a0000000-0000-4000-8000-000000000010",
          actionDateTime: new Date("2026-10-19T08:00:00.000Z"),
          description: "Initiated gateway failover to standby node; verifying route propagation.",
          result: "SUCCESS",
          performedById: admin.id,
          followUpRequired: false,
          followUpNote: null,
          attachmentNotes: "gateway-failover.log",
        },
      ],
    },
  ];

  for (const t of sampleTickets) {
    const { comments, internalNotes, actionsTaken, ...ticketData } = t;

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

    // Idempotent Actions Taken
    if (actionsTaken && actionsTaken.length > 0) {
      for (const a of actionsTaken) {
        await prisma.actionTaken.upsert({
          where: { id: a.id },
          update: {
            ticketId: ticket.id,
            actionDateTime: a.actionDateTime,
            description: a.description,
            result: a.result,
            performedById: a.performedById,
            followUpRequired: a.followUpRequired,
            followUpNote: a.followUpNote ?? null,
            attachmentNotes: a.attachmentNotes ?? null,
          },
          create: {
            id: a.id,
            ticketId: ticket.id,
            actionDateTime: a.actionDateTime,
            description: a.description,
            result: a.result,
            performedById: a.performedById,
            followUpRequired: a.followUpRequired,
            followUpNote: a.followUpNote ?? null,
            attachmentNotes: a.attachmentNotes ?? null,
          },
        });
      }
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