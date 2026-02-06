import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import express, { type Express } from "express";
import { app as coreApp, initializeApp } from "./app";

// Create wrapper app for Vercel serverless with initialization handling
const serverlessApp: Express = express();

// Initialize once on module load for Vercel cold start
let isInitialized = false;
initializeApp()
  .then(() => {
    isInitialized = true;
  })
  .catch((error) => {
    console.warn("[Init] Cold start initialization failed, will retry on first request:", error);
  });

// Initialization middleware - ensures app is ready before processing requests
serverlessApp.use(async (req, res, next) => {
  if (!isInitialized) {
    try {
      await initializeApp();
      isInitialized = true;
    } catch (error) {
      console.error("Initialization error:", error);
      return res.status(503).json({ error: "Service initialization failed, retrying..." });
    }
  }
  next();
});

// Mount the main Express app
serverlessApp.use(coreApp);

// Default export for Vercel
export default serverlessApp;
