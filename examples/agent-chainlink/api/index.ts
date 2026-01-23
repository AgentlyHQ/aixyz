import "dotenv/config";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Request, Response, NextFunction } from "express";
import { app, initializeApp } from "../src/app";

// Initialize the app once for the serverless function
let initializationPromise: Promise<void> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize on first request - promise ensures only one initialization
  if (!initializationPromise) {
    initializationPromise = initializeApp();
  }
  await initializationPromise;

  // Use the Express app to handle the request
  // Vercel's request/response types are compatible with Express
  return new Promise<void>((resolve, reject) => {
    app(
      req as unknown as Request,
      res as unknown as Response,
      ((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }) as NextFunction,
    );
  });
}
