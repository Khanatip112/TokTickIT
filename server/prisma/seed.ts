import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

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
    { name: "Email", description: "University email and calendar services" },
    { name: "Campus Wi-Fi", description: "On-campus wireless network infrastructure" },
    { name: "VPN", description: "Virtual Private Network secure remote access" },
    { name: "LEB2 App", description: "Learning Environment Building 2 platform" },
    { name: "Grade Submission App", description: "Academic grade submission portal" },
    { name: "Printer", description: "Campus network printers and print servers" },
  ];

  for (const sys of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name: sys.name },
      update: { description: sys.description },
      create: { name: sys.name, description: sys.description },
    });
  }
  console.log("Related Systems seeded successfully.");

  // 3. Seed Development Requesters
  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@kmutt.ac.th", department: "Computer Engineering", isActive: true },
    { name: "David Lee", email: "david.lee@kmutt.ac.th", department: "Information Technology", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@kmutt.ac.th", department: "Digital Media", isActive: true },
    { name: "Michael Brown", email: "michael.brown@kmutt.ac.th", department: "Software Engineering", isActive: true },
    { name: "Inactive User Test", email: "inactive.test@kmutt.ac.th", department: "Testing Department", isActive: false },
  ];

  for (const req of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: req.email },
      update: { name: req.name, department: req.department, isActive: req.isActive },
      create: { name: req.name, email: req.email, department: req.department, isActive: req.isActive },
    });
  }
  console.log("Development Requesters seeded successfully.");

  // Fetch Category & System IDs
  const allCats = await prisma.category.findMany();
  const allSys = await prisma.relatedSystem.findMany();

  const jennifer = await prisma.requesterUser.findUnique({ where: { email: "jennifer.anderson@kmutt.ac.th" } });
  const david = await prisma.requesterUser.findUnique({ where: { email: "david.lee@kmutt.ac.th" } });

  const priorities: ("LOW" | "MEDIUM" | "HIGH" | "URGENT")[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  const statuses: ("NEW" | "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED")[] = ["NEW", "OPEN", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"];

  const generateTicketTemplates = (userName: string) => [
    { summary: "Cannot connect to VPN from home office", desc: "Authentication fails repeatedly via Cisco AnyConnect." },
    { summary: "MacBook screen flickering on battery power", desc: "Display flickers when unplugged from power adapter." },
    { summary: "LEB2 assignment upload freezes at 99%", desc: "Browser tab stops responding when uploading PDF files." },
    { summary: "Slow Wi-Fi connection in Building B floor 3", desc: "Signal drops frequently during morning lectures." },
    { summary: "Printer paper jam error light blinking", desc: "Office printer jam error won't reset after removing paper." },
    { summary: "Password reset request for university email", desc: "Locked out of email account after changing password." },
    { summary: "License activation error for MATLAB 2026", desc: "Error 502 license key expired message shown." },
    { summary: "Request second monitor setup for workstation", desc: "Need HDMI to DisplayPort adapter for dual screen." },
    { summary: "Grade Submission portal access denied", desc: "Unauthorized 403 error when accessing class roster." },
    { summary: "Docker Desktop virtualization startup error", desc: "WSL2 backend fails to initialize on Windows 11." },
  ];

  // Helper สร้าง Ticket 30 รายการต่อคน
  const seedUserTickets = async (user: any, startSeq: number) => {
    if (!user) return;
    await prisma.ticket.deleteMany({ where: { requesterId: user.id } });

    const templates = generateTicketTemplates(user.name);

    for (let i = 0; i < 30; i++) {
      const template = templates[i % templates.length];
      const seqStr = String(startSeq + i).padStart(6, "0");
      const cat = allCats[i % allCats.length];
      const sys = allSys[i % allSys.length];
      const priority = priorities[i % priorities.length];
      const status = statuses[i % statuses.length];

      // กระจายวันที่ถอยหลังจากปัจจุบัน
      const daysAgo = Math.floor(i * 2.5);
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      await prisma.ticket.create({
        data: {
          ticketNumber: `TKT-2026-${seqStr}`,
          requesterId: user.id,
          categoryId: cat.id,
          relatedSystemId: sys.id,
          summary: `${template.summary} (#${i + 1})`,
          description: `${template.desc} Requested by ${user.name}.`,
          requestedPriority: priority,
          itPriority: priority,
          currentStatus: status,
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });
    }
    console.log(`Seeded 30 mock tickets for ${user.name}.`);
  };

  if (jennifer) await seedUserTickets(jennifer, 101);
  if (david) await seedUserTickets(david, 201);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });