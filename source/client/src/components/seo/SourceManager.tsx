import { useState } from 'react';
import { Plus, Pencil, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useSeoSources,
  useCreateSeoSource,
  useUpdateSeoSource,
  useDeleteSeoSource,
  useTestSeoSource,
} from '@/hooks/useSeo';
import { toast } from '@/components/ui/toaster';
import type { SeoSource, SourceTier } from '@/lib/types';

const tierLabels: Record<SourceTier, { label: string; className: string }> = {
  tier_1: { label: 'Tier 1', className: 'bg-green-500/20 text-green-400' },
  tier_2: { label: 'Tier 2', className: 'bg-blue-500/20 text-blue-400' },
  tier_3: { label: 'Tier 3', className: 'bg-gray-500/20 text-gray-400' },
};

interface SourceFormData {
  name: string;
  url: string;
  tier: SourceTier;
  category: string;
  fetchMethod: string;
}

function SourceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<SourceFormData>;
  onSave: (data: SourceFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SourceFormData>({
    name: initial?.name || '',
    url: initial?.url || '',
    tier: initial?.tier || 'tier_3',
    category: initial?.category || 'General SEO',
    fetchMethod: initial?.fetchMethod || 'rss',
  });

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/60 mb-1">Name</label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Source name"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">URL</label>
          <Input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://..."
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-white/60 mb-1">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value as SourceTier })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="tier_1">Tier 1 (Official)</option>
            <option value="tier_2">Tier 2 (Expert)</option>
            <option value="tier_3">Tier 3 (Community)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Category</label>
          <Input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="GBP, Maps, etc."
            className="h-8 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Fetch Method</label>
          <select
            value={form.fetchMethod}
            onChange={(e) => setForm({ ...form, fetchMethod: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="rss">RSS</option>
            <option value="youtube">YouTube</option>
            <option value="reddit">Reddit</option>
            <option value="webpage">Webpage</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.name || !form.url}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function SourceManager() {
  const { data: sources = [] } = useSeoSources();
  const createSource = useCreateSeoSource();
  const updateSource = useUpdateSeoSource();
  const deleteSource = useDeleteSeoSource();
  const testSource = useTestSeoSource();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Sources ({sources.length})
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Add Source
        </Button>
      </div>

      {showAdd && (
        <SourceForm
          onSave={(data) => {
            createSource.mutate(data);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      <div className="space-y-1">
        {sources.map((source: SeoSource) => (
          <div key={source.id}>
            {editingId === source.id ? (
              <SourceForm
                initial={source}
                onSave={(data) => {
                  updateSource.mutate({ id: source.id, data });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-3 p-2 rounded hover:bg-white/5 group">
                <button
                  className={`w-8 h-5 rounded-full relative transition-colors ${
                    source.active ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                  onClick={() => updateSource.mutate({ id: source.id, data: { active: !source.active } })}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      source.active ? 'left-3.5' : 'left-0.5'
                    }`}
                  />
                </button>

                <span className={`text-xs px-1.5 py-0.5 rounded ${tierLabels[source.tier].className}`}>
                  {tierLabels[source.tier].label}
                </span>

                <span className="text-xs text-white/80 flex-1 truncate">{source.name}</span>
                <span className="text-xs text-white/40 hidden sm:inline">{source.category}</span>

                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={testSource.isPending}
                    onClick={() => testSource.mutate(source.id, {
                      onSuccess: (result) => {
                        toast({ title: `Found ${result.articlesFound} articles from ${source.name}` });
                      },
                      onError: (err) => {
                        toast({ title: `Test failed: ${err.message}`, variant: 'destructive' });
                      },
                    })}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingId(source.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400"
                    onClick={() => deleteSource.mutate(source.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
