/**
 * Prisma Seed Script — Creates realistic test data for ECIMS.
 * Run with: npx prisma db seed
 * 
 * Creates:
 * - 4 roles (Admin, Inventory Controller, Warehouse, Engineering)
 * - 5 users (one per role + an extra admin)
 * - 15 parts (electronic components)
 * - 8 locations (warehouse bins/shelves)
 * - ~40 lots with varied expiry dates
 * - ~60 transactions spread over the last 12 months
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(startDaysAgo, endDaysAgo) {
  const start = new Date();
  start.setDate(start.getDate() - startDaysAgo);
  const end = new Date();
  end.setDate(end.getDate() - endDaysAgo);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d;
}

async function main() {
  console.log("🌱 Seeding ECIMS database...\n");

  // ── Roles ──
  const roles = [
    { id: 1, name: "Admin" },
    { id: 2, name: "Inventory Controller" },
    { id: 3, name: "Warehouse" },
    { id: 4, name: "Engineering" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { id: role.id },
      update: { name: role.name },
      create: role,
    });
  }
  console.log("✅ Roles seeded");

  // ── Users ──
  const users = [
    { id: 1, name: "Admin User", email: "admin@whizz.com", password: "admin123", role_id: 1, is_active: 1 },
    { id: 2, name: "Sarah Tan", email: "sarah@whizz.com", password: "sarah123", role_id: 2, is_active: 1 },
    { id: 3, name: "Ahmad Razak", email: "ahmad@whizz.com", password: "ahmad123", role_id: 3, is_active: 1 },
    { id: 4, name: "Chen Wei", email: "chen@whizz.com", password: "chen123", role_id: 4, is_active: 1 },
    { id: 5, name: "Priya Kumar", email: "priya@whizz.com", password: "priya123", role_id: 2, is_active: 1 },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, password: user.password, role_id: user.role_id },
      create: user,
    });
  }
  console.log("✅ Users seeded");

  // ── Parts ──
  const parts = [
    { sku: "CAP-100UF-16V", name: "Capacitor 100µF 16V", category: "Capacitors", unit: "pcs", price: 0.15, min_stock: 500, lead_days: 14 },
    { sku: "CAP-10UF-50V", name: "Capacitor 10µF 50V", category: "Capacitors", unit: "pcs", price: 0.12, min_stock: 300, lead_days: 14 },
    { sku: "RES-10K-1/4W", name: "Resistor 10K Ω 1/4W", category: "Resistors", unit: "pcs", price: 0.02, min_stock: 1000, lead_days: 7 },
    { sku: "RES-4K7-1/4W", name: "Resistor 4.7K Ω 1/4W", category: "Resistors", unit: "pcs", price: 0.02, min_stock: 800, lead_days: 7 },
    { sku: "IC-NE555P", name: "IC Timer NE555P DIP-8", category: "ICs", unit: "pcs", price: 0.45, min_stock: 200, lead_days: 21 },
    { sku: "IC-LM7805", name: "Voltage Reg LM7805 TO-220", category: "ICs", unit: "pcs", price: 0.65, min_stock: 150, lead_days: 21 },
    { sku: "LED-RED-5MM", name: "LED Red 5mm", category: "LEDs", unit: "pcs", price: 0.05, min_stock: 500, lead_days: 10 },
    { sku: "LED-GRN-5MM", name: "LED Green 5mm", category: "LEDs", unit: "pcs", price: 0.05, min_stock: 500, lead_days: 10 },
    { sku: "LED-BLU-3MM", name: "LED Blue 3mm", category: "LEDs", unit: "pcs", price: 0.08, min_stock: 300, lead_days: 10 },
    { sku: "CONN-USB-C", name: "USB Type-C Connector SMD", category: "Connectors", unit: "pcs", price: 1.20, min_stock: 100, lead_days: 30 },
    { sku: "CONN-HDR-2X20", name: "Pin Header 2x20 2.54mm", category: "Connectors", unit: "pcs", price: 0.30, min_stock: 200, lead_days: 14 },
    { sku: "XTAL-16MHZ", name: "Crystal Oscillator 16MHz", category: "Crystals", unit: "pcs", price: 0.35, min_stock: 100, lead_days: 21 },
    { sku: "DIODE-1N4007", name: "Diode 1N4007 DO-41", category: "Diodes", unit: "pcs", price: 0.03, min_stock: 500, lead_days: 7 },
    { sku: "MOSFET-IRF540", name: "MOSFET IRF540N TO-220", category: "Transistors", unit: "pcs", price: 0.85, min_stock: 100, lead_days: 21 },
    { sku: "PCB-PROTO-5X7", name: "Prototype PCB 5x7cm", category: "PCBs", unit: "pcs", price: 0.50, min_stock: 50, lead_days: 14 },
  ];

  const createdParts = [];
  for (const part of parts) {
    const p = await prisma.part.upsert({
      where: { sku: part.sku },
      update: {},
      create: part,
    });
    createdParts.push(p);
  }
  console.log(`✅ ${createdParts.length} Parts seeded`);

  // ── Locations ──
  const locationData = [
    { name: "Shelf A-01", type: "Shelf", capacity: 5000 },
    { name: "Shelf A-02", type: "Shelf", capacity: 5000 },
    { name: "Shelf B-01", type: "Shelf", capacity: 3000 },
    { name: "Bin C-01", type: "Bin", capacity: 2000 },
    { name: "Bin C-02", type: "Bin", capacity: 2000 },
    { name: "Rack D-01", type: "Rack", capacity: 10000 },
    { name: "Cold Storage E-01", type: "Cold Storage", capacity: 1000 },
    { name: "Zone F-Receiving", type: "Zone", capacity: 8000 },
  ];

  const createdLocations = [];
  for (const loc of locationData) {
    // Check if location with this name already exists
    let existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (!existing) {
      existing = await prisma.location.create({ data: loc });
    }
    createdLocations.push(existing);
  }
  console.log(`✅ ${createdLocations.length} Locations seeded`);

  // ── Lots (varied expiry dates for FEFO testing) ──
  const lotData = [];
  let lotCounter = 1;

  for (const part of createdParts) {
    // Create 2-4 lots per part
    const numLots = randomInt(2, 4);
    for (let i = 0; i < numLots; i++) {
      const loc = createdLocations[randomInt(0, createdLocations.length - 1)];
      const receivedDate = randomDate(180, 5);
      
      // Some lots are already expiring, some expiring soon, some have plenty of time
      let expiryDate;
      if (i === 0 && Math.random() < 0.3) {
        // Expiring within 30 days (for alert testing)
        expiryDate = futureDate(randomInt(3, 25));
      } else if (Math.random() < 0.15) {
        // Already expired
        expiryDate = randomDate(30, 1);
      } else {
        // Normal expiry (3-18 months out)
        expiryDate = futureDate(randomInt(90, 540));
      }

      lotData.push({
        part_id: part.id,
        location_id: loc.id,
        lot_number: `LOT-${String(lotCounter++).padStart(4, "0")}`,
        date_code: `${new Date(receivedDate).getFullYear().toString().slice(2)}${String(Math.ceil((new Date(receivedDate).getMonth() + 1) / 3) * 13).padStart(2, "0")}`,
        received_date: receivedDate,
        expiry_date: expiryDate,
        quantity: randomInt(50, 2000),
      });
    }
  }

  const createdLots = [];
  for (const lot of lotData) {
    const l = await prisma.lot.create({ data: lot });
    createdLots.push(l);
  }
  console.log(`✅ ${createdLots.length} Lots seeded`);

  // ── Transactions (spread over 12 months) ──
  const txnTypes = ["receive", "issue"];
  let txnCount = 0;

  for (const lot of createdLots) {
    // Receive transaction for each lot
    await prisma.inventoryTransaction.create({
      data: {
        part_id: lot.part_id,
        lot_id: lot.id,
        to_location_id: lot.location_id,
        quantity: lot.quantity + randomInt(100, 500), // received more than current qty
        user_id: users[randomInt(0, 2)].id,
        transaction_type: "receive",
        notes: "Initial stock receive",
        is_fefo_override: 0,
        created_at: lot.received_date,
      },
    });
    txnCount++;

    // Some issue transactions
    if (Math.random() < 0.65) {
      const issueQty = randomInt(10, Math.min(200, lot.quantity));
      const issueDate = new Date(lot.received_date);
      issueDate.setDate(issueDate.getDate() + randomInt(5, 60));

      await prisma.inventoryTransaction.create({
        data: {
          part_id: lot.part_id,
          lot_id: lot.id,
          from_location_id: lot.location_id,
          quantity: issueQty,
          user_id: users[randomInt(0, 2)].id,
          transaction_type: "issue",
          notes: "Production use",
          is_fefo_override: Math.random() < 0.1 ? 1 : 0,
          reason: Math.random() < 0.1 ? "Engineering requested specific date code" : null,
          created_at: issueDate,
        },
      });
      txnCount++;
    }
  }

  // Add a few more recent transactions for the dashboard
  for (let i = 0; i < 10; i++) {
    const part = createdParts[randomInt(0, createdParts.length - 1)];
    const lot = createdLots.find((l) => l.part_id === part.id);
    if (!lot) continue;

    const daysAgo = randomInt(0, 30);
    const txnDate = new Date();
    txnDate.setDate(txnDate.getDate() - daysAgo);

    const type = txnTypes[randomInt(0, 1)];
    await prisma.inventoryTransaction.create({
      data: {
        part_id: part.id,
        lot_id: lot.id,
        from_location_id: type === "issue" ? lot.location_id : null,
        to_location_id: type === "receive" ? lot.location_id : null,
        quantity: randomInt(20, 500),
        user_id: users[randomInt(0, 2)].id,
        transaction_type: type,
        notes: type === "receive" ? "Supplier delivery" : "Production line request",
        is_fefo_override: 0,
        created_at: txnDate,
      },
    });
    txnCount++;
  }

  console.log(`✅ ${txnCount} Transactions seeded`);
  console.log("\n🎉 Seed complete! You can now run 'npm run dev' to start ECIMS.\n");
  console.log("Login credentials:");
  console.log("  Admin:     admin@whizz.com / admin123");
  console.log("  IC:        sarah@whizz.com / sarah123");
  console.log("  Warehouse: ahmad@whizz.com / ahmad123");
  console.log("  Engineer:  chen@whizz.com  / chen123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
