import { PlanType } from '@prisma/client';
import { prisma } from '../db/client.js';
import { assignRoleContractorsToTask } from './roleAssignment.js';

export async function generateTasksFromTemplates(
  projectId: string,
  templateType: 'onboarding' | 'recurring',
  planType: PlanType
) {
  // Get templates that apply to this plan type
  const templates = await prisma.taskTemplate.findMany({
    where: {
      templateType,
      planTypes: { has: planType }
    }
  });

  const tasks = [];
  const baseDate = new Date();

  for (const template of templates) {
    // Calculate due date
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + template.dueInDays);

    // Find assignees by email
    const assigneeIds: string[] = [];
    if (template.defaultAssigneeEmails && template.defaultAssigneeEmails.length > 0) {
      const assignees = await prisma.user.findMany({
        where: { email: { in: template.defaultAssigneeEmails } }
      });
      assigneeIds.push(...assignees.map(a => a.id));
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId,
        templateId: template.id,
        title: template.title,
        description: template.description,
        status: 'todo',
        dueDate,
        tags: template.tags,
        roleId: template.defaultRoleId,
        assignees: assigneeIds.length > 0 ? {
          create: assigneeIds.map(userId => ({ userId }))
        } : undefined
      },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } }
          }
        }
      }
    });

    // Auto-assign contractors with the task's role
    if (template.defaultRoleId) {
      await assignRoleContractorsToTask(task.id, template.defaultRoleId);
    }

    // Log creation
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        action: 'created_from_template',
        details: { templateId: template.id, templateTitle: template.title }
      }
    });

    tasks.push(task);
  }

  return tasks;
}
