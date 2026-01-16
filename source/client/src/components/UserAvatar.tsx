import { cn, sanitizeUrl } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Validate URL to prevent javascript: and other unsafe protocols
  const safeAvatarUrl = sanitizeUrl(avatarUrl);

  if (safeAvatarUrl) {
    return (
      <img
        src={safeAvatarUrl}
        alt={name}
        className={cn(
          'rounded-full object-cover',
          sizeClasses[size],
          className
        )}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-[var(--theme-sidebar)] flex items-center justify-center text-white font-semibold',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
