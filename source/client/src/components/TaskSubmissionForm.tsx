import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientPortal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { Send, Plus } from 'lucide-react';

interface TaskSubmissionFormProps {
  projects: Array<{ id: string; name: string }>;
  clientEmail?: string;
  onSuccess?: () => void;
}

export function TaskSubmissionForm({ projects, onSuccess }: TaskSubmissionFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [priority, setPriority] = useState<string>('medium');
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; projectId?: string; priority?: string }) =>
      clientPortal.submitTask(data),
    onSuccess: () => {
      toast({ title: 'Task request submitted', description: 'Your request has been sent for review.' });
      setTitle('');
      setDescription('');
      setProjectId('');
      setPriority('medium');
      setIsExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['client-submissions'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    submitMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      projectId: projectId || undefined,
      priority,
    });
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={() => setIsExpanded(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Request a new task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Request a Task</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
        >
          Cancel
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Task Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you need help with?"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide more details about your request..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {projects.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!title.trim() || submitMutation.isPending}>
        <Send className="h-4 w-4 mr-2" />
        {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
      </Button>
    </form>
  );
}
