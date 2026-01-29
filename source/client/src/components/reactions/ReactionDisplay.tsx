import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Reaction, EmojiKey } from '@/lib/types';
import { EMOJI_MAP } from './ReactionPicker';

interface ReactionGroup {
  emoji: EmojiKey;
  count: number;
  users: Array<{ id: string; name: string }>;
  userReacted: boolean;
}

interface ReactionDisplayProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: EmojiKey) => void;
  disabled?: boolean;
  className?: string;
}

export function ReactionDisplay({
  reactions,
  currentUserId,
  onToggle,
  disabled,
  className,
}: ReactionDisplayProps) {
  // Group reactions by emoji
  const groups: ReactionGroup[] = [];
  const groupMap = new Map<EmojiKey, ReactionGroup>();

  for (const reaction of reactions) {
    const existing = groupMap.get(reaction.emoji);
    if (existing) {
      existing.count++;
      if (reaction.user) {
        existing.users.push({ id: reaction.user.id, name: reaction.user.name });
      }
      if (reaction.userId === currentUserId) {
        existing.userReacted = true;
      }
    } else {
      const group: ReactionGroup = {
        emoji: reaction.emoji,
        count: 1,
        users: reaction.user ? [{ id: reaction.user.id, name: reaction.user.name }] : [],
        userReacted: reaction.userId === currentUserId,
      };
      groupMap.set(reaction.emoji, group);
      groups.push(group);
    }
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex flex-wrap gap-1', className)}>
        {groups.map((group) => (
          <Tooltip key={group.emoji}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggle(group.emoji)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors',
                  group.userReacted
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground border border-transparent',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="text-sm">{EMOJI_MAP[group.emoji]}</span>
                <span>{group.count}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {group.users.length > 0
                  ? group.users.map((u) => u.name).join(', ')
                  : 'Someone reacted'}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
