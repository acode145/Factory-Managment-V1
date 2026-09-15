import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding initial database data...");

  // Seed Users
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      fullName: "Master Super",
      username: "admin",
      password: "ABC!123@",
      role: "ADMIN",
    },
  });

  const amir = await prisma.user.upsert({
    where: { username: "amir" },
    update: {},
    create: {
      fullName: "Amir Khan",
      username: "amir",
      password: "123456",
      role: "STOREKEEPER",
    },
  });

  const tariq = await prisma.user.upsert({
    where: { username: "tariq" },
    update: {},
    create: {
      fullName: "Tariq Aziz",
      username: "tariq",
      password: "654321",
      role: "FLOOR_SUPERVISOR",
    },
  });

  console.log("Seeded Users:", { admin: admin.username, amir: amir.username, tariq: tariq.username });

  // Seed Parties
  const partyA = await prisma.party.upsert({
    where: { code: "PRT-001" },
    update: {},
    create: {
      code: "PRT-001",
      name: "ABC Textile",
      partyType: "REGULAR_CLIENT",
      contactPerson: "Kamran Akram",
      phone: "+92 300 1234567",
      address: "Plot 14, Industrial Area, Sector 7",
      notes: "High priority commercial brand. Standard dyeing & embroidery.",
    },
  });

  const partyB = await prisma.party.upsert({
    where: { code: "PRT-002" },
    update: {},
    create: {
      code: "PRT-002",
      name: "Party B (Consignment)",
      partyType: "STOCKING_CONSIGNMENT",
      contactPerson: "Bilal Sheikh",
      phone: "+92 321 9876543",
      address: "Warehouse Block C, Textile Hub",
      notes: "Stocks bulk greige lawn in factory warehouse. Continuous drawdowns across designs.",
    },
  });

  const partyC = await prisma.party.upsert({
    where: { code: "PRT-003" },
    update: {},
    create: {
      code: "PRT-003",
      name: "Al-Noor Collection",
      partyType: "REGULAR_CLIENT",
      contactPerson: "Zubair Ahmed",
      phone: "+92 333 4567890",
      address: "Commercial Market, Gate 2",
    },
  });

  console.log("Seeded Parties:", [partyA.name, partyB.name, partyC.name]);

  // Seed Vendors
  const vendor1 = await prisma.vendor.upsert({
    where: { code: "VND-001" },
    update: {},
    create: {
      code: "VND-001",
      name: "Al-Madina Dyeing Mills",
      defaultProcess: "SOLID_DYEING",
      contactPerson: "Ustad Saleem",
      phone: "+92 301 5554321",
      address: "Dyeing Cluster, Industrial Estate",
    },
  });

  const vendor2 = await prisma.vendor.upsert({
    where: { code: "VND-002" },
    update: {},
    create: {
      code: "VND-002",
      name: "Royal Screen Printers",
      defaultProcess: "ROTARY_PRINTING",
      contactPerson: "Haji Munir",
      phone: "+92 302 7778899",
      address: "Printing Row, Mill Road",
    },
  });

  console.log("Seeded Vendors:", [vendor1.name, vendor2.name]);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
