import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

// Load .env.local so `prisma db push` and other CLI commands can read DATABASE_URL
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
