import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  // Get a contractor and project
  const contractor = await prisma.user.findFirst({ where: { role: 'contractor', active: true } });
  const project = await prisma.project.findFirst();

  if (!contractor || !project) {
    console.log('No contractor or project found');
    return;
  }

  console.log('Testing with:');
  console.log('  Contractor:', contractor.name, contractor.id);
  console.log('  Project:', project.name, project.id);

  // Create project access
  const access = await prisma.projectAccess.upsert({
    where: {
      userId_projectId: { userId: contractor.id, projectId: project.id }
    },
    create: {
      userId: contractor.id,
      projectId: project.id,
      canView: true,
      canEdit: true,
      canDelete: false
    },
    update: {
      canView: true,
      canEdit: true,
      canDelete: false
    }
  });
  console.log('Created/updated access:', access.id);

  // Verify it exists
  const verify = await prisma.projectAccess.findMany({
    where: { userId: contractor.id },
    include: { project: { select: { name: true } } }
  });
  console.log('Verified access entries:', verify.length);
  verify.forEach(v => console.log('  -', v.project.name));

  await prisma.$disconnect();
}

test().catch(console.error);
