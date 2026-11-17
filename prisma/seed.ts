import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding initial database data...");

  // Seed Users
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      role: "ADMIN",
      isActive: true,
    },
    create: {
      fullName: "Master Super",
      username: "admin",
      password: "ABC!123@",
      role: "ADMIN",
    },
  });

  const karam = await prisma.user.upsert({
    where: { username: "karam" },
    update: {
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
    create: {
      fullName: "Karam",
      username: "karam",
      password: "123123",
      role: "FABRIC_PROCESSING_INCHARGE",
    },
  });

  const imran = await prisma.user.upsert({
    where: { username: "imran" },
    update: {
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
    create: {
      fullName: "Imran Bhai",
      username: "imran",
      password: "321321",
      role: "FABRIC_PROCESSING_INCHARGE",
    },
  });

  console.log("Seeded Users:", {
    admin: admin.username,
    karam: karam.username,
    imran: imran.username,
  });

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
