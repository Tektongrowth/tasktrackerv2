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
        sopUrl: template.sopUrl || null,
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
          sopUrl: ts.sopUrl || null,
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

interface UpgradeResult {
  tasksCreated: number;
  skippedDuplicates: number;
  templateSetsProcessed: number;
}

/**
 * Upgrade a project to a new plan type, applying only templates that haven't been applied yet.
 * This prevents duplicate tasks when upgrading from P1 -> P2 -> P3 -> P4.
 */
export async function upgradeProjectPlanType(
  projectId: string,
  newPlanType: string
): Promise<UpgradeResult> {
  // 1. Get project's existing tasks with templateIds to track what's already been applied
  const existingTemplateTasks = await prisma.task.findMany({
    where: { projectId, templateId: { not: null } },
    select: { templateId: true }
  });
  const appliedTemplateIds = new Set(existingTemplateTasks.map(t => t.templateId));

  // 2. Find all active template sets that apply to the new plan type
  const templateSets = await prisma.templateSet.findMany({
    where: {
      active: true,
      triggerType: 'new_project', // Same trigger type as new projects
      OR: [
        { planTypes: { isEmpty: true } },  // Empty = all plans
        { planTypes: { has: newPlanType as any } }
      ]
    },
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

  let tasksCreated = 0;
  let skippedDuplicates = 0;

  // 3. Process each template set
  for (const templateSet of templateSets) {
    for (const template of templateSet.templates) {
      // Skip if this template has already been applied to this project
      if (appliedTemplateIds.has(template.id)) {
        skippedDuplicates++;
        continue;
      }

      // Find assignees - first by role, then by email
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
          sopUrl: template.sopUrl || null,
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
            sopUrl: ts.sopUrl || null,
            sortOrder: index,
            completed: false
          }))
        });
      }

      tasksCreated++;
    }
  }

  // 4. Update project's planType
  await prisma.project.update({
    where: { id: projectId },
    data: { planType: newPlanType }
  });

  return {
    tasksCreated,
    skippedDuplicates,
    templateSetsProcessed: templateSets.length
  };
}

interface OffboardResult {
  tasksCreated: number;
  skippedDuplicates: number;
  templateSetsProcessed: number;
}

/**
 * Offboard a project - applies offboarding templates and sets status to canceled.
 * Skips templates that have already been applied to prevent duplicates.
 */
export async function offboardProject(
  projectId: string
): Promise<OffboardResult> {
  // 1. Get project to determine its plan type
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // 2. Get existing tasks with templateIds to track what's already been applied
  const existingTemplateTasks = await prisma.task.findMany({
    where: { projectId, templateId: { not: null } },
    select: { templateId: true }
  });
  const appliedTemplateIds = new Set(existingTemplateTasks.map(t => t.templateId));

  // 3. Find all active template sets with trigger type 'offboard' that match the plan type
  const templateSets = await prisma.templateSet.findMany({
    where: {
      active: true,
      triggerType: 'offboard',
      OR: [
        { planTypes: { isEmpty: true } },  // Empty = all plans
        ...(project.planType ? [{ planTypes: { has: project.planType as any } }] : [])
      ]
    },
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

  let tasksCreated = 0;
  let skippedDuplicates = 0;

  // 4. Process each template set
  for (const templateSet of templateSets) {
    for (const template of templateSet.templates) {
      // Skip if this template has already been applied to this project
      if (appliedTemplateIds.has(template.id)) {
        skippedDuplicates++;
        continue;
      }

      // Find assignees - first by role, then by email
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
          sopUrl: template.sopUrl || null,
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
            sopUrl: ts.sopUrl || null,
            sortOrder: index,
            completed: false
          }))
        });
      }

      tasksCreated++;
    }
  }

  // 5. Update project status to canceled
  await prisma.project.update({
    where: { id: projectId },
    data: { subscriptionStatus: 'canceled' }
  });

  return {
    tasksCreated,
    skippedDuplicates,
    templateSetsProcessed: templateSets.length
  };
}
