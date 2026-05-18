import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0];

  // Cloud Run / App Hosting: ADC automatic, no arguments needed.
  // Detect via K_SERVICE (Cloud Run injects this), NOT NODE_ENV — running
  // `next start` locally also sets NODE_ENV=production but must still use
  // the JSON SA, otherwise local ADC may point at the wrong project.
  if (process.env.K_SERVICE) {
    return initializeApp();
  }

  // Local (dev or prod build via `next start`): use JSON file from .keys/
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const keyPath =
    ".keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json";

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "arounda-planet.firebasestorage.app",
    });
  } catch {
    console.warn(
      `Firebase Admin SDK key not found at ${keyPath}. Some server features may not work.`
    );
    return initializeApp();
  }
}

export const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
