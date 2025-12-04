// functions/index.js (add)
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

/**
 * Callable: createResellerUser
 * - only callable by admins (we check custom claim 'admin' or restrict via your own logic)
 * payload: { email, password, resellerId }
 * returns: { uid }
 */
exports.createResellerUser = functions.https.onCall(async (data, context) => {
  // SECURITY: ensure caller is admin
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Admin auth required');
  const caller = context.auth.token || {};
  if (!caller.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');
  }

  const { email, password, resellerId } = data || {};
  if (!email || !password || !resellerId) throw new functions.https.HttpsError('invalid-argument', 'Missing fields');

  try {
    // Create the user
    const userRecord = await auth.createUser({ email, password, emailVerified: false });
    // Set custom claims to mark user as reseller and associate resellerId
    await auth.setCustomUserClaims(userRecord.uid, { reseller: true, resellerId });

    // Optional: create a user doc for quick client reads
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      resellerId,
      role: 'reseller',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Also ensure reseller metadata exists
    const metaRef = db.collection('resellersMeta').doc(resellerId);
    const metaSnap = await metaRef.get();
    if (!metaSnap.exists) {
      await metaRef.set({ id: resellerId, name: resellerId, domains: [], branding: {} }, { merge: true });
    }

    return { uid: userRecord.uid };
  } catch (err) {
    console.error('createResellerUser error:', err);
    throw new functions.https.HttpsError('internal', err.message || 'Create user failed');
  }
});
