import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SeoRecommendation } from '@/lib/types';

const impactColors: Record<string, string> = {
  high: 'text-red-400 bg-red-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  low: 'text-green-400 bg-green-500/10',
};

const confidenceLabels: Record<string, { label: string; className: string }> = {
  verified: { label: 'Verified (2+ sources)', className: 'text-green-400' },
  emerging: { label: 'Emerging (1 source)', className: 'text-amber-400' },
};

interface RecommendationCardProps {
  recommendation: SeoRecommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const impactClass = impactColors[recommendation.impact] || impactColors.medium;
  const confidenceConfig = confidenceLabels[recommendation.confidence] || confidenceLabels.emerging;

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
      <button
        className="w-full p-4 text-left flex items-start gap-3 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 mt-0.5 text-white/40 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 mt-0.5 text-white/40 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
              {recommendation.category}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${impactClass}`}>
              {recommendation.impact} impact
            </span>
            <span className={`text-xs ${confidenceConfig.className}`}>
              {confidenceConfig.label}
            </span>
          </div>
          <h4 className="text-sm font-medium text-white">{recommendation.title}</h4>
          <p className="text-xs text-white/60 mt-1">{recommendation.summary}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-11 space-y-3 border-t border-white/5 pt-3">
          <div>
            <h5 className="text-xs font-medium text-white/70 mb-1">Details</h5>
            <p className="text-xs text-white/50 whitespace-pre-wrap">{recommendation.details}</p>
          </div>

          {recommendation.citations && recommendation.citations.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-white/70 mb-1">
                Sources ({recommendation.citations.length})
              </h5>
              <div className="space-y-2">
                {recommendation.citations.map((citation) => (
                  <div key={citation.id} className="text-xs bg-white/5 rounded p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white/70">{citation.sourceName}</span>
                      <a
                        href={citation.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--theme-accent)] hover:underline"
                      >
                        View
                      </a>
                    </div>
                    {citation.excerpt && (
                      <p className="text-white/40 italic">"{citation.excerpt}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
