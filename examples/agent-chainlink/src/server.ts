import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { startServer } from "./app";

// Start the server when running standalone
startServer(Number(process.env.PORT) || 3000);
