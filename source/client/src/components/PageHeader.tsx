import { useState, useEffect } from 'react';
import { useRunningTimer, useStopTimer } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

function RunningTimer() {
  const { data: runningTimer } = useRunningTimer();
  const stopTimer = useStopTimer();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!runningTimer?.startTime) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(runningTimer.startTime!).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 60000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer?.startTime]);

  if (!runningTimer) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 text-[var(--theme-primary)] rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-[var(--theme-accent)] rounded-full animate-pulse" />
        <span className="font-mono font-semibold">{formatDuration(elapsed)}</span>
      </div>
      <span className="text-[var(--theme-primary)] truncate max-w-[150px] text-sm font-medium">{runningTimer.title}</span>
      <Button
        size="sm"
        className="h-7 px-2 bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)] text-white"
        onClick={() => stopTimer.mutate({ id: runningTimer.id })}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </Button>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="liquid-bar px-6 py-4 sticky top-0 z-40 min-h-[73px]">
      <div className="flex items-center justify-between">
        {/* Left: Title and subtitle */}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-white/60 text-sm">{subtitle}</p>
          )}
        </div>

        {/* Right: Actions + Timer */}
        <div className="flex items-center gap-3">
          {actions}
          <RunningTimer />
        </div>
      </div>
    </div>
  );
}
