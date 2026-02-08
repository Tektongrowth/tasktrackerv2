import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { clientPortal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { TaskSubmissionForm } from '@/components/TaskSubmissionForm';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  LogOut,
  UserPlus,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const statusColors = {
  todo: 'bg-white/[0.06] text-white/90',
  in_review: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-green-500/15 text-green-400',
};

const statusIcons = {
  todo: ListTodo,
  in_review: Clock,
  completed: CheckCircle2,
};

function SubmissionsList() {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['client-submissions'],
    queryFn: clientPortal.listSubmissions,
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400',
    approved: 'bg-green-500/15 text-green-400',
    rejected: 'bg-red-500/15 text-red-400',
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-white/60">
          Loading submissions...
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Submissions</CardTitle>
        <CardDescription>
          Track the status of your task requests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {submissions.map((submission: any) => (
          <div
            key={submission.id}
            className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg"
          >
            <div>
              <p className="font-medium">{submission.title}</p>
              <p className="text-sm text-white/60">
                Submitted {formatDate(submission.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[submission.status]}>
                {submission.status}
              </Badge>
              {submission.status === 'approved' && submission.task && (
                <Badge variant="outline">
                  Task created
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ClientPortalDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddViewer, setShowAddViewer] = useState(false);
  const [viewerEmail, setViewerEmail] = useState('');
  const [viewerName, setViewerName] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-dashboard'],
    queryFn: clientPortal.dashboard,
  });

  const logout = useMutation({
    mutationFn: clientPortal.logout,
    onSuccess: () => {
      navigate('/client-portal');
    },
  });

  const addViewer = useMutation({
    mutationFn: () => clientPortal.addViewer({ email: viewerEmail, name: viewerName || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
      setShowAddViewer(false);
      setViewerEmail('');
      setViewerName('');
      toast({ title: 'Viewer added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const removeViewer = useMutation({
    mutationFn: clientPortal.removeViewer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
      toast({ title: 'Viewer removed' });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Session Expired</CardTitle>
            <CardDescription>
              Your access link has expired or is invalid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/client-portal')}>
              Request New Access Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { client, projects, viewers, stats } = data;

  return (
    <div className="min-h-screen bg-white/[0.03]">
      {/* Header */}
      <div className="bg-white/[0.06] border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{client.name}</h1>
              <p className="text-sm text-white/60">{client.email}</p>
            </div>
            <Button variant="outline" onClick={() => logout.mutate()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/[0.06] rounded-lg">
                  <ListTodo className="h-5 w-5 text-white/70" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todoTasks}</p>
                  <p className="text-sm text-white/60">To Do</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/15 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inReviewTasks}</p>
                  <p className="text-sm text-white/60">In Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/15 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completedTasks}</p>
                  <p className="text-sm text-white/60">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/15 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.upcomingDue}</p>
                  <p className="text-sm text-white/60">Due Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="projects">
          <TabsList>
            <TabsTrigger value="projects">Projects & Tasks</TabsTrigger>
            <TabsTrigger value="requests">Request a Task</TabsTrigger>
            <TabsTrigger value="access">Manage Access</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4 space-y-4">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Projects Yet</h3>
                  <p className="text-white/60">
                    Your projects will appear here once they're created.
                  </p>
                </CardContent>
              </Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <CardDescription>
                          {project.planType?.replace('_', ' ').toUpperCase()}
                        </CardDescription>
                      </div>
                      <Badge variant={project.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                        {project.subscriptionStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {project.tasks.length === 0 ? (
                      <p className="text-white/60 text-sm">No tasks for this project yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {project.tasks.map((task) => {
                          const StatusIcon = statusIcons[task.status];
                          const isOverdue =
                            task.dueDate &&
                            task.status !== 'completed' &&
                            new Date(task.dueDate) < new Date();

                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <StatusIcon
                                  className={cn(
                                    'h-5 w-5',
                                    task.status === 'completed' && 'text-green-400',
                                    task.status === 'in_review' && 'text-amber-400',
                                    task.status === 'todo' && 'text-white/40'
                                  )}
                                />
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    task.status === 'completed' && 'line-through text-white/60'
                                  )}>
                                    {task.title}
                                  </p>
                                  {task.dueDate && (
                                    <p className={cn(
                                      'text-xs',
                                      isOverdue ? 'text-red-400' : 'text-white/60'
                                    )}>
                                      Due: {new Date(task.dueDate).toLocaleDateString()}
                                      {isOverdue && ' (Overdue)'}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                <Badge className={statusColors[task.status]}>
                                  {task.status.replace('_', ' ')}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request a Task</CardTitle>
                <CardDescription>
                  Submit a task request and our team will review it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TaskSubmissionForm
                  projects={projects.map(p => ({ id: p.id, name: p.name }))}
                  clientEmail={client.email}
                />
              </CardContent>
            </Card>

            <SubmissionsList />
          </TabsContent>

          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Manage Access</CardTitle>
                    <CardDescription>
                      Add other team members who can view this dashboard
                    </CardDescription>
                  </div>
                  <Dialog open={showAddViewer} onOpenChange={setShowAddViewer}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Viewer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Viewer Access</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            placeholder="colleague@example.com"
                            value={viewerEmail}
                            onChange={(e) => setViewerEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Name (optional)</Label>
                          <Input
                            placeholder="John Doe"
                            value={viewerName}
                            onChange={(e) => setViewerName(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => addViewer.mutate()}
                          className="w-full"
                          disabled={addViewer.isPending || !viewerEmail}
                        >
                          {addViewer.isPending ? 'Adding...' : 'Add Viewer'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {viewers.length === 0 ? (
                  <p className="text-white/60 text-sm text-center py-8">
                    No additional viewers yet. Add team members to give them view-only access to this dashboard.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {viewers.map((viewer) => (
                      <div
                        key={viewer.id}
                        className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{viewer.name || viewer.email}</p>
                          {viewer.name && (
                            <p className="text-sm text-white/60">{viewer.email}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">View Only</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeViewer.mutate(viewer.id)}
                          >
                            <Trash2 className="h-4 w-4 text-white/60" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
