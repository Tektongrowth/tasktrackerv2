import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Send } from 'lucide-react';

interface EmbedData {
  clientName: string;
  projects: { id: string; name: string }[];
}

export function EmbedSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitterName, setSubmitterName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Fetch client data
  const { data, isLoading, error } = useQuery<EmbedData>({
    queryKey: ['embed', token],
    queryFn: async () => {
      const res = await fetch(`/api/embed/${token}`);
      if (!res.ok) {
        throw new Error('Invalid or expired link');
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/embed/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          projectId: projectId || undefined,
          priority,
          submitterName: submitterName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      setTitle('');
      setDescription('');
      setProjectId('');
      setPriority('medium');
      setSubmitterName('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    submitMutation.mutate();
  };

  const resetForm = () => {
    setSubmitted(false);
    submitMutation.reset();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--theme-accent)]" />
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Invalid Link</h2>
          <p className="text-slate-600 text-sm">This submission link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Request Submitted!</h2>
          <p className="text-slate-600 mb-6">
            Your task request has been submitted and will be reviewed shortly.
          </p>
          <Button onClick={resetForm} variant="outline">
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col">
      <div className="max-w-lg mx-auto w-full flex-1">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Submit a Ticket</h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit a ticket for {data.clientName}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          {/* Your Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Your Name (optional)</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
            />
          </div>

          {/* Project Selection */}
          {data.projects.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="project" className="text-sm">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {data.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm">
              Task Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Brief description of what you need"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm">Details</Label>
            <Textarea
              id="description"
              placeholder="Provide any additional details, requirements, or context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority" className="text-sm">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {submitMutation.error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {(submitMutation.error as Error).message}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-[var(--theme-accent)] hover:bg-[var(--theme-primary)]"
            disabled={submitMutation.isPending || !title.trim()}
          >
            {submitMutation.isPending ? (
              'Submitting...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 mt-4">
        Powered by Task Tracker
      </p>
    </div>
  );
}
