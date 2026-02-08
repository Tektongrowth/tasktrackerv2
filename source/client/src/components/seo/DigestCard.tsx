import type { SeoDigest } from '@/lib/types';
import { PipelineStatusBadge } from './PipelineStatusBadge';

interface DigestCardProps {
  digest: SeoDigest;
  onClick: () => void;
}

export function DigestCard({ digest, onClick }: DigestCardProps) {
  return (
    <div
      className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{digest.period}</h3>
        <PipelineStatusBadge status={digest.status} />
      </div>

      <div className="grid grid-cols-4 gap-2 text-xs text-white/60">
        <div>
          <span className="block text-white/40">Sources</span>
          {digest.sourcesFetched}
        </div>
        <div>
          <span className="block text-white/40">Recommendations</span>
          {digest.recommendationsGenerated}
        </div>
        <div>
          <span className="block text-white/40">Tasks</span>
          {digest.taskDraftsCreated}
        </div>
        <div>
          <span className="block text-white/40">SOPs</span>
          {digest.sopDraftsCreated}
        </div>
      </div>

      {digest.googleDocUrl && (
        <a
          href={digest.googleDocUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-[var(--theme-accent)] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          View Report
        </a>
      )}

      {digest.errorMessage && (
        <p className="mt-2 text-xs text-red-400 truncate">{digest.errorMessage}</p>
      )}
    </div>
  );
}
