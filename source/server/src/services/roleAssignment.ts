import { prisma } from '../db/client.js';

/**
 * Assigns a contractor to all open tasks that have their role.
 * Called when a contractor is assigned a role or when their role changes.
 *
 * @param userId - The ID of the contractor to assign
 * @param roleId - The role ID to find tasks for
 * @returns Number of tasks the contractor was assigned to
 */
export async function assignContractorToRoleTasks(userId: string, roleId: string): Promise<number> {
  // Find all non-completed, non-archived tasks with this roleId
  // that don't already have this user assigned
  const tasksWithRole = await prisma.task.findMany({
    where: {
      roleId,
      archived: false,
      status: { not: 'completed' },
      // Exclude tasks where this user is already assigned
      NOT: {
        assignees: {
          some: { userId }
        }
      }
    },
    select: { id: true }
  });

  if (tasksWithRole.length === 0) {
    return 0;
  }

  // Create TaskAssignee records for each task
  const result = await prisma.taskAssignee.createMany({
    data: tasksWithRole.map(task => ({
      taskId: task.id,
      userId
    })),
    skipDuplicates: true
  });

  return result.count;
}

/**
 * Gets all users assigned to a task, including both direct assignees
 * and users who have the task's role.
 *
 * @param taskId - The task ID
 * @returns Array of user IDs
 */
export async function getEffectiveAssignees(taskId: string): Promise<string[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignees: { select: { userId: true } },
      assignedRole: true
    }
  });

  if (!task) return [];

  const assigneeIds = new Set(task.assignees.map(a => a.userId));

  // If task has a role, add all active users with that role
  if (task.roleId) {
    const usersWithRole = await prisma.user.findMany({
      where: {
        jobRoleId: task.roleId,
        active: true,
        archived: false
      },
      select: { id: true }
    });

    usersWithRole.forEach(u => assigneeIds.add(u.id));
  }

  return Array.from(assigneeIds);
}
