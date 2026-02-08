import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmojiKey } from '@/lib/types';

export const EMOJI_MAP: Record<EmojiKey, string> = {
  thumbsup: '👍',
  thumbsdown: '👎',
  heart: '❤️',
  laugh: '😄',
  surprised: '😮',
  sad: '😢',
  party: '🎉',
};

export const EMOJI_LABELS: Record<EmojiKey, string> = {
  thumbsup: 'Like',
  thumbsdown: 'Dislike',
  heart: 'Love',
  laugh: 'Haha',
  surprised: 'Wow',
  sad: 'Sad',
  party: 'Celebrate',
};

interface ReactionPickerProps {
  onSelect: (emoji: EmojiKey) => void;
  disabled?: boolean;
  className?: string;
}

export function ReactionPicker({ onSelect, disabled, className }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: EmojiKey) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 text-white/60 hover:text-white', className)}
          disabled={disabled}
        >
          <Smile className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {(Object.keys(EMOJI_MAP) as EmojiKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="p-1.5 hover:bg-white/[0.04] rounded-md transition-colors text-lg"
              title={EMOJI_LABELS[key]}
            >
              {EMOJI_MAP[key]}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
