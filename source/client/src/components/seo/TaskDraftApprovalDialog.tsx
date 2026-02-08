import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clients as clientsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { SeoTaskDraft } from '@/lib/types';

interface TaskDraftApprovalDialogProps {
  draft: SeoTaskDraft;
  onApprove: (data: { projectId: string; dueDate?: string }) => void;
  onCancel: () => void;
}

export function TaskDraftApprovalDialog({ draft, onApprove, onCancel }: TaskDraftApprovalDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + draft.suggestedDueInDays);
    return d.toISOString().split('T')[0];
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
  });

  const allProjects = allClients.flatMap((c) =>
    (c.projects || []).map((p) => ({ ...p, clientName: c.name }))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1a1a2e] rounded-lg border border-white/10 p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-4">Approve Task Draft</h3>

        <div className="mb-4 p-3 rounded bg-white/5">
          <h4 className="text-sm font-medium text-white">{draft.title}</h4>
          <p className="text-xs text-white/60 mt-1">{draft.description}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">
              {draft.suggestedPriority}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">
              Due in {draft.suggestedDueInDays} days
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Project *</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            >
              <option value="">Select a project...</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedProjectId}
            onClick={() => onApprove({ projectId: selectedProjectId, dueDate })}
          >
            Approve & Create Task
          </Button>
        </div>
      </div>
    </div>
  );
}
