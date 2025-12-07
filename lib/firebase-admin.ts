import * as admin from 'firebase-admin';
import { validateServerEnv } from './env';

let adminApp: admin.app.App | undefined;

export function getAdminApp() {
  if (!adminApp) {
    if (admin.apps.length === 0) {
      // Validate environment variables before initializing
      const env = validateServerEnv();
      
      const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } else {
      adminApp = admin.apps[0];
    }
  }
  return adminApp;
}

export function getAdminFirestore() {
  const app = getAdminApp();
  return admin.firestore(app);
}

export function getAdminAuth() {
  const app = getAdminApp();
  return admin.auth(app);
}
