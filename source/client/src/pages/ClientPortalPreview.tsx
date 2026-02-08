import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  LogOut,
  UserPlus,
  Eye,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data for preview
const mockClient = {
  name: 'Acme Corporation',
  email: 'contact@acme.com',
};

const mockStats = {
  todoTasks: 5,
  inReviewTasks: 2,
  completedTasks: 12,
  upcomingDue: 3,
};

const mockProjects = [
  {
    id: '1',
    name: 'Website Redesign',
    planType: 'professional',
    subscriptionStatus: 'active',
    tasks: [
      { id: '1', title: 'Design homepage mockup', status: 'completed', dueDate: '2026-01-10', tags: ['design'] },
      { id: '2', title: 'Implement responsive navigation', status: 'in_review', dueDate: '2026-01-15', tags: ['development'] },
      { id: '3', title: 'Set up contact form', status: 'todo', dueDate: '2026-01-20', tags: ['development'] },
    ],
  },
  {
    id: '2',
    name: 'Marketing Campaign',
    planType: 'starter',
    subscriptionStatus: 'active',
    tasks: [
      { id: '4', title: 'Create social media graphics', status: 'todo', dueDate: '2026-01-18', tags: ['design'] },
      { id: '5', title: 'Write email copy', status: 'todo', dueDate: '2026-01-22', tags: ['content'] },
    ],
  },
];

const mockViewers = [
  { id: '1', name: 'John Smith', email: 'john@acme.com' },
  { id: '2', name: null, email: 'sarah@acme.com' },
];

const statusColors: Record<string, string> = {
  todo: 'bg-white/[0.06] text-white/90',
  in_review: 'bg-amber-500/15 text-amber-400',
  completed: 'bg-green-500/15 text-green-400',
};

const statusIcons: Record<string, typeof ListTodo> = {
  todo: ListTodo,
  in_review: Clock,
  completed: CheckCircle2,
};

export function ClientPortalPreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white/[0.03]">
      {/* Preview Banner */}
      <div className="bg-blue-600 text-white px-4 py-2" data-guide="preview-banner">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">Preview Mode - This is what your clients see</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white/[0.06] border-b" data-guide="client-header">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{mockClient.name}</h1>
              <p className="text-sm text-white/60">{mockClient.email}</p>
            </div>
            <Button variant="outline" disabled>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Info Card */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-400">About the Client Portal</p>
                <p className="text-sm text-blue-400 mt-1">
                  This is what your clients see when they access their portal. They can view project progress,
                  request new tasks, and manage who else on their team can view this dashboard.
                  Clients access this via a magic link sent to their email - no password required.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-guide="client-stats">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/[0.06] rounded-lg">
                  <ListTodo className="h-5 w-5 text-white/70" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{mockStats.todoTasks}</p>
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
                  <p className="text-2xl font-bold">{mockStats.inReviewTasks}</p>
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
                  <p className="text-2xl font-bold">{mockStats.completedTasks}</p>
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
                  <p className="text-2xl font-bold">{mockStats.upcomingDue}</p>
                  <p className="text-sm text-white/60">Due Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="projects" data-guide="client-tabs">
          <TabsList>
            <TabsTrigger value="projects" data-guide="client-projects-tab">Projects & Tasks</TabsTrigger>
            <TabsTrigger value="requests" data-guide="client-requests-tab">Request a Task</TabsTrigger>
            <TabsTrigger value="access" data-guide="client-access-tab">Manage Access</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4 space-y-4">
            {mockProjects.map((project) => (
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
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Request a Task</CardTitle>
                <CardDescription>
                  Clients can submit task requests here. You'll receive them in your Task Requests inbox for approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-8 text-center text-white/60">
                  <p>Task submission form appears here for clients</p>
                  <p className="text-sm mt-2">Requests go to your Task Requests page for review</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Manage Access</CardTitle>
                    <CardDescription>
                      Clients can invite others from their organization to view this dashboard
                    </CardDescription>
                  </div>
                  <Button disabled>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Viewer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockViewers.map((viewer) => (
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
                      <Badge variant="secondary">View Only</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
