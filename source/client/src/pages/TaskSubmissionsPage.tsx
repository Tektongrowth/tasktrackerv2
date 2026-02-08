import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskSubmissions, projects as projectsApi, users } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { useConfirm } from '@/components/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import { Check, X, Clock, Building2, User, Calendar, Filter } from 'lucide-react';
import type { TaskSubmission, Project, User as UserType } from '@/lib/types';

export function TaskSubmissionsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TaskSubmission | null>(null);
  const [approveData, setApproveData] = useState({ projectId: '', assigneeId: '', dueDate: '' });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['task-submissions', statusFilter],
    queryFn: () => taskSubmissions.list(statusFilter || undefined),
  });

  const { data: projectList = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data: userList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => taskSubmissions.approve(id, data),
    onSuccess: () => {
      toast({ title: 'Task created', description: 'The task request has been approved.' });
      queryClient.invalidateQueries({ queryKey: ['task-submissions'] });
      setApproveDialogOpen(false);
      setSelectedSubmission(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => taskSubmissions.reject(id),
    onSuccess: () => {
      toast({ title: 'Request rejected' });
      queryClient.invalidateQueries({ queryKey: ['task-submissions'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const openApproveDialog = (submission: TaskSubmission) => {
    setSelectedSubmission(submission);
    setApproveData({
      projectId: submission.projectId || '',
      assigneeId: '',
      dueDate: '',
    });
    setApproveDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedSubmission) return;
    approveMutation.mutate({
      id: selectedSubmission.id,
      data: {
        projectId: approveData.projectId || undefined,
        assigneeIds: approveData.assigneeId ? [approveData.assigneeId] : undefined,
        dueDate: approveData.dueDate || undefined,
      },
    });
  };

  const handleReject = async (id: string) => {
    const confirmed = await confirm({
      title: 'Reject Request',
      description: 'Are you sure you want to reject this task request? This action cannot be undone.',
      confirmText: 'Reject',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (confirmed) {
      rejectMutation.mutate(id);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400',
    approved: 'bg-green-500/15 text-green-400',
    rejected: 'bg-red-500/15 text-red-400',
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-white/[0.06] text-white/80',
    medium: 'bg-blue-500/15 text-blue-400',
    high: 'bg-orange-500/15 text-orange-400',
    urgent: 'bg-red-500/15 text-red-400',
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-white/60" />
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Filter by status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Task Requests"
        subtitle="Review and approve client task submissions"
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
      {isLoading ? (
        <div className="text-center py-8 text-white/60">Loading...</div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-white/60">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No task requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-guide="submissions-list">
          {submissions.map((submission: TaskSubmission) => (
            <Card key={submission.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{submission.title}</CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {submission.client?.name || 'Unknown client'}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span data-sensitive>{submission.submittedBy}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(submission.createdAt)}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {submission.priority && (
                      <Badge className={priorityColors[submission.priority]}>
                        {submission.priority}
                      </Badge>
                    )}
                    <Badge className={statusColors[submission.status]}>
                      {submission.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {submission.description && (
                  <p className="text-sm text-white/60 mb-4">{submission.description}</p>
                )}

                {submission.project && (
                  <p className="text-sm mb-4">
                    <span className="font-medium">Project:</span> {submission.project.name}
                  </p>
                )}

                {submission.status === 'pending' && (
                  <div className="flex items-center gap-2" data-guide="submission-actions">
                    <Button size="sm" onClick={() => openApproveDialog(submission)}>
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => handleReject(submission.id)}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {submission.status === 'approved' && submission.task && (
                  <p className="text-sm text-green-400">
                    Task created: {submission.task.title}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Task Request</DialogTitle>
            <DialogDescription>
              Create a task from this request and assign it to a team member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={approveData.projectId} onValueChange={(v) => setApproveData(d => ({ ...d, projectId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projectList.map((project: Project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.client?.name} / {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={approveData.assigneeId || 'unassigned'} onValueChange={(v) => setApproveData(d => ({ ...d, assigneeId: v === 'unassigned' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {userList.map((user: UserType) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={approveData.dueDate}
                onChange={(e) => setApproveData(d => ({ ...d, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!approveData.projectId || approveMutation.isPending}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
