import type { SeoDigestStatus } from '@/lib/types';

const statusConfig: Record<SeoDigestStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-500/20 text-gray-400' },
  fetching: { label: 'Fetching', className: 'bg-blue-500/20 text-blue-400 animate-pulse' },
  analyzing: { label: 'Analyzing', className: 'bg-purple-500/20 text-purple-400 animate-pulse' },
  generating: { label: 'Generating', className: 'bg-amber-500/20 text-amber-400 animate-pulse' },
  delivering: { label: 'Delivering', className: 'bg-cyan-500/20 text-cyan-400 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-400' },
};

export function PipelineStatusBadge({ status }: { status: SeoDigestStatus }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
