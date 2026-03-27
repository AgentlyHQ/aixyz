import { defineSessionStore, InMemorySessionStore } from "aixyz/app/plugins/session";

// Use the built-in in-memory store. Replace with Redis, DB, etc. for production.
export default defineSessionStore(new InMemorySessionStore());
