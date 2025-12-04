// scripts/seed-firestore.js
// Usage:
//   1) Download service account JSON from Firebase console and save as ./serviceAccountKey.json
//   2) npm install firebase-admin
//   3) node scripts/seed-firestore.js
//
// The script will read src/data/dummyData.js and seed Firestore:
//
// categories/{catId}
//   - priceRoles/{roleId}
//   - products/{productId}

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// service account key path
const keyPath = process.argv.find(a => a.startsWith("--key=")) ? process.argv.find(a => a.startsWith("--key=")).split("=")[1] : "./serviceAccountKey.json";

if (!fs.existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found. Download it from Firebase Console > Project settings > Service accounts.");
  console.error("Or pass path: node scripts/seed-firestore.js --key=./path/to/key.json");
  process.exit(1);
}

const serviceAccount = require(path.resolve(keyPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// require the dummy dataset (CommonJS)
const { dummyCategories } = require("../src/data/dummyData.cjs");


async function seed() {
  try {
    console.log("Starting Firestore seeding...");

    for (const [catId, cat] of Object.entries(dummyCategories)) {
      const catRef = db.collection("categories").doc(catId);

      // set basic category doc
      await catRef.set({
        id: cat.id,
        name: cat.name,
        images: cat.images || []
      });
      console.log(`Wrote category ${catId}`);

      // set priceRoles subcollection
      if (cat.priceRoles) {
        for (const [roleId, roleDoc] of Object.entries(cat.priceRoles)) {
          const roleRef = catRef.collection("priceRoles").doc(roleId);
          await roleRef.set(roleDoc);
          console.log(`  - priceRole ${roleId} written`);
        }
      }

      // set products subcollection
      if (cat.products) {
        for (const [prodId, prod] of Object.entries(cat.products)) {
          const prodRef = catRef.collection("products").doc(prodId);
          await prodRef.set(prod);
          console.log(`  - product ${prodId} written`);
        }
      }
    }

    console.log("Seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
