import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  console.log('');
  console.log('============================================');
  console.log('IMPORTANT: Admin User Setup');
  console.log('============================================');
  console.log('1. Set ADMIN_EMAILS in your .env file to your Google account email');
  console.log('2. Log in with Google OAuth - you will be created as admin automatically');
  console.log('3. Invite team members from Settings > Users');
  console.log('4. Configure task templates via Settings > Templates');
  console.log('============================================');
  console.log('');

  // Create default tags
  const tags = [
    { name: 'web', color: '#dc2626' },
    { name: 'admin', color: '#ca8a04' },
    { name: 'gbp', color: '#16a34a' },
    { name: 'ads', color: '#2563eb' }
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: { color: tag.color },
      create: tag
    });
  }
  console.log('Created default tags (web, admin, gbp, ads)');

  // NOTE: Task templates are managed via the Templates UI using TemplateSets.
  // The old TaskTemplate seed data has been removed to avoid confusion.
  // Configure your templates at Settings > Templates after setup.

  // Create default settings
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      emailNotifications: true,
      notificationSettings: {
        taskAssigned: true,
        taskDueSoon: true,
        taskOverdue: true,
        newSubscription: true,
        subscriptionCanceled: true,
        contractorInvited: true
      }
    }
  });
  console.log('Created default settings');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
