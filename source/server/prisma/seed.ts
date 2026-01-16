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
  console.log('4. Update task templates with your team\'s email addresses');
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

  // Onboarding task templates (for all LVL1 and LVL2 plans)
  // NOTE: Default assignees are not set - configure these in the Templates page after inviting your team
  const onboardingTemplates = [
    { title: 'Blog Research', dueInDays: 7, tags: ['web'] },
    { title: 'Publish 2 Posts', dueInDays: 30, tags: ['web'] },
    { title: 'Optimize All GBPs', dueInDays: 15, tags: ['gbp'] },
    { title: 'Setup Collab Folder', dueInDays: 2, tags: ['admin'] },
    { title: 'Setup Analytics', dueInDays: 5, tags: ['admin'] },
    { title: 'KW & LOC Research', dueInDays: 2, tags: ['admin'] },
    { title: 'Build Website Base', dueInDays: 30, tags: ['admin'] },
    { title: 'Create Newsletter Template', dueInDays: 7, tags: ['admin'] },
    { title: 'Research for Ad Campaign', dueInDays: 15, tags: ['ads'] },
    { title: 'Set Up Ad Campaign', dueInDays: 30, tags: ['ads'] },
    { title: 'Go-Live Check', dueInDays: 45, tags: ['admin'] }
  ];

  for (const template of onboardingTemplates) {
    await prisma.taskTemplate.upsert({
      where: { id: `onboarding-${template.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: template,
      create: {
        id: `onboarding-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...template,
        templateType: 'onboarding',
        planTypes: ['lvl1_basic', 'lvl1_advanced', 'lvl2_basic', 'lvl2_advanced']
      }
    });
  }
  console.log('Created onboarding templates');

  // LVL1 Monthly recurring templates
  // NOTE: Default assignees are not set - configure these in the Templates page after inviting your team
  const lvl1MonthlyTemplates = [
    { title: 'Modify Page Content', dueInDays: 7, tags: ['web'] },
    { title: 'Check Page Indexing', dueInDays: 30, tags: ['web'] },
    { title: 'Create Informational Blog', dueInDays: 20, tags: ['web'] },
    { title: 'Check Reviews', dueInDays: 30, tags: ['gbp'] },
    { title: 'Linkbuilding', dueInDays: 3, tags: ['admin'] },
    { title: 'Create GBP Posts', dueInDays: 30, tags: ['gbp'] },
    { title: 'Review GBP', dueInDays: 3, tags: ['gbp'] },
    { title: 'Email Newsletter', dueInDays: 15, tags: ['admin'] },
    { title: 'Ad Campaign Audit', dueInDays: 30, tags: ['ads'] },
    { title: 'Monthly Ad Campaign Review', dueInDays: 30, tags: ['ads'] }
  ];

  for (const template of lvl1MonthlyTemplates) {
    await prisma.taskTemplate.upsert({
      where: { id: `lvl1-monthly-${template.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: template,
      create: {
        id: `lvl1-monthly-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...template,
        templateType: 'recurring',
        planTypes: ['lvl1_basic', 'lvl1_advanced', 'lvl2_basic', 'lvl2_advanced']
      }
    });
  }
  console.log('Created LVL1 monthly templates');

  // LVL2 Additional Monthly templates (only for LVL2 plans)
  const lvl2AdditionalTemplates = [
    { title: 'AI Social Media Posting', dueInDays: 30, tags: ['admin'] },
    { title: 'SMS Text Message Campaigns', dueInDays: 30, tags: ['admin'] },
    { title: 'Review Campaign', dueInDays: 30, tags: ['admin'] }
  ];

  for (const template of lvl2AdditionalTemplates) {
    await prisma.taskTemplate.upsert({
      where: { id: `lvl2-monthly-${template.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: template,
      create: {
        id: `lvl2-monthly-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...template,
        templateType: 'recurring',
        planTypes: ['lvl2_basic', 'lvl2_advanced']
      }
    });
  }
  console.log('Created LVL2 additional monthly templates');

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
