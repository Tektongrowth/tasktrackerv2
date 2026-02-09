import { useState } from 'react';
import { Play, Settings, FileText, CheckSquare, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { DigestCard } from '@/components/seo/DigestCard';
import { RecommendationCard } from '@/components/seo/RecommendationCard';
import { TaskDraftApprovalDialog } from '@/components/seo/TaskDraftApprovalDialog';
import { SopDraftCard } from '@/components/seo/SopDraftCard';
import { SourceManager } from '@/components/seo/SourceManager';
import {
  useSeoDigests,
  useSeoDigest,
  useRunSeoPipeline,
  useSeoTaskDrafts,
  useApproveTaskDraft,
  useRejectTaskDraft,
  useSeoSopDrafts,
  useApplySopDraft,
  useDismissSopDraft,
  useSeoSettings,
  useUpdateSeoSettings,
  useSeoJobHistory,
} from '@/hooks/useSeo';
import type { SeoTaskDraft } from '@/lib/types';

type Tab = 'dashboard' | 'recommendations' | 'tasks' | 'sops' | 'settings';

const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: FileText },
  { id: 'recommendations', label: 'Recommendations', icon: BookOpen },
  { id: 'tasks', label: 'Task Drafts', icon: CheckSquare },
  { id: 'sops', label: 'SOP Updates', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function SeoIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedDigestId, setSelectedDigestId] = useState<string>();
  const [approvingDraft, setApprovingDraft] = useState<SeoTaskDraft | null>(null);

  const { data: digestsData } = useSeoDigests();
  const { data: selectedDigest } = useSeoDigest(selectedDigestId);
  const runPipeline = useRunSeoPipeline();
  const { data: taskDrafts = [] } = useSeoTaskDrafts(selectedDigestId);
  const approveTask = useApproveTaskDraft();
  const rejectTask = useRejectTaskDraft();
  const { data: sopDrafts = [] } = useSeoSopDrafts(selectedDigestId);
  const applySop = useApplySopDraft();
  const dismissSop = useDismissSopDraft();
  const { data: settings } = useSeoSettings();
  const updateSettings = useUpdateSeoSettings();
  const { data: jobHistory = [] } = useSeoJobHistory();

  const digests = digestsData?.digests || [];

  // Auto-select latest digest
  if (!selectedDigestId && digests.length > 0) {
    setSelectedDigestId(digests[0].id);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">SEO Intelligence</h1>
        <Button
          size="sm"
          onClick={() => runPipeline.mutate(undefined, {
            onSuccess: () => toast({ title: 'Pipeline triggered — running in background' }),
            onError: (err) => toast({ title: `Pipeline failed: ${err.message}`, variant: 'destructive' }),
          })}
          disabled={runPipeline.isPending}
        >
          <Play className="h-4 w-4 mr-1" />
          {runPipeline.isPending ? 'Running...' : 'Run Now'}
        </Button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/10 pb-px overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-white bg-white/10 border-b-2 border-[var(--theme-accent)]'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {digests.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <p className="text-lg mb-2">No digests yet</p>
              <p className="text-sm">Click "Run Now" to trigger your first SEO intelligence pipeline.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {digests.map((digest) => (
                <DigestCard
                  key={digest.id}
                  digest={digest}
                  onClick={() => {
                    setSelectedDigestId(digest.id);
                    setActiveTab('recommendations');
                  }}
                />
              ))}
            </div>
          )}

          {jobHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recent Pipeline Runs</h3>
              <div className="space-y-1">
                {jobHistory.map((job) => {
                  const startDate = new Date(job.startedAt);
                  const duration = job.completedAt
                    ? Math.round((new Date(job.completedAt).getTime() - startDate.getTime()) / 1000)
                    : null;
                  return (
                    <div key={job.id} className="flex items-center gap-3 px-3 py-2 rounded bg-white/5 text-xs">
                      <span className="text-white/50 w-32 shrink-0">
                        {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-white/60 truncate">{job.jobName}</span>
                      {duration !== null && (
                        <span className="text-white/40 ml-auto shrink-0">{duration}s</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-3">
          {selectedDigest?.recommendations && selectedDigest.recommendations.length > 0 ? (
            selectedDigest.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))
          ) : (
            <p className="text-center py-8 text-white/40 text-sm">
              {selectedDigestId ? 'No recommendations for this digest.' : 'Select a digest to view recommendations.'}
            </p>
          )}
        </div>
      )}

      {/* Task Drafts Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {taskDrafts.length > 0 ? (
            taskDrafts.map((draft: SeoTaskDraft) => (
              <div key={draft.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">{draft.title}</h4>
                    <p className="text-xs text-white/60 mt-1">{draft.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">
                        {draft.suggestedPriority}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50">
                        Due in {draft.suggestedDueInDays} days
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        draft.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        draft.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {draft.status}
                      </span>
                    </div>
                  </div>
                  {draft.status === 'pending' && (
                    <div className="flex gap-2 shrink-0 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rejectTask.mutate(draft.id)}
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => setApprovingDraft(draft)}>
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center py-8 text-white/40 text-sm">
              {selectedDigestId ? 'No task drafts for this digest.' : 'Select a digest to view task drafts.'}
            </p>
          )}
        </div>
      )}

      {/* SOP Updates Tab */}
      {activeTab === 'sops' && (
        <div className="space-y-3">
          {sopDrafts.length > 0 ? (
            sopDrafts.map((draft) => (
              <SopDraftCard
                key={draft.id}
                draft={draft}
                onApply={(id) => applySop.mutate(id)}
                onDismiss={(id) => dismissSop.mutate(id)}
              />
            ))
          ) : (
            <p className="text-center py-8 text-white/40 text-sm">
              {selectedDigestId ? 'No SOP updates for this digest.' : 'Select a digest to view SOP updates.'}
            </p>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">Module Settings</h3>

            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70">Enable SEO Intelligence</label>
              <button
                className={`w-10 h-6 rounded-full relative transition-colors ${
                  settings.enabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
                onClick={() => updateSettings.mutate({ enabled: !settings.enabled })}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.enabled ? 'left-5' : 'left-1'
                }`} />
              </button>
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Run Day of Month (1-28)</label>
              <Input
                type="number"
                min={1}
                max={28}
                value={settings.runDayOfMonth}
                onChange={(e) => updateSettings.mutate({ runDayOfMonth: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs w-24"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Telegram Chat ID</label>
              <Input
                value={settings.telegramChatId || ''}
                onChange={(e) => updateSettings.mutate({ telegramChatId: e.target.value })}
                placeholder="e.g. -1001234567890"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Google Drive Folder ID (Reports)</label>
              <Input
                value={settings.driveFolderId || ''}
                onChange={(e) => updateSettings.mutate({ driveFolderId: e.target.value })}
                placeholder="Drive folder ID"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">SOP Folder ID</label>
              <Input
                value={settings.sopFolderId || ''}
                onChange={(e) => updateSettings.mutate({ sopFolderId: e.target.value })}
                placeholder="SOP folder ID"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">Token Budget (per run)</label>
              <Input
                type="number"
                value={settings.tokenBudget}
                onChange={(e) => updateSettings.mutate({ tokenBudget: parseInt(e.target.value) || 100000 })}
                className="h-8 text-xs w-32"
              />
            </div>
          </div>

          <SourceManager />
        </div>
      )}

      {/* Approval Dialog */}
      {approvingDraft && (
        <TaskDraftApprovalDialog
          draft={approvingDraft}
          onApprove={(data) => {
            approveTask.mutate({ id: approvingDraft.id, data });
            setApprovingDraft(null);
          }}
          onCancel={() => setApprovingDraft(null)}
        />
      )}
    </div>
  );
}
