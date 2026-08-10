import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // This seed's fallback credentials (owner@example.com / ChangeMe123!) are
  // published in .env.example — never let it create that account for real.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    console.error(
      'Refusing to run the demo seed with NODE_ENV=production. ' +
        'Set SEED_ALLOW_PRODUCTION=true if this is intentional, and always pass a non-default SEED_OWNER_PASSWORD.',
    );
    process.exit(1);
  }

  const email = process.env.SEED_OWNER_EMAIL ?? 'owner@example.com';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed skipped: user ${email} already exists.`);
    return;
  }

  const company = await prisma.company.create({
    data: {
      name: 'Mercadinho Demo',
      sector: 'Alimentação (Mercado, Padaria...)',
      offering: 'BOTH',
      tracksInventory: true,
      onboardingCompleted: true,
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      companyId: company.id,
      email,
      passwordHash,
      name: 'Owner Demo',
      role: Role.OWNER,
    },
  });

  console.log(`Seed complete. Login with ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
