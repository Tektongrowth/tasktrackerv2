import { prisma } from '../db/client.js';

export interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityIds: string[];
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityIds: params.entityIds,
        details: params.details,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    console.error('Failed to create audit log:', error);
  }
}

// Common actions
export const AuditActions = {
  // Task actions
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_ARCHIVED: 'task.archived',
  TASK_UNARCHIVED: 'task.unarchived',

  // Bulk actions
  BULK_STATUS_CHANGE: 'bulk.status_change',
  BULK_ASSIGNEE_CHANGE: 'bulk.assignee_change',
  BULK_DELETE: 'bulk.delete',
  BULK_ARCHIVE: 'bulk.archive',

  // Comment actions
  COMMENT_CREATED: 'comment.created',
  COMMENT_DELETED: 'comment.deleted',

  // Project actions
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',

  // Client actions
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DELETED: 'client.deleted',

  // User actions
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',

  // Task submission actions
  SUBMISSION_CREATED: 'submission.created',
  SUBMISSION_APPROVED: 'submission.approved',
  SUBMISSION_REJECTED: 'submission.rejected',

  // System actions
  BACKUP_CREATED: 'backup.created',
  BACKUP_DELETED: 'backup.deleted',
  SETTINGS_UPDATED: 'settings.updated',
} as const;

export const EntityTypes = {
  TASK: 'task',
  PROJECT: 'project',
  CLIENT: 'client',
  USER: 'user',
  COMMENT: 'comment',
  SUBMISSION: 'task_submission',
  BACKUP: 'backup',
  SETTINGS: 'settings',
} as const;
