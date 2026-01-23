import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { app, initializeApp } from "../src/app";

// Initialize the app once for the serverless function
let initialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize on first request
  if (!initialized) {
    await initializeApp();
    initialized = true;
  }

  // Use the Express app to handle the request
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}
