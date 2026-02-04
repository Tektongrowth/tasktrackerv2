import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding local development database...\n');

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
  console.log('Created default tags');

  // Create test roles
  const roles = [
    { name: 'Developer', color: '#3b82f6', description: 'Web development tasks' },
    { name: 'Designer', color: '#8b5cf6', description: 'Design and UI tasks' },
    { name: 'SEO Specialist', color: '#10b981', description: 'SEO and content tasks' },
    { name: 'Account Manager', color: '#f59e0b', description: 'Client management tasks' }
  ];

  const createdRoles: Record<string, string> = {};
  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role
    });
    createdRoles[role.name] = created.id;
  }
  console.log('Created test roles');

  // Create test admin user (you'll still need to log in with Google OAuth)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@localhost' },
    update: {},
    create: {
      email: 'admin@localhost',
      name: 'Test Admin',
      role: 'admin',
      accessLevel: 'admin',
      active: true
    }
  });
  console.log('Created test admin user');

  // Create test contractor users
  const contractors = [
    { email: 'developer@localhost', name: 'Test Developer', jobRoleId: createdRoles['Developer'] },
    { email: 'designer@localhost', name: 'Test Designer', jobRoleId: createdRoles['Designer'] },
    { email: 'seo@localhost', name: 'Test SEO Specialist', jobRoleId: createdRoles['SEO Specialist'] }
  ];

  for (const contractor of contractors) {
    await prisma.user.upsert({
      where: { email: contractor.email },
      update: contractor,
      create: {
        ...contractor,
        role: 'contractor',
        accessLevel: 'editor',
        active: true
      }
    });
  }
  console.log('Created test contractor users');

  // Create test clients
  const clientsData = [
    { id: 'test-client-acme', name: 'Acme Landscaping', email: 'contact@acmelandscaping.test', phone: '555-0101' },
    { id: 'test-client-green', name: 'Green Gardens Co', email: 'info@greengardens.test', phone: '555-0102' },
    { id: 'test-client-premier', name: 'Premier Outdoor', email: 'hello@premieroutdoor.test', phone: '555-0103' }
  ];

  const createdClients: string[] = [];
  for (const client of clientsData) {
    // Check if exists first
    const existing = await prisma.client.findUnique({ where: { id: client.id } });
    if (existing) {
      createdClients.push(existing.id);
    } else {
      const created = await prisma.client.create({ data: client });
      createdClients.push(created.id);
    }
  }
  console.log('Created test clients');

  // Create test projects
  const projectsData = [
    { id: 'test-project-acme', clientId: createdClients[0], name: 'Acme Landscaping', planType: 'package_four' as const },
    { id: 'test-project-green', clientId: createdClients[1], name: 'Green Gardens Co', planType: 'package_three' as const },
    { id: 'test-project-premier', clientId: createdClients[2], name: 'Premier Outdoor', planType: 'package_two' as const }
  ];

  const createdProjects: string[] = [];
  for (const project of projectsData) {
    const existing = await prisma.project.findUnique({ where: { id: project.id } });
    if (existing) {
      createdProjects.push(existing.id);
    } else {
      const created = await prisma.project.create({
        data: { ...project, subscriptionStatus: 'active' }
      });
      createdProjects.push(created.id);
    }
  }
  console.log('Created test projects');

  // Create test tasks (only if none exist for these projects)
  const existingTasks = await prisma.task.count({
    where: { projectId: { in: createdProjects } }
  });

  if (existingTasks === 0) {
    const tasks = [
      { projectId: createdProjects[0], title: 'Setup Website Analytics', status: 'todo' as const, priority: 'high' as const, tags: ['admin'], roleId: createdRoles['Developer'] },
      { projectId: createdProjects[0], title: 'Create Homepage Design', status: 'in_review' as const, priority: 'medium' as const, tags: ['web'], roleId: createdRoles['Designer'] },
      { projectId: createdProjects[0], title: 'Optimize GBP Listing', status: 'todo' as const, priority: 'medium' as const, tags: ['gbp'], roleId: createdRoles['SEO Specialist'] },
      { projectId: createdProjects[1], title: 'Blog Content Research', status: 'todo' as const, priority: 'low' as const, tags: ['web'], roleId: createdRoles['SEO Specialist'] },
      { projectId: createdProjects[1], title: 'Monthly Newsletter', status: 'completed' as const, priority: 'medium' as const, tags: ['admin'] },
      { projectId: createdProjects[2], title: 'Ad Campaign Setup', status: 'todo' as const, priority: 'urgent' as const, tags: ['ads'], roleId: createdRoles['Developer'] },
      { projectId: createdProjects[2], title: 'Linkbuilding Outreach', status: 'in_review' as const, priority: 'medium' as const, tags: ['admin'] }
    ];

    for (const task of tasks) {
      await prisma.task.create({
        data: {
          ...task,
          dueDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
    console.log('Created test tasks');
  } else {
    console.log('Test tasks already exist, skipping');
  }

  // Create default settings
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      emailNotifications: false, // Disabled for local dev
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

  // Create onboarding task templates (same as production seed)
  const onboardingTemplates = [
    { title: 'Blog Research', dueInDays: 7, tags: ['web'] },
    { title: 'Publish 2 Posts', dueInDays: 30, tags: ['web'] },
    { title: 'Optimize All GBPs', dueInDays: 15, tags: ['gbp'] },
    { title: 'Setup Collab Folder', dueInDays: 2, tags: ['admin'] },
    { title: 'Setup Analytics', dueInDays: 5, tags: ['admin'] },
    { title: 'KW & LOC Research', dueInDays: 2, tags: ['admin'] },
    { title: 'Build Website Base', dueInDays: 30, tags: ['admin'] }
  ];

  for (const template of onboardingTemplates) {
    await prisma.taskTemplate.upsert({
      where: { id: `onboarding-${template.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: template,
      create: {
        id: `onboarding-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        ...template,
        templateType: 'onboarding',
        planTypes: ['package_one', 'package_two', 'package_three', 'package_four']
      }
    });
  }
  console.log('Created task templates');

  console.log('\n========================================');
  console.log('Local development database seeded!');
  console.log('========================================');
  console.log('\nTest accounts created:');
  console.log('  - admin@localhost (Admin)');
  console.log('  - developer@localhost (Developer role)');
  console.log('  - designer@localhost (Designer role)');
  console.log('  - seo@localhost (SEO Specialist role)');
  console.log('\nNote: To log in, you need to use Google OAuth.');
  console.log('Add your Google email to ADMIN_EMAILS in .env.local');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
