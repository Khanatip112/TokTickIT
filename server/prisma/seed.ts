import { getPrisma } from "../src/prisma.js";

// Issue 2 — Idempotent Seed Data for TokTickIT Requester Ticketing MVP
async function main() {
  const prisma = getPrisma();

  // 1. Seed Categories (4 exact records)
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

  // 2. Seed Related Systems (6 exact records)
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

  // 3. Seed Development Requesters (4 active, 1 inactive)
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
      update: {
        name: req.name,
        department: req.department,
        isActive: req.isActive,
      },
      create: {
        name: req.name,
        email: req.email,
        department: req.department,
        isActive: req.isActive,
      },
    });
  }
  console.log("Development Requesters seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
