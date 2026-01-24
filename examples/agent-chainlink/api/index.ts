import "dotenv/config";
import express, { type Express } from "express";
import { app as expressApp, initializeApp } from "../src/app";

// Create a wrapper that ensures initialization before handling requests
const app: Express = express();

// Initialization middleware - ensures app is ready before processing requests
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (error) {
    console.error("Initialization error:", error);
    res.status(500).json({ error: "Service initialization failed" });
  }
});

// Mount the main Express app
app.use(expressApp);

// Export for Vercel
export default app;
