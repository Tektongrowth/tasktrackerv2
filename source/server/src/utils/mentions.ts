import { prisma } from '../db/client.js';

/**
 * Parse @mentions from comment content
 * Supports @firstName, @firstName.lastName, and @email patterns
 */
export function parseMentions(content: string): string[] {
  // Match @word or @word.word patterns (names, email prefixes)
  const mentionRegex = /@([\w]+(?:\.[\w]+)?)/g;
  const matches = content.match(mentionRegex) || [];
  return [...new Set(matches.map(m => m.slice(1)))]; // Remove @ prefix and dedupe
}

/**
 * Resolve mention strings to user IDs
 * Matches against user names (case-insensitive) or email prefixes
 */
export async function resolveMentions(mentions: string[]): Promise<string[]> {
  if (mentions.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: mentions.flatMap(mention => [
        // Match full name (first + last)
        { name: { equals: mention.replace('.', ' '), mode: 'insensitive' } },
        // Match first name only
        { name: { startsWith: mention.split('.')[0], mode: 'insensitive' } },
        // Match email prefix (before @)
        { email: { startsWith: mention, mode: 'insensitive' } },
      ]),
    },
    select: { id: true, name: true, email: true },
  });

  return users.map(u => u.id);
}

/**
 * Create CommentMention records for the mentions
 */
export async function createMentionRecords(
  commentId: string,
  mentionedUserIds: string[]
): Promise<void> {
  if (mentionedUserIds.length === 0) return;

  await prisma.commentMention.createMany({
    data: mentionedUserIds.map(userId => ({
      commentId,
      userId,
      notified: false,
    })),
    skipDuplicates: true,
  });
}

/**
 * Mark mentions as notified
 */
export async function markMentionsNotified(commentId: string): Promise<void> {
  await prisma.commentMention.updateMany({
    where: { commentId },
    data: { notified: true },
  });
}
