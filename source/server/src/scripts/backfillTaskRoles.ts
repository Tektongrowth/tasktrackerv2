import { prisma } from '../db/client.js';

/**
 * One-time migration script to backfill roleId on tasks from their templates.
 *
 * This fixes tasks that were created before the bug fix where taskGenerator.ts
 * wasn't copying defaultRoleId from templates to tasks.
 *
 * Run with: npx tsx src/scripts/backfillTaskRoles.ts
 */
async function backfillTaskRoles() {
  console.log('Starting task role backfill...\n');

  // Find all tasks that have a templateId but no roleId
  const tasksWithoutRole = await prisma.task.findMany({
    where: {
      templateId: { not: null },
      roleId: null
    },
    select: {
      id: true,
      title: true,
      templateId: true
    }
  });

  console.log(`Found ${tasksWithoutRole.length} tasks without roleId that have a template\n`);

  if (tasksWithoutRole.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  // Get unique template IDs
  const templateIds = [...new Set(tasksWithoutRole.map(t => t.templateId!))];

  // Fetch templates with their defaultRoleId
  const templates = await prisma.taskTemplate.findMany({
    where: {
      id: { in: templateIds },
      defaultRoleId: { not: null }
    },
    select: {
      id: true,
      title: true,
      defaultRoleId: true,
      defaultRole: {
        select: { name: true }
      }
    }
  });

  console.log(`Found ${templates.length} templates with defaultRoleId\n`);

  // Create a map of templateId -> defaultRoleId
  const templateRoleMap = new Map(
    templates.map(t => [t.id, { roleId: t.defaultRoleId!, roleName: t.defaultRole?.name }])
  );

  // Update tasks
  let updatedCount = 0;
  let skippedCount = 0;

  for (const task of tasksWithoutRole) {
    const roleInfo = templateRoleMap.get(task.templateId!);

    if (!roleInfo) {
      skippedCount++;
      continue;
    }

    await prisma.task.update({
      where: { id: task.id },
      data: { roleId: roleInfo.roleId }
    });

    console.log(`Updated: "${task.title}" -> Role: ${roleInfo.roleName}`);
    updatedCount++;
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Updated: ${updatedCount} tasks`);
  console.log(`  Skipped: ${skippedCount} tasks (template has no default role)`);
}

backfillTaskRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
