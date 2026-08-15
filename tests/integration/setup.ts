import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

interface TestEnvironment {
  DB: D1Database;
  TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
}

const testEnv = env as unknown as TestEnvironment;
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
