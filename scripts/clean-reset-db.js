require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  console.log("Connecting to database...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Checking current users...");
  const existingUsers = await prisma.user.findMany();
  console.log("Found existing users:", existingUsers.map(u => ({ username: u.username, role: u.role })));

  console.log("Starting complete database reset of transactional and operational data...");

  // 1. Delete Department Transfers
  const dTransfers = await prisma.departmentTransfer.deleteMany({});
  console.log(`Deleted ${dTransfers.count} DepartmentTransfer records.`);

  // 2. Delete Fabric Ledger Entries
  const dLedger = await prisma.fabricLedgerEntry.deleteMany({});
  console.log(`Deleted ${dLedger.count} FabricLedgerEntry records.`);

  // 3. Delete Outsource Batch Returns
  const dReturns = await prisma.outsourceBatchReturn.deleteMany({});
  console.log(`Deleted ${dReturns.count} OutsourceBatchReturn records.`);

  // 4. Delete Outsource Batches
  const dBatches = await prisma.outsourceBatch.deleteMany({});
  console.log(`Deleted ${dBatches.count} OutsourceBatch records.`);

  // 5. Delete Delivery Challan Items
  const dChallanItems = await prisma.deliveryChallanItem.deleteMany({});
  console.log(`Deleted ${dChallanItems.count} DeliveryChallanItem records.`);

  // 6. Delete Delivery Challans
  const dChallans = await prisma.deliveryChallan.deleteMany({});
  console.log(`Deleted ${dChallans.count} DeliveryChallan records.`);

  // 7. Delete Fabric Inward Items
  const dInwardItems = await prisma.fabricInwardItem.deleteMany({});
  console.log(`Deleted ${dInwardItems.count} FabricInwardItem records.`);

  // 8. Delete Fabric Inwards
  const dInwards = await prisma.fabricInward.deleteMany({});
  console.log(`Deleted ${dInwards.count} FabricInward records.`);

  // 9. Delete Parties
  const dParties = await prisma.party.deleteMany({});
  console.log(`Deleted ${dParties.count} Party records.`);

  // 10. Delete Vendors
  const dVendors = await prisma.vendor.deleteMany({});
  console.log(`Deleted ${dVendors.count} Vendor records.`);

  // 11. Delete all users except admin, karam, imran
  const keptUsernames = ["admin", "karam", "imran"];
  const dUsers = await prisma.user.deleteMany({
    where: {
      username: {
        notIn: keptUsernames,
      },
    },
  });
  console.log(`Deleted ${dUsers.count} other users.`);

  // 12. Ensure admin exists with role ADMIN
  const adminUser = await prisma.user.upsert({
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
      isActive: true,
    },
  });
  console.log(`Verified Admin User: @${adminUser.username} (${adminUser.role})`);

  // 13. Ensure karam exists with role FABRIC_PROCESSING_INCHARGE
  const karamUser = await prisma.user.upsert({
    where: { username: "karam" },
    update: {
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
    create: {
      fullName: "Karam",
      username: "karam",
      password: "123456",
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
  });
  console.log(`Verified Karam User: @${karamUser.username} (${karamUser.role})`);

  // 14. Ensure imran exists with role FABRIC_PROCESSING_INCHARGE
  const imranUser = await prisma.user.upsert({
    where: { username: "imran" },
    update: {
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
    create: {
      fullName: "Imran",
      username: "imran",
      password: "123456",
      role: "FABRIC_PROCESSING_INCHARGE",
      isActive: true,
    },
  });
  console.log(`Verified Imran User: @${imranUser.username} (${imranUser.role})`);

  const finalUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      password: true,
      isActive: true,
    },
  });
  console.log("\n--- Remaining Database Users ---");
  console.table(finalUsers);

  await prisma.$disconnect();
  await pool.end();
  console.log("\nDatabase reset completed successfully!");
}

main().catch((err) => {
  console.error("Error executing database reset:", err);
  process.exit(1);
});

