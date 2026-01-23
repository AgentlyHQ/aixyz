import "dotenv/config";
import { createApp } from "../src/server";

// Export the Express app for Vercel serverless
export default createApp();
