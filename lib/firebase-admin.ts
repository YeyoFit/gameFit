import * as admin from "firebase-admin";

const firebaseAdminConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1'),
};

export function getFirestoreAdmin() {
    if (!admin.apps.length) {
        if (firebaseAdminConfig.projectId && firebaseAdminConfig.clientEmail && firebaseAdminConfig.privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseAdminConfig as admin.ServiceAccount),
            });
        } else {
            console.warn("Firebase Admin NOT initialized. Missing environment variables.");
        }
    }
    return admin.firestore();
}
