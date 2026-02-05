import { prisma } from '../db/client.js';
import * as fs from 'fs';

async function exportTemplates() {
  console.log('Exporting templates to CSV...\n');

  const templateSets = await prisma.templateSet.findMany({
    include: {
      templates: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subtasks: { orderBy: { sortOrder: 'asc' } },
          defaultRole: { select: { name: true } }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // CSV for main templates
  const templateRows: string[] = [];
  templateRows.push([
    'Template Set',
    'Trigger Type',
    'Plan Types',
    'Template Title',
    'Description',
    'Due In Days',
    'Tags',
    'Default Role',
    'SOP URL',
    'Sort Order',
    'Subtasks (semicolon separated)',
    'Template ID',
    'Template Set ID'
  ].map(escapeCSV).join(','));

  for (const ts of templateSets) {
    for (const template of ts.templates) {
      const subtaskList = template.subtasks
        .map(st => st.title + (st.sopUrl ? ` [${st.sopUrl}]` : ''))
        .join('; ');

      templateRows.push([
        ts.name || '',
        ts.triggerType || '',
        (ts.planTypes || []).join(', '),
        template.title || '',
        template.description || '',
        (template.dueInDays ?? 0).toString(),
        (template.tags || []).join(', '),
        template.defaultRole?.name || '',
        template.sopUrl || '',
        (template.sortOrder ?? 0).toString(),
        subtaskList,
        template.id || '',
        ts.id || ''
      ].map(escapeCSV).join(','));
    }
  }

  // Write main templates CSV
  const templatesCSV = templateRows.join('\n');
  fs.writeFileSync('templates-export.csv', templatesCSV);
  console.log(`Exported ${templateRows.length - 1} templates to templates-export.csv`);

  // Also export subtasks separately for easier editing
  const subtaskRows: string[] = [];
  subtaskRows.push([
    'Template Set',
    'Template Title',
    'Subtask Title',
    'Subtask SOP URL',
    'Sort Order',
    'Subtask ID',
    'Template ID'
  ].map(escapeCSV).join(','));

  for (const ts of templateSets) {
    for (const template of ts.templates) {
      for (const subtask of template.subtasks) {
        subtaskRows.push([
          ts.name || '',
          template.title || '',
          subtask.title || '',
          subtask.sopUrl || '',
          (subtask.sortOrder ?? 0).toString(),
          subtask.id || '',
          template.id || ''
        ].map(escapeCSV).join(','));
      }
    }
  }

  const subtasksCSV = subtaskRows.join('\n');
  fs.writeFileSync('subtasks-export.csv', subtasksCSV);
  console.log(`Exported ${subtaskRows.length - 1} subtasks to subtasks-export.csv`);

  // Summary
  console.log('\n--- SUMMARY ---');
  console.log(`Template Sets: ${templateSets.length}`);
  console.log(`Templates: ${templateRows.length - 1}`);
  console.log(`Subtasks: ${subtaskRows.length - 1}`);
  console.log('\nFiles created:');
  console.log('  - templates-export.csv (main templates with subtasks inline)');
  console.log('  - subtasks-export.csv (subtasks in separate rows for detailed editing)');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

exportTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
