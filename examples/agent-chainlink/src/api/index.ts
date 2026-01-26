import "dotenv/config";
import express, { type Express } from "express";
import { app as expressApp, initializeApp } from "../app";

// Create a wrapper that ensures initialization before handling requests
const app: Express = express();

// Initialize once on module load for Vercel cold start
let isInitialized = false;
const initPromise = initializeApp().then(() => {
  isInitialized = true;
});

// Initialization middleware - ensures app is ready before processing requests
app.use(async (req, res, next) => {
  if (!isInitialized) {
    try {
      await initPromise;
    } catch (error) {
      console.error("Initialization error:", error);
      return res.status(500).json({ error: "Service initialization failed" });
    }
  }
  next();
});

// Mount the main Express app
app.use(expressApp);

// Export for Vercel
export default app;
