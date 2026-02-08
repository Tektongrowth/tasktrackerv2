import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { templates, templateSets, users, projects, tags as tagsApi, roles as rolesApi } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, FolderPlus, Zap, Calendar, FolderOpen, Settings2, GripVertical, Play, LogOut, ExternalLink, FileText, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import type { TaskTemplate, PlanType, TemplateSet, TriggerType, User, Project, Tag, Role } from '@/lib/types';

// Subtask data structure
interface SubtaskData {
  title: string;
  sopUrl?: string;
}

// Sortable subtask item component
function SortableSubtaskItem({
  id,
  value,
  index,
  onChange,
  onDelete,
}: {
  id: string;
  value: SubtaskData;
  index: number;
  onChange: (value: SubtaskData) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-col gap-2 bg-background p-2 border rounded-md',
        isDragging && 'opacity-50 z-50'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 text-white/60 hover:text-white touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder={`Subtask ${index + 1}`}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 ml-7">
        <FileText className="h-4 w-4 text-white/60 shrink-0" />
        <Input
          value={value.sopUrl || ''}
          onChange={(e) => onChange({ ...value, sopUrl: e.target.value })}
          placeholder="SOP URL (optional)"
          className="flex-1 h-8 text-sm"
        />
        {value.sopUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[var(--theme-primary)]"
            onClick={() => window.open(value.sopUrl, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Subtasks editor with drag-and-drop
function SubtasksEditor({
  subtasks,
  setSubtasks,
}: {
  subtasks: SubtaskData[];
  setSubtasks: (subtasks: SubtaskData[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate stable IDs for subtasks
  const subtaskIds = subtasks.map((_, index) => `subtask-${index}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = subtaskIds.indexOf(active.id as string);
      const newIndex = subtaskIds.indexOf(over.id as string);
      setSubtasks(arrayMove(subtasks, oldIndex, newIndex));
    }
  };

  return (
    <div className="space-y-2">
      <Label>Subtasks</Label>
      <div className="space-y-2">
        {subtasks.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={subtaskIds} strategy={verticalListSortingStrategy}>
              {subtasks.map((subtask, index) => (
                <SortableSubtaskItem
                  key={subtaskIds[index]}
                  id={subtaskIds[index]}
                  value={subtask}
                  index={index}
                  onChange={(value) => {
                    const newSubtasks = [...subtasks];
                    newSubtasks[index] = value;
                    setSubtasks(newSubtasks);
                  }}
                  onDelete={() => setSubtasks(subtasks.filter((_, i) => i !== index))}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setSubtasks([...subtasks, { title: '' }])}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subtask
        </Button>
      </div>
    </div>
  );
}

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'package_one', label: 'Package One' },
  { value: 'package_two', label: 'Package Two' },
  { value: 'package_three', label: 'Package Three' },
  { value: 'package_four', label: 'Package Four' },
  { value: 'facebook_ads_addon', label: 'Facebook Ads Add-on' },
  { value: 'custom_website_addon', label: 'Custom Website Add-on' },
];

const TRIGGER_TYPES: { value: TriggerType; label: string; description: string; icon: typeof Zap }[] = [
  { value: 'manual', label: 'Manual', description: 'Triggered manually when needed', icon: Settings2 },
  { value: 'new_project', label: 'New Project', description: 'When a new project is created', icon: FolderOpen },
  { value: 'subscription_change', label: 'Subscription Change', description: 'When subscription status changes', icon: Zap },
  { value: 'schedule', label: 'Scheduled', description: 'Runs on a recurring schedule', icon: Calendar },
  { value: 'offboard', label: 'Offboard', description: 'When a project is offboarded', icon: LogOut },
];

export function TemplatesPage() {
  const queryClient = useQueryClient();

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templates.list(),
  });

  const { data: allTemplateSets = [] } = useQuery({
    queryKey: ['template-sets'],
    queryFn: templateSets.list,
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  });

  const { data: allRoles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });

  // Apply to Project dialog state
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyingSet, setApplyingSet] = useState<TemplateSet | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Template dialog state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);

  // Template Set dialog state
  const [showSetDialog, setShowSetDialog] = useState(false);
  const [editingSet, setEditingSet] = useState<TemplateSet | null>(null);

  // Filter state
  const [filterPlanType, setFilterPlanType] = useState<PlanType | 'all'>('all');

  // Template form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<'onboarding' | 'recurring' | 'custom'>('onboarding');
  const [selectedPlanTypes, setSelectedPlanTypes] = useState<PlanType[]>([]);
  const [defaultRoleId, setDefaultRoleId] = useState<string>('');
  const [defaultAssigneeEmails, setDefaultAssigneeEmails] = useState<string[]>([]);
  const [dueInDays, setDueInDays] = useState('7');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sopUrl, setSopUrl] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskData[]>([]);
  const [selectedTemplateSetId, setSelectedTemplateSetId] = useState<string>('');

  // Template Set form state
  const [tsName, setTsName] = useState('');
  const [tsDescription, setTsDescription] = useState('');
  const [tsTriggerType, setTsTriggerType] = useState<TriggerType>('manual');
  const [tsTriggerRules, setTsTriggerRules] = useState<Record<string, unknown>>({});
  const [tsPlanTypes, setTsPlanTypes] = useState<PlanType[]>([]);
  const [tsActive, setTsActive] = useState(true);

  // Mutations
  const createTemplate = useMutation({
    mutationFn: templates.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      resetTemplateForm();
      setShowTemplateDialog(false);
      toast({ title: 'Template created' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskTemplate> }) =>
      templates.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      resetTemplateForm();
      setShowTemplateDialog(false);
      toast({ title: 'Template updated' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: templates.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast({ title: 'Template deleted' });
    },
  });

  const createTemplateSet = useMutation({
    mutationFn: templateSets.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      resetSetForm();
      setShowSetDialog(false);
      toast({ title: 'Template set created' });
    },
  });

  const updateTemplateSet = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateSet> }) =>
      templateSets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      resetSetForm();
      setShowSetDialog(false);
      toast({ title: 'Template set updated' });
    },
  });

  const deleteTemplateSet = useMutation({
    mutationFn: templateSets.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-sets'] });
      toast({ title: 'Template set deleted' });
    },
  });

  const triggerTemplateSet = useMutation({
    mutationFn: ({ setId, projectId }: { setId: string; projectId: string }) =>
      templateSets.trigger(setId, projectId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowApplyDialog(false);
      setApplyingSet(null);
      setSelectedProjectId('');
      toast({ title: `${data.tasksCreated} tasks created from template set` });
    },
    onError: (error: Error) => {
      toast({ title: error.message || 'Failed to apply template set', variant: 'destructive' });
    },
  });

  const openApplyDialog = (set: TemplateSet) => {
    setApplyingSet(set);
    setSelectedProjectId('');
    setShowApplyDialog(true);
  };

  const handleApplyTemplateSet = () => {
    if (!applyingSet || !selectedProjectId) {
      toast({ title: 'Please select a project', variant: 'destructive' });
      return;
    }
    triggerTemplateSet.mutate({ setId: applyingSet.id, projectId: selectedProjectId });
  };

  const resetTemplateForm = () => {
    setTitle('');
    setDescription('');
    setTemplateType('onboarding');
    setSelectedPlanTypes([]);
    setDefaultRoleId('');
    setDefaultAssigneeEmails([]);
    setDueInDays('7');
    setSelectedTags([]);
    setSopUrl('');
    setSubtasks([]);
    setSelectedTemplateSetId('');
    setEditingTemplate(null);
  };

  const resetSetForm = () => {
    setTsName('');
    setTsDescription('');
    setTsTriggerType('manual');
    setTsTriggerRules({});
    setTsPlanTypes([]);
    setTsActive(true);
    setEditingSet(null);
  };

  const openEditTemplateDialog = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setTitle(template.title);
    setDescription(template.description || '');
    setTemplateType(template.templateType);
    setSelectedPlanTypes(template.planTypes);
    setDefaultRoleId(template.defaultRoleId || '');
    setDefaultAssigneeEmails(template.defaultAssigneeEmails || []);
    setDueInDays(template.dueInDays.toString());
    setSelectedTags(template.tags);
    setSopUrl(template.sopUrl || '');
    setSubtasks(template.subtasks?.map(s => ({ title: s.title, sopUrl: s.sopUrl })) || []);
    setSelectedTemplateSetId(template.templateSetId || '');
    setShowTemplateDialog(true);
  };

  const openEditSetDialog = (set: TemplateSet) => {
    setEditingSet(set);
    setTsName(set.name);
    setTsDescription(set.description || '');
    setTsTriggerType(set.triggerType);
    setTsTriggerRules(set.triggerRules);
    setTsPlanTypes(set.planTypes);
    setTsActive(set.active);
    setShowSetDialog(true);
  };

  const handleTemplateSubmit = () => {
    if (!title || selectedPlanTypes.length === 0) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    const data = {
      title,
      description: description || undefined,
      templateType,
      planTypes: selectedPlanTypes,
      defaultRoleId: defaultRoleId || null,
      defaultAssigneeEmails: defaultAssigneeEmails.length > 0 ? defaultAssigneeEmails : undefined,
      dueInDays: parseInt(dueInDays),
      tags: selectedTags,
      sopUrl: sopUrl || undefined,
      subtasks: subtasks.filter(s => s.title.trim()).map(s => ({ title: s.title, sopUrl: s.sopUrl || undefined })),
      templateSetId: selectedTemplateSetId || undefined,
    };

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: data as any });
    } else {
      createTemplate.mutate(data as any);
    }
  };

  const handleSetSubmit = () => {
    if (!tsName) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }

    const data = {
      name: tsName,
      description: tsDescription || undefined,
      triggerType: tsTriggerType,
      triggerRules: tsTriggerRules,
      planTypes: tsPlanTypes,
      active: tsActive,
    };

    if (editingSet) {
      updateTemplateSet.mutate({ id: editingSet.id, data });
    } else {
      createTemplateSet.mutate(data);
    }
  };

  const togglePlanType = (planType: PlanType) => {
    setSelectedPlanTypes((prev) =>
      prev.includes(planType)
        ? prev.filter((p) => p !== planType)
        : [...prev, planType]
    );
  };

  const toggleSetPlanType = (planType: PlanType) => {
    setTsPlanTypes((prev) =>
      prev.includes(planType)
        ? prev.filter((p) => p !== planType)
        : [...prev, planType]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Apply plan type filter first, then split by template type
  const filteredTemplates = filterPlanType === 'all'
    ? allTemplates
    : allTemplates.filter((t) => t.planTypes.includes(filterPlanType));

  const onboardingTemplates = filteredTemplates.filter((t) => t.templateType === 'onboarding');
  const recurringTemplates = filteredTemplates.filter((t) => t.templateType === 'recurring');
  const customTemplates = filteredTemplates.filter((t) => t.templateType === 'custom');

  const headerActions = (
    <div className="flex items-center gap-2">
      {/* Plan Type Filter */}
      <Select value={filterPlanType} onValueChange={(v) => setFilterPlanType(v as PlanType | 'all')}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by plan..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Plan Types</SelectItem>
          {PLAN_TYPES.map((plan) => (
            <SelectItem key={plan.value} value={plan.value}>
              {plan.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* New Template Set Button */}
      <Dialog open={showSetDialog} onOpenChange={(open) => {
        setShowSetDialog(open);
        if (!open) resetSetForm();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Template Set
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle>
              {editingSet ? 'Edit Template Set' : 'Create Template Set'}
            </DialogTitle>
            <DialogDescription>
              Template sets group related templates and define when they should be triggered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto px-1 -mx-1">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={tsName}
                onChange={(e) => setTsName(e.target.value)}
                placeholder="e.g., Website Launch Checklist"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={tsDescription}
                onChange={(e) => setTsDescription(e.target.value)}
                placeholder="What is this template set for?"
                rows={2}
              />
            </div>

            <div className="space-y-2" data-guide="template-triggers">
              <Label>Trigger Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_TYPES.map((trigger) => {
                  const Icon = trigger.icon;
                  return (
                    <div
                      key={trigger.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        tsTriggerType === trigger.value
                          ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5'
                          : 'border-white/[0.08] hover:border-white/10'
                      )}
                      onClick={() => setTsTriggerType(trigger.value)}
                    >
                      <Icon className={cn(
                        'h-5 w-5 mt-0.5',
                        tsTriggerType === trigger.value ? 'text-[var(--theme-primary)]' : 'text-white/40'
                      )} />
                      <div>
                        <p className="text-sm font-medium">{trigger.label}</p>
                        <p className="text-xs text-white/60">{trigger.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trigger Rules based on type */}
            {tsTriggerType === 'new_project' && (
              <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg">
                <Label className="text-sm font-medium">Trigger Rules</Label>
                <p className="text-xs text-white/60">
                  Select which plan types should trigger this set when a project is created.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PLAN_TYPES.map((plan) => (
                    <Badge
                      key={plan.value}
                      variant={tsPlanTypes.includes(plan.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleSetPlanType(plan.value)}
                    >
                      {plan.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tsTriggerType === 'schedule' && (
              <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg">
                <Label className="text-sm font-medium">Schedule</Label>
                <p className="text-xs text-white/60">
                  Configure when this template set should run automatically.
                </p>
                <Select
                  value={(tsTriggerRules as any)?.schedule || 'monthly'}
                  onValueChange={(v) => setTsTriggerRules({ ...tsTriggerRules, schedule: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st)</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg">
              <div>
                <Label className="text-sm font-medium">Active</Label>
                <p className="text-xs text-white/60">Enable or disable this template set</p>
              </div>
              <Switch checked={tsActive} onCheckedChange={setTsActive} />
            </div>

            <Button onClick={handleSetSubmit} className="w-full">
              {editingSet ? 'Update Template Set' : 'Create Template Set'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Template Button */}
      <Dialog open={showTemplateDialog} onOpenChange={(open) => {
        setShowTemplateDialog(open);
        if (!open) resetTemplateForm();
      }}>
        <DialogTrigger asChild>
          <Button data-guide="create-template">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-2">
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto px-1 -mx-1">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={templateType} onValueChange={(v) => setTemplateType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="recurring">Recurring (Monthly)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Template Set</Label>
              <Select
                value={selectedTemplateSetId || 'none'}
                onValueChange={(v) => setSelectedTemplateSetId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (standalone template)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (standalone template)</SelectItem>
                  {allTemplateSets.map((set) => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-white/60">
                Assign to a template set to include in auto-triggers or manual application
              </p>
            </div>

            <div className="space-y-2">
              <Label>Plan Types *</Label>
              <div className="flex flex-wrap gap-2">
                {PLAN_TYPES.map((plan) => (
                  <Badge
                    key={plan.value}
                    variant={selectedPlanTypes.includes(plan.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => togglePlanType(plan.value)}
                  >
                    {plan.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select value={defaultRoleId || 'none'} onValueChange={(v) => setDefaultRoleId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {allRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: role.color }}
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-white/60">
                All contractors with this role will be automatically assigned to tasks created from this template
              </p>
            </div>

            <div className="space-y-2">
              <Label>Additional Assignees</Label>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                {allUsers.map((user) => (
                  <Badge
                    key={user.id}
                    className="cursor-pointer"
                    variant={defaultAssigneeEmails.includes(user.email) ? 'default' : 'outline'}
                    onClick={() => {
                      if (defaultAssigneeEmails.includes(user.email)) {
                        setDefaultAssigneeEmails(defaultAssigneeEmails.filter(e => e !== user.email));
                      } else {
                        setDefaultAssigneeEmails([...defaultAssigneeEmails, user.email]);
                      }
                    }}
                  >
                    {user.name}
                  </Badge>
                ))}
              </div>
              {defaultAssigneeEmails.length > 0 && (
                <p className="text-xs text-white/60">
                  {defaultAssigneeEmails.length} additional assignee{defaultAssigneeEmails.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Due in Days</Label>
              <Input
                type="number"
                min="1"
                value={dueInDays}
                onChange={(e) => setDueInDays(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.length === 0 ? (
                  <p className="text-sm text-white/60">
                    No tags available. Create tags in Settings &gt; Tag Management.
                  </p>
                ) : (
                  allTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className="cursor-pointer"
                      style={selectedTags.includes(tag.name) ? { backgroundColor: tag.color, color: '#fff' } : undefined}
                      variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                      onClick={() => toggleTag(tag.name)}
                    >
                      {tag.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>SOP URL</Label>
              <div className="flex gap-2">
                <Input
                  value={sopUrl}
                  onChange={(e) => setSopUrl(e.target.value)}
                  placeholder="https://docs.google.com/..."
                  className="flex-1"
                />
                {sopUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(sopUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-white/60">
                Link to a Google Doc or other SOP document for this template
              </p>
            </div>

            <SubtasksEditor subtasks={subtasks} setSubtasks={setSubtasks} />

            <Button onClick={handleTemplateSubmit} className="w-full">
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Task Templates"
        subtitle="Manage template sets and individual templates"
        actions={headerActions}
      />

      <div className="p-6">
        {/* Template Sets Section */}
        {allTemplateSets.length > 0 && (
          <div className="mb-6" data-guide="template-sets">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide mb-3">
              Template Sets
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTemplateSets.map((set) => {
                const triggerInfo = TRIGGER_TYPES.find((t) => t.value === set.triggerType);
                const Icon = triggerInfo?.icon || Settings2;
                return (
                  <Card key={set.id} className={cn(!set.active && 'opacity-60')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'p-2 rounded-lg',
                            set.active ? 'bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]' : 'bg-white/[0.06] text-white/40'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{set.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {triggerInfo?.label || set.triggerType}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {set.active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[var(--theme-primary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10"
                              onClick={() => openApplyDialog(set)}
                              title="Apply to Project"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {!set.isSystem && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSetDialog(set)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTemplateSet.mutate(set.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {set.description && (
                        <p className="text-sm text-white/60 mb-2">{set.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant={set.active ? 'default' : 'secondary'}>
                          {set._count?.templates || 0} templates
                        </Badge>
                        {set.planTypes.length > 0 && (
                          <div className="flex gap-1">
                            {set.planTypes.slice(0, 2).map((p) => (
                              <Badge key={p} variant="outline" className="text-xs">
                                {p.replace('_', ' ')}
                              </Badge>
                            ))}
                            {set.planTypes.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{set.planTypes.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Templates Tabs */}
        <Tabs defaultValue="onboarding">
          <TabsList>
            <TabsTrigger value="onboarding">
              Onboarding ({onboardingTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="recurring">
              Recurring ({recurringTemplates.length})
            </TabsTrigger>
            {customTemplates.length > 0 && (
              <TabsTrigger value="custom">
                Custom ({customTemplates.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="onboarding" className="mt-4 min-h-[300px]">
            <TemplateList
              templates={onboardingTemplates}
              onEdit={openEditTemplateDialog}
              onDelete={(id) => deleteTemplate.mutate(id)}
              allUsers={allUsers}
              allTags={allTags}
              allRoles={allRoles}
            />
          </TabsContent>

          <TabsContent value="recurring" className="mt-4 min-h-[300px]">
            <TemplateList
              templates={recurringTemplates}
              onEdit={openEditTemplateDialog}
              onDelete={(id) => deleteTemplate.mutate(id)}
              allUsers={allUsers}
              allTags={allTags}
              allRoles={allRoles}
            />
          </TabsContent>

          {customTemplates.length > 0 && (
            <TabsContent value="custom" className="mt-4 min-h-[300px]">
              <TemplateList
                templates={customTemplates}
                onEdit={openEditTemplateDialog}
                onDelete={(id) => deleteTemplate.mutate(id)}
                allUsers={allUsers}
                allTags={allTags}
                allRoles={allRoles}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Apply to Project Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={(open) => {
        setShowApplyDialog(open);
        if (!open) {
          setApplyingSet(null);
          setSelectedProjectId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Template Set to Project</DialogTitle>
            <DialogDescription>
              {applyingSet && (
                <>
                  Apply <strong>{applyingSet.name}</strong> to a project. This will create {applyingSet._count?.templates || 0} tasks.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Select Project *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {allProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <span>{project.name}</span>
                        {project.planType && (
                          <Badge variant="outline" className="text-xs">
                            {project.planType.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allProjects.length === 0 && (
                <p className="text-sm text-white/60">No projects available.</p>
              )}
            </div>

            {applyingSet && applyingSet.planTypes.length > 0 && selectedProjectId && (
              <div className="text-xs text-white/60 p-2 bg-white/[0.03] rounded">
                <strong>Note:</strong> This template set is configured for plan types:{' '}
                {applyingSet.planTypes.map(p => p.replace('_', ' ')).join(', ')}.
                Make sure the project's plan type matches.
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyTemplateSet}
                disabled={!selectedProjectId || triggerTemplateSet.isPending}
              >
                {triggerTemplateSet.isPending ? 'Applying...' : 'Apply Templates'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Store column widths outside component to persist across tab switches
const storedColumnWidths = {
  title: 250,
  planTypes: 180,
  assignee: 150,
  dueIn: 80,
  tags: 120,
  actions: 100,
};

// Column order for adjacent resize logic
const columnOrder = ['title', 'planTypes', 'assignee', 'dueIn', 'tags', 'actions'] as const;

function TemplateList({
  templates,
  onEdit,
  onDelete,
  allUsers,
  allTags,
  allRoles,
}: {
  templates: TaskTemplate[];
  onEdit: (t: TaskTemplate) => void;
  onDelete: (id: string) => void;
  allUsers: User[];
  allTags: Tag[];
  allRoles: Role[];
}) {
  const [columnWidths, setColumnWidths] = useState(storedColumnWidths);
  const [resizing, setResizing] = useState<string | null>(null);
  const startX = useRef(0);
  const startLeftWidth = useRef(0);
  const startRightWidth = useRef(0);
  const rightColumn = useRef<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent, column: string) => {
    e.preventDefault();
    const colIndex = columnOrder.indexOf(column as typeof columnOrder[number]);
    const nextCol = columnOrder[colIndex + 1];
    if (!nextCol) return; // Can't resize the last column

    setResizing(column);
    startX.current = e.clientX;
    startLeftWidth.current = columnWidths[column as keyof typeof columnWidths];
    startRightWidth.current = columnWidths[nextCol as keyof typeof columnWidths];
    rightColumn.current = nextCol;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing || !rightColumn.current) return;
      const diff = e.clientX - startX.current;

      // Calculate new widths - left column grows/shrinks, right column does opposite
      const newLeftWidth = Math.max(60, startLeftWidth.current + diff);
      const newRightWidth = Math.max(60, startRightWidth.current - diff);

      // Only apply if both columns stay above minimum
      if (newLeftWidth >= 60 && newRightWidth >= 60) {
        setColumnWidths(prev => {
          const updated = {
            ...prev,
            [resizing]: newLeftWidth,
            [rightColumn.current!]: newRightWidth
          };
          // Store widths for persistence
          Object.assign(storedColumnWidths, updated);
          return updated;
        });
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
      rightColumn.current = null;
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  if (templates.length === 0) {
    return (
      <div className="text-center text-white/60 py-8 bg-white/[0.06] rounded-lg border">
        No templates in this category
      </div>
    );
  }

  const ResizeHandle = ({ column }: { column: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 flex items-center cursor-col-resize group"
      onMouseDown={(e) => handleMouseDown(e, column)}
    >
      {/* Visible divider line */}
      <div className="w-px h-4 bg-white/40" />
      {/* Wider hover/drag area */}
      <div
        className={cn(
          "absolute -left-1 -right-1 top-0 bottom-0 transition-colors",
          resizing === column ? "bg-white/20" : "group-hover:bg-white/10"
        )}
      />
    </div>
  );

  return (
    <div className="bg-white/[0.06] rounded-lg border shadow-sm overflow-hidden">
      <table className="w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: columnWidths.title }} />
          <col style={{ width: columnWidths.planTypes }} />
          <col style={{ width: columnWidths.assignee }} />
          <col style={{ width: columnWidths.dueIn }} />
          <col style={{ width: columnWidths.tags }} />
          <col style={{ width: columnWidths.actions }} />
        </colgroup>
        <thead>
          <tr className="bg-[var(--theme-primary-dark)]">
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide relative">
              Title
              <ResizeHandle column="title" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide relative">
              Plan Types
              <ResizeHandle column="planTypes" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide relative">
              Role / Assignees
              <ResizeHandle column="assignee" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide relative">
              Due In
              <ResizeHandle column="dueIn" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide relative">
              Tags
              <ResizeHandle column="tags" />
            </th>
            <th className="text-center px-4 py-3 text-xs font-medium text-white uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr
              key={template.id}
              className="border-b last:border-b-0 hover:bg-white/[0.04] transition-colors"
            >
              <td className="px-4 py-3 overflow-hidden">
                <div>
                  <div className="flex items-center gap-2">
                    <span title={template.sopUrl ? "SOP Added" : "SOP Needed"}>
                      {template.sopUrl ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                      )}
                    </span>
                    <p className="font-medium text-sm truncate">{template.title}</p>
                    {template.sopUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[var(--theme-primary)] hover:text-[var(--theme-primary)] shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(template.sopUrl, '_blank');
                        }}
                        title="View SOP"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        SOP
                      </Button>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-xs text-white/60 truncate">
                      {template.description}
                    </p>
                  )}
                  {template.subtasks && template.subtasks.length > 0 && (
                    <div className="mt-1 text-xs text-white/60">
                      {template.subtasks.length} subtask{template.subtasks.length !== 1 ? 's' : ''}
                      {template.subtasks.some(s => s.sopUrl) && (
                        <span className="ml-1 text-[var(--theme-primary)]">
                          ({template.subtasks.filter(s => s.sopUrl).length} with SOP)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 overflow-hidden">
                <div className="flex flex-wrap gap-1">
                  {template.planTypes.map((plan) => (
                    <Badge key={plan} variant="outline" className="text-xs">
                      {plan.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-white/60 overflow-hidden">
                <div className="flex flex-wrap gap-1">
                  {template.defaultRoleId && (
                    (() => {
                      const role = allRoles.find(r => r.id === template.defaultRoleId);
                      return role ? (
                        <Badge
                          className="text-xs text-white"
                          style={{ backgroundColor: role.color }}
                        >
                          {role.name}
                        </Badge>
                      ) : null;
                    })()
                  )}
                  {template.defaultAssigneeEmails && template.defaultAssigneeEmails.length > 0 && (
                    template.defaultAssigneeEmails.map((email, i) => {
                      const user = allUsers.find(u => u.email === email);
                      return (
                        <Badge key={i} variant="outline" className="text-xs">
                          {user?.name || email.split('@')[0]}
                        </Badge>
                      );
                    })
                  )}
                  {!template.defaultRoleId && (!template.defaultAssigneeEmails || template.defaultAssigneeEmails.length === 0) && (
                    <span className="text-white/60">-</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-white/60">
                {template.dueInDays} days
              </td>
              <td className="px-4 py-3 overflow-hidden">
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tagName) => {
                    const tagData = allTags.find(t => t.name === tagName);
                    return (
                      <Badge
                        key={tagName}
                        style={tagData ? { backgroundColor: tagData.color, color: '#fff' } : undefined}
                        variant="secondary"
                      >
                        {tagName}
                      </Badge>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(template)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(template.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
