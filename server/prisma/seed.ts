/**
 * Core seed - reference data every environment needs. Safe to re-run any time.
 *
 * It deliberately does NOT create an academic session, department, program or students:
 *  - Academic sessions are created by an administrator in Academics -> Sessions.
 *  - For a ready-made test dataset run:  npm run prisma:seed:demo
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { ensureDatabaseInvariants } from "../src/config/dbInvariants";
import { syncPermissions } from "../src/config/permissionMatrix";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding roles and permissions...");
  const { rolesCreated, permissionsCreated } = await syncPermissions(prisma);
  console.log(`  ${rolesCreated} role(s) and ${permissionsCreated} permission(s) added.`);

  console.log("Seeding attendance policy...");
  await prisma.attendancePolicy.upsert({
    where: { singleton: true },
    update: {},
    create: { singleton: true },
  });

  console.log("Applying database invariants...");
  await ensureDatabaseInvariants(prisma);

  console.log("Seeding super admin user...");
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  const passwordHash = await bcrypt.hash("ChangeMe@123", 12);

  await prisma.user.upsert({
    where: { email: "superadmin@unisphere.edu" },
    update: {},
    create: {
      universityId: "ADM0001",
      email: "superadmin@unisphere.edu",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      roleId: superAdminRole.id,
      mustResetPassword: true,
    },
  });

  console.log("Seed complete.");
  console.log("Login with: superadmin@unisphere.edu / ChangeMe@123 (change on first login)");
  console.log("Next: create an Academic Session under Academics -> Sessions, or run `npm run prisma:seed:demo` for sample data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
