import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { ensureDatabaseInvariants } from "./config/dbInvariants";

async function main() {
  await prisma.$connect();
  try {
    // Idempotent SQL for rules Prisma's schema cannot express (e.g. one open enrollment per student).
    await ensureDatabaseInvariants(prisma);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Could not verify database invariants - has the schema been migrated? ", (err as Error).message);
  }
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`UniSphere ERP API running on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
