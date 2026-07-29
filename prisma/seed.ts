import { PrismaClient } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '../lib/projects/constants';

const prisma = new PrismaClient();

async function main() {
  await prisma.campaign.upsert({
    where: { id: 'default-workspace' },
    update: {},
    create: {
      id: 'default-workspace',
      name: 'Main Project',
      domain: '',
      locationName: 'Malaysia',
      locationCode: 2458,
      languageCode: 'en',
      deviceType: 'desktop',
      searchEngine: 'google_organic',
      businessName: '',
      competitorDomains: [],
    },
  });

  await prisma.project.upsert({
    where: { id: 'default-workspace' },
    update: {},
    create: {
      id: 'default-workspace',
      workspaceId: DEFAULT_WORKSPACE_ID,
      name: 'Main Project',
      domain: '',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
