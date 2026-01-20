import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { users } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

// Simplified user type for mentions (only what we need)
type MentionableUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Add a comment... Use @name to mention someone',
  className,
  disabled,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: userList = [] } = useQuery({
    queryKey: ['users', 'mentionable'],
    queryFn: users.listMentionable,
  });

  // Filter users based on mention query
  const filteredUsers = userList.filter((user: MentionableUser) => {
    if (!mentionQuery) return true;
    const query = mentionQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().startsWith(query)
    );
  }).slice(0, 5);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space before the @ (or it's at the start)
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' ';

      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) &&
          !textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setShowSuggestions(true);
        setSuggestionIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStart(null);
    setMentionQuery('');
  };

  const insertMention = useCallback((user: MentionableUser) => {
    if (mentionStart === null) return;

    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(mentionStart + mentionQuery.length + 1);
    const mentionText = `@${user.name.split(' ')[0]} `;

    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);

    setShowSuggestions(false);
    setMentionStart(null);
    setMentionQuery('');

    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionStart + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [mentionStart, mentionQuery, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[suggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && e.metaKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn('min-h-[80px] resize-none', className)}
        disabled={disabled}
      />

      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-64 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden"
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b bg-slate-50">
            Mention someone
          </div>
          {filteredUsers.map((user: MentionableUser, index: number) => (
            <div
              key={user.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                index === suggestionIndex ? 'bg-primary/10' : 'hover:bg-muted'
              )}
              onClick={() => insertMention(user)}
              onMouseEnter={() => setSuggestionIndex(index)}
            >
              <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-xs">@</kbd> to mention
        {onSubmit && (
          <span className="ml-2">
            <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-xs">Cmd</kbd> + <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd> to send
          </span>
        )}
      </p>
    </div>
  );
}
