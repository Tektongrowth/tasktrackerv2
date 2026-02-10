import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SeoSopDraft } from '@/lib/types';

interface SopDraftCardProps {
  draft: SeoSopDraft;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onEdit?: (id: string, afterContent: string) => void;
}

export function SopDraftCard({ draft, onApply, onDismiss, onEdit }: SopDraftCardProps) {
  const isProcessed = draft.status !== 'pending';
  const isNew = draft.draftType === 'new';
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(draft.afterContent);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSave = () => {
    onEdit?.(draft.id, editContent);
    setEditing(false);
  };

  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
              isNew
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              {isNew ? 'New Strategy Doc' : 'Strategy Update'}
            </span>
            {isProcessed && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                draft.status === 'applied' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {draft.status}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-white">{draft.sopTitle}</h4>
          <p className="text-xs text-white/60 mt-1">{draft.description}</p>
          {draft.templateSet && (
            <div className="mt-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
              >
                <span className="text-[10px]">{showTemplates ? '\u25BC' : '\u25B6'}</span>
                {draft.templateSet.name} — {draft.templateSet.templates?.length || 0} templates
              </button>
              {showTemplates && draft.templateSet.templates && (
                <ul className="mt-1 ml-4 space-y-0.5">
                  {draft.templateSet.templates.map((t) => (
                    <li key={t.id} className="text-[11px] text-white/40">
                      {t.sortOrder + 1}. {t.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {isNew ? (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-green-400/70 mb-1">Strategy Document</h5>
          {editing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full text-xs bg-white/5 border border-white/20 rounded p-2 text-white/70 min-h-[200px] resize-y font-mono focus:outline-none focus:border-white/40"
              />
              <div className="flex gap-2 justify-end mt-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditContent(draft.afterContent); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs bg-green-500/5 border border-green-500/10 rounded p-2 text-white/50 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {draft.afterContent}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <h5 className="text-xs font-medium text-red-400/70 mb-1">Before</h5>
            <div className="text-xs bg-red-500/5 border border-red-500/10 rounded p-2 text-white/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {draft.beforeContent}
            </div>
          </div>
          <div>
            <h5 className="text-xs font-medium text-green-400/70 mb-1">After</h5>
            {editing ? (
              <div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full text-xs bg-white/5 border border-white/20 rounded p-2 text-white/70 min-h-[128px] resize-y font-mono focus:outline-none focus:border-white/40"
                />
                <div className="flex gap-2 justify-end mt-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditContent(draft.afterContent); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-xs bg-green-500/5 border border-green-500/10 rounded p-2 text-white/50 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {draft.afterContent}
              </div>
            )}
          </div>
        </div>
      )}

      {!isProcessed && !editing && (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => onDismiss(draft.id)}>
            Dismiss
          </Button>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" onClick={() => onApply(draft.id)}>
            {isNew ? 'Create Strategy Doc' : 'Apply to SOP'}
          </Button>
        </div>
      )}
    </div>
  );
}
