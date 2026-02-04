import { prisma } from '../db/client.js';

// Map template set names to their prefix
function getPrefix(templateSetName: string): string | null {
  const name = templateSetName.toLowerCase();

  // Extract P0, P1, P2, P3, P4 from names like "P1 - Review/Reactivation"
  const pMatch = name.match(/^p(\d)/);
  if (pMatch) {
    return `P${pMatch[1]}`;
  }

  // Special cases
  if (name.includes('custom website')) return 'CW';
  if (name.includes('fb ads')) return 'FB';

  return null;
}

// Check if title already has a package prefix
function hasPrefix(title: string): boolean {
  // Match patterns like "P1 -", "P0 -", "TG1 -", "CW -", "FB -"
  return /^(P\d|TG\d|CW|FB)\s*-\s*/i.test(title);
}

async function prefixTaskTitles() {
  console.log('Prefixing task titles with package identifiers...\n');

  // Get all template sets with their templates
  const templateSets = await prisma.templateSet.findMany({
    include: {
      templates: {
        select: { id: true, title: true }
      }
    }
  });

  let templatesUpdated = 0;
  let templatesSkipped = 0;
  let tasksUpdated = 0;
  let tasksSkipped = 0;

  for (const ts of templateSets) {
    const prefix = getPrefix(ts.name);

    if (!prefix) {
      console.log(`SKIP SET: "${ts.name}" - no prefix mapping`);
      continue;
    }

    console.log(`\nProcessing: "${ts.name}" (prefix: ${prefix})`);

    for (const template of ts.templates) {
      // Skip if already has prefix
      if (hasPrefix(template.title)) {
        console.log(`  SKIP: "${template.title}" - already has prefix`);
        templatesSkipped++;
        continue;
      }

      const newTitle = `${prefix} - ${template.title}`;

      // Update template
      await prisma.taskTemplate.update({
        where: { id: template.id },
        data: { title: newTitle }
      });
      console.log(`  TEMPLATE: "${template.title}" -> "${newTitle}"`);
      templatesUpdated++;

      // Update all tasks created from this template
      const tasks = await prisma.task.findMany({
        where: { templateId: template.id },
        select: { id: true, title: true }
      });

      for (const task of tasks) {
        // Skip if task already has prefix (might have been manually renamed)
        if (hasPrefix(task.title)) {
          tasksSkipped++;
          continue;
        }

        // Update task - use original template title to match, in case task was renamed
        const taskNewTitle = task.title === template.title
          ? newTitle
          : `${prefix} - ${task.title}`;

        await prisma.task.update({
          where: { id: task.id },
          data: { title: taskNewTitle }
        });
        tasksUpdated++;
      }

      if (tasks.length > 0) {
        console.log(`    Updated ${tasks.length} tasks`);
      }
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Templates updated: ${templatesUpdated}`);
  console.log(`Templates skipped: ${templatesSkipped} (already had prefix)`);
  console.log(`Tasks updated: ${tasksUpdated}`);
  console.log(`Tasks skipped: ${tasksSkipped} (already had prefix)`);
}

prefixTaskTitles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
