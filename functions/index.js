const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

/** Helper to remove undefined properties */
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k, v]) => v !== undefined)
  );
}

exports.createResellerUser = functions.https.onCall(async (data, context) => {
  console.log("📩 Received payload:", data);

  let email = data?.email || null;
  let password = data?.password || null;
  let resellerId = data?.resellerId || null;

  try {
    // ------------------------------------
    // 1) Create Firebase Auth User
    // ------------------------------------
    const userRecord = await auth.createUser(clean({
      email,
      password
    }));

    console.log("✅ Auth user created:", userRecord.uid);

    // ------------------------------------
    // 2) Assign custom reseller claims
    // ------------------------------------
    await auth.setCustomUserClaims(userRecord.uid, clean({
      reseller: true,
      resellerId
    }));

    console.log("🔐 Claims set");

    // ------------------------------------
    // 3) Create users/{uid} doc
    // ------------------------------------
    await db.collection("users").doc(userRecord.uid).set(clean({
      uid: userRecord.uid,
      email,
      resellerId,
      role: "reseller",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }));

    console.log("🗂️ Firestore user doc created");

    // ------------------------------------
    // 4) Ensure reseller metadata exists
    // ------------------------------------
    const metaRef = db.collection("resellersMeta").doc(resellerId);

    await metaRef.set(
      clean({
        id: resellerId,
        email,
        name: resellerId,
        domains: [],
        branding: {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }),
      { merge: true }
    );

    console.log("🏷️ Reseller meta updated");

    return { success: true, uid: userRecord.uid };

  } catch (err) {
    console.error("❌ createResellerUser error:", err);
    throw new functions.https.HttpsError("internal", err.message || "Create user failed");
  }
});
