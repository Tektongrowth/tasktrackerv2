import { PlanType } from '@prisma/client';
import { prisma } from '../db/client.js';
import { applyNewProjectTemplates } from '../services/templateService.js';

interface ClientPackage {
  businessName: string;
  email: string;
  package: string;
}

const clientPackages: ClientPackage[] = [
  { email: 'mattmadisongreenteam@gmail.com', businessName: 'Madison Green Team', package: 'package_four' },
  { email: 'phillip@ludlowservices.com', businessName: 'Ludlow Services', package: 'package_three' },
  { email: 'toddqualitylandscape@gmail.com', businessName: 'Todd Quality Landscapes', package: 'package_four' },
  { email: 'allie@stclairlandscaping.net', businessName: 'St. Clair Landscaping', package: 'package_four' },
  { email: 'conklinlandscapesolutions@gmail.com', businessName: 'Conklin Landscape Solutions', package: 'facebook_ads_addon' },
  { email: 'mlantz6@gmail.com', businessName: 'Blue Ribbon Lawn & Landscape', package: 'website_only' },
  { email: 'kyle@atlaslandscapekc.com', businessName: 'Atlas Landscape', package: 'package_four' },
  { email: 'office@allinheatingandcooling.com', businessName: 'All In Heating and Cooling', package: 'package_four' },
  { email: 'mcisaac.lawncare@gmail.com', businessName: 'McIsaac Lawn Care', package: 'package_four' },
  { email: 'gracie@wadescapes.com', businessName: 'Wadescapes', package: 'package_four' },
  { email: 'jason@authentichomescapes.com', businessName: 'Authentic Homescapes', package: 'package_four' },
  { email: 'info@nrxlandscaping.com', businessName: 'NRX Landscaping', package: 'package_four' },
  { email: 'foranlawns@gmail.com', businessName: 'Foran Lawn & Yard', package: 'package_four' },
  { email: 'leeslandscapecr@gmail.com', businessName: "Lee's Landscaping", package: 'package_four' },
  { email: 'rcoutdoorllc@gmail.com', businessName: 'RC Outdoor', package: 'package_four' },
  { email: 'justin@laughterfamilyhardscapes.com', businessName: 'Laughter Family Hardscapes', package: 'package_four' },
  { email: 'rick@maineoutdoorspaces.com', businessName: 'Maine Outdoor Spaces', package: 'package_four' },
  { email: 'leonslandscapes@gmail.com', businessName: "Leon's Landscaping", package: 'package_four' },
  { email: 'greenescapeslawn@live.com', businessName: 'Green Escapes Lawncare', package: 'package_four' },
  { email: 'sorcelandscape@gmail.com', businessName: 'Sorce Landscapes', package: 'package_four' },
  { email: 'toprockdesign18@gmail.com', businessName: 'Top Rock Design LLC', package: 'package_four' },
  { email: 'nicolle@tierradesignsf.com', businessName: 'Tierra Design - Landscape Design/Build', package: 'package_four' },
  { email: 'chris@candklawn.com', businessName: 'Next Level Outdoor Services', package: 'package_four' },
  { email: 'jon@generalpavingstones.com', businessName: 'General Paving Stones', package: 'package_two' },
];

function mapPackage(pkg: string): PlanType | null {
  const mapping: Record<string, PlanType> = {
    'package_one': 'package_one',
    'package_two': 'package_two',
    'package_three': 'package_three',
    'package_four': 'package_four',
    'facebook_ads_addon': 'facebook_ads_addon',
    'custom_website_addon': 'custom_website_addon',
  };
  return mapping[pkg] || null;
}

async function fixProjectTemplates() {
  console.log('Fixing project templates...\n');

  let fixed = 0;
  let skipped = 0;
  let notFound = 0;
  let totalTasksCreated = 0;

  for (const row of clientPackages) {
    // Find client by email or business name
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { email: row.email },
          { name: row.businessName }
        ]
      },
      include: {
        projects: {
          include: {
            tasks: { select: { id: true, templateId: true } }
          }
        }
      }
    });

    if (!client) {
      console.log(`NOT FOUND: "${row.businessName}" (${row.email})`);
      notFound++;
      continue;
    }

    const project = client.projects[0];
    if (!project) {
      console.log(`NO PROJECT: "${row.businessName}" has client but no project`);
      notFound++;
      continue;
    }

    const targetPlanType = mapPackage(row.package);

    // Skip website_only - no templates to apply
    if (row.package === 'website_only') {
      console.log(`SKIP: "${row.businessName}" - website_only (no templates)`);
      skipped++;
      continue;
    }

    if (!targetPlanType) {
      console.log(`SKIP: "${row.businessName}" - unknown package "${row.package}"`);
      skipped++;
      continue;
    }

    // Update planType if different
    if (project.planType !== targetPlanType) {
      await prisma.project.update({
        where: { id: project.id },
        data: { planType: targetPlanType }
      });
      console.log(`UPDATED planType: "${row.businessName}" ${project.planType} -> ${targetPlanType}`);
    }

    // Get existing template IDs for this project
    const existingTemplateIds = new Set(
      project.tasks.filter(t => t.templateId).map(t => t.templateId)
    );

    // Find all active template sets that apply to this plan type with 'new_project' trigger
    const templateSets = await prisma.templateSet.findMany({
      where: {
        active: true,
        triggerType: 'new_project',
        OR: [
          { planTypes: { isEmpty: true } },
          { planTypes: { has: targetPlanType } }
        ]
      },
      include: {
        templates: {
          orderBy: { sortOrder: 'asc' },
          include: {
            subtasks: { orderBy: { sortOrder: 'asc' } }
          }
        }
      }
    });

    // Count how many templates are missing
    let missingCount = 0;
    for (const ts of templateSets) {
      for (const template of ts.templates) {
        if (!existingTemplateIds.has(template.id)) {
          missingCount++;
        }
      }
    }

    if (missingCount === 0) {
      console.log(`OK: "${row.businessName}" - all ${existingTemplateIds.size} templates present`);
      skipped++;
      continue;
    }

    // Apply templates (applyNewProjectTemplates will create tasks for templates not yet applied)
    // We need to use a modified approach since applyNewProjectTemplates doesn't check for duplicates
    // Let's manually create only missing tasks

    let tasksCreated = 0;
    for (const templateSet of templateSets) {
      for (const template of templateSet.templates) {
        if (existingTemplateIds.has(template.id)) {
          continue; // Already exists
        }

        // Find assignees by role
        const assigneeIds: string[] = [];
        if (template.defaultRoleId) {
          const usersWithRole = await prisma.user.findMany({
            where: {
              jobRoleId: template.defaultRoleId,
              active: true,
              archived: false
            }
          });
          assigneeIds.push(...usersWithRole.map(u => u.id));
        }

        // Also include explicitly assigned emails
        if (template.defaultAssigneeEmails && template.defaultAssigneeEmails.length > 0) {
          const assignees = await prisma.user.findMany({
            where: { email: { in: template.defaultAssigneeEmails } }
          });
          for (const a of assignees) {
            if (!assigneeIds.includes(a.id)) {
              assigneeIds.push(a.id);
            }
          }
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (template.dueInDays ?? 0));

        const task = await prisma.task.create({
          data: {
            projectId: project.id,
            templateId: template.id,
            title: template.title,
            description: template.description,
            dueDate,
            tags: template.tags,
            roleId: template.defaultRoleId || null,
            sopUrl: template.sopUrl || null,
            sortOrder: template.sortOrder,
            status: 'todo',
            priority: 'medium',
            assignees: assigneeIds.length > 0 ? {
              create: assigneeIds.map(userId => ({ userId }))
            } : undefined
          }
        });

        // Create subtasks
        if (template.subtasks && template.subtasks.length > 0) {
          await prisma.subtask.createMany({
            data: template.subtasks.map((ts, index) => ({
              taskId: task.id,
              title: ts.title,
              sopUrl: ts.sopUrl || null,
              sortOrder: index,
              completed: false
            }))
          });
        }

        tasksCreated++;
      }
    }

    console.log(`FIXED: "${row.businessName}" - added ${tasksCreated} missing tasks (had ${existingTemplateIds.size})`);
    fixed++;
    totalTasksCreated += tasksCreated;
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Fixed: ${fixed} projects`);
  console.log(`Skipped: ${skipped} (already complete or website_only)`);
  console.log(`Not found: ${notFound}`);
  console.log(`Total tasks created: ${totalTasksCreated}`);
}

// Add --dry-run flag support
const isDryRun = process.argv.includes('--dry-run');
if (isDryRun) {
  console.log('=== DRY RUN MODE - No changes will be made ===\n');
}

fixProjectTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
