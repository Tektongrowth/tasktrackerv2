import { prisma } from '../db/client.js';

interface ApplyTemplateSetResult {
  tasksCreated: number;
  taskIds: string[];
}

/**
 * Apply a template set to a project, creating tasks from all templates in the set
 */
export async function applyTemplateSetToProject(
  templateSetId: string,
  projectId: string
): Promise<ApplyTemplateSetResult> {
  const templateSet = await prisma.templateSet.findUnique({
    where: { id: templateSetId },
    include: {
      templates: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subtasks: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      }
    }
  });

  if (!templateSet || !templateSet.active) {
    return { tasksCreated: 0, taskIds: [] };
  }

  const createdTaskIds: string[] = [];

  for (const template of templateSet.templates) {
    // Find assignees - first by role, then by email
    const assigneeIds: string[] = [];

    // If template has a default role, assign all users with that role
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

    // Also include any explicitly assigned emails (for overrides/additional assignees)
    if (template.defaultAssigneeEmails && template.defaultAssigneeEmails.length > 0) {
      const assignees = await prisma.user.findMany({
        where: { email: { in: template.defaultAssigneeEmails } }
      });
      // Add only if not already in list
      for (const a of assignees) {
        if (!assigneeIds.includes(a.id)) {
          assigneeIds.push(a.id);
        }
      }
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.dueInDays);

    const task = await prisma.task.create({
      data: {
        projectId,
        templateId: template.id,
        title: template.title,
        description: template.description,
        dueDate,
        tags: template.tags,
        roleId: template.defaultRoleId || null,
        status: 'todo',
        priority: 'medium',
        assignees: assigneeIds.length > 0 ? {
          create: assigneeIds.map(userId => ({ userId }))
        } : undefined
      }
    });

    // Create subtasks from template subtasks
    if (template.subtasks && template.subtasks.length > 0) {
      await prisma.subtask.createMany({
        data: template.subtasks.map((ts, index) => ({
          taskId: task.id,
          title: ts.title,
          sortOrder: index,
          completed: false
        }))
      });
    }

    createdTaskIds.push(task.id);
  }

  return {
    tasksCreated: createdTaskIds.length,
    taskIds: createdTaskIds
  };
}

/**
 * Find and apply all matching template sets for a new project based on plan type
 */
export async function applyNewProjectTemplates(
  projectId: string,
  planType: string | null
): Promise<{ totalTasksCreated: number; templateSetsApplied: number }> {
  // Find all active template sets with trigger type 'new_project'
  const templateSets = await prisma.templateSet.findMany({
    where: {
      triggerType: 'new_project',
      active: true
    }
  });

  let totalTasksCreated = 0;
  let templateSetsApplied = 0;

  for (const templateSet of templateSets) {
    // Check if plan type matches (empty planTypes means all plan types)
    const planTypesMatch =
      templateSet.planTypes.length === 0 ||
      (planType && templateSet.planTypes.includes(planType as typeof templateSet.planTypes[number]));

    if (planTypesMatch) {
      const result = await applyTemplateSetToProject(templateSet.id, projectId);
      totalTasksCreated += result.tasksCreated;
      if (result.tasksCreated > 0) {
        templateSetsApplied++;
      }
    }
  }

  return { totalTasksCreated, templateSetsApplied };
}
