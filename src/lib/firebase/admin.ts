import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function initAdmin(): App {
  if (getApps().length > 0) return getApps()[0];

  // Production (Cloud Run): ADC automatic, no arguments needed
  if (process.env.NODE_ENV === "production") {
    return initializeApp();
  }

  // Development: use JSON file from .keys/
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  const keyPath =
    ".keys/arounda-planet-firebase-adminsdk-fbsvc-27080fdcfe.json";

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    return initializeApp({ credential: cert(serviceAccount) });
  } catch {
    console.warn(
      `Firebase Admin SDK key not found at ${keyPath}. Some server features may not work.`
    );
    return initializeApp();
  }
}

export const adminApp = initAdmin();
export const adminAuth = getAuth(adminApp);
