import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCreateTask } from '@/hooks/useTasks';
import { projects as projectsApi, users as usersApi } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/UserAvatar';
import { toast } from '@/components/ui/toaster';
import { ListPlus } from 'lucide-react';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultProjectId?: string;
  /** Optional list of users for assignment (e.g. chat users). Falls back to full user list. */
  users?: { id: string; name: string; avatarUrl: string | null }[];
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultTitle = '',
  defaultDescription = '',
  defaultProjectId = '',
  users: externalUsers,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const createTask = useCreateTask();

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    enabled: open,
  });

  const { data: fetchedUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: open && !externalUsers,
  });

  const userList = externalUsers || (fetchedUsers?.filter(u => u.active && !u.archived).map(u => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl ?? null,
  })) ?? []);

  // Sync defaults when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setProjectId(defaultProjectId);
      setAssigneeIds([]);
    }
    onOpenChange(newOpen);
  };

  const handleCreate = () => {
    if (!title.trim() || !projectId) {
      toast({ title: 'Please enter a title and select a project', variant: 'destructive' });
      return;
    }

    createTask.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        projectId,
        status: 'todo',
        priority: 'medium',
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: 'Task created successfully' });
          onOpenChange(false);
          setTitle('');
          setDescription('');
          setProjectId('');
          setAssigneeIds([]);
        },
        onError: (error: Error) => {
          toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            Create Task
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="createTaskTitle">Task Title</Label>
            <Input
              id="createTaskTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="createTaskProject">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {allProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assign To</Label>
            <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
              {userList.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`create-task-assignee-${u.id}`}
                    checked={assigneeIds.includes(u.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setAssigneeIds(prev => [...prev, u.id]);
                      } else {
                        setAssigneeIds(prev => prev.filter(id => id !== u.id));
                      }
                    }}
                  />
                  <label
                    htmlFor={`create-task-assignee-${u.id}`}
                    className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                  >
                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                    {u.name}
                  </label>
                </div>
              ))}
              {userList.length === 0 && (
                <p className="text-sm text-white/60">No users available</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="createTaskDescription">Description</Label>
            <Textarea
              id="createTaskDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || !projectId || createTask.isPending}
            >
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
