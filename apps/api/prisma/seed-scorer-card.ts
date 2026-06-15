import { PrismaClient } from '@prisma/client';

import { logScorerCardSeedInstructions, seedScorerStartMatchCard } from './lib/seed-scorer-card';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const result = await seedScorerStartMatchCard(prisma);
  if (result) {
    logScorerCardSeedInstructions(result);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
