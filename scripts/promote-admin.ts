/**
 * Promote a user to SUPER_ADMIN by email.
 * Usage: npx tsx scripts/promote-admin.ts user@example.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/promote-admin.ts <email>');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'SUPER_ADMIN' },
    select: { id: true, email: true, role: true },
  });

  console.log(`Promoted ${user.email} to ${user.role} (id: ${user.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
