import "dotenv/config";
import { startServer } from "./app";

// Start the server when running standalone
startServer(Number(process.env.PORT) || 3000);
