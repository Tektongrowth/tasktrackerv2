import { Button } from '@/components/ui/button';
import type { SeoSopDraft } from '@/lib/types';

interface SopDraftCardProps {
  draft: SeoSopDraft;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function SopDraftCard({ draft, onApply, onDismiss }: SopDraftCardProps) {
  const isProcessed = draft.status !== 'pending';

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-white">{draft.sopTitle}</h4>
          <p className="text-xs text-white/60 mt-1">{draft.description}</p>
        </div>
        {isProcessed && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            draft.status === 'applied' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {draft.status}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <h5 className="text-xs font-medium text-red-400/70 mb-1">Before</h5>
          <div className="text-xs bg-red-500/5 border border-red-500/10 rounded p-2 text-white/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {draft.beforeContent}
          </div>
        </div>
        <div>
          <h5 className="text-xs font-medium text-green-400/70 mb-1">After</h5>
          <div className="text-xs bg-green-500/5 border border-green-500/10 rounded p-2 text-white/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {draft.afterContent}
          </div>
        </div>
      </div>

      {!isProcessed && (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => onDismiss(draft.id)}>
            Dismiss
          </Button>
          <Button size="sm" onClick={() => onApply(draft.id)}>
            Apply to SOP
          </Button>
        </div>
      )}
    </div>
  );
}
