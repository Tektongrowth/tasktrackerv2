import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { support, BugReportData } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HelpPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    action: '',
    actual: '',
    errorMessage: '',
    steps: '',
    browser: '',
    device: '',
    urgency: 'annoying' as 'blocking' | 'annoying' | 'minor',
  });

  const submitBugReport = useMutation({
    mutationFn: (data: BugReportData) => support.submitBugReport(data),
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: 'Bug report submitted', description: 'Thank you! We\'ll look into this.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitBugReport.mutate({
      ...formData,
      errorMessage: formData.errorMessage || undefined,
    });
  };

  const resetForm = () => {
    setSubmitted(false);
    setFormData({
      action: '',
      actual: '',
      errorMessage: '',
      steps: '',
      browser: '',
      device: '',
      urgency: 'annoying',
    });
  };

  if (submitted) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Bug Report Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for reporting this issue. We'll investigate and get back to you if needed.
              </p>
              <Button onClick={resetForm}>Submit Another Report</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-6 w-6" />
            Report a Bug
          </CardTitle>
          <CardDescription>
            Found something that's not working correctly? Let us know and we'll fix it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* What were you trying to do */}
            <div className="space-y-2">
              <Label htmlFor="action">What were you trying to do? *</Label>
              <Textarea
                id="action"
                placeholder="e.g., I was trying to add a comment to a task"
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                required
              />
            </div>

            {/* What happened */}
            <div className="space-y-2">
              <Label htmlFor="actual">What happened instead? *</Label>
              <Textarea
                id="actual"
                placeholder="e.g., Got an error message and the comment didn't post"
                value={formData.actual}
                onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
                required
              />
            </div>

            {/* Error message */}
            <div className="space-y-2">
              <Label htmlFor="errorMessage">Error message (if any)</Label>
              <Input
                id="errorMessage"
                placeholder="Copy/paste any error text you saw"
                value={formData.errorMessage}
                onChange={(e) => setFormData({ ...formData, errorMessage: e.target.value })}
              />
            </div>

            {/* Steps to reproduce */}
            <div className="space-y-2">
              <Label htmlFor="steps">Steps to reproduce *</Label>
              <Textarea
                id="steps"
                placeholder={"1. Go to...\n2. Click on...\n3. Then..."}
                value={formData.steps}
                onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                rows={4}
                required
              />
            </div>

            {/* Browser and Device */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="browser">Browser *</Label>
                <Select
                  value={formData.browser}
                  onValueChange={(value) => setFormData({ ...formData, browser: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select browser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chrome">Chrome</SelectItem>
                    <SelectItem value="Safari">Safari</SelectItem>
                    <SelectItem value="Firefox">Firefox</SelectItem>
                    <SelectItem value="Edge">Edge</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="device">Device *</Label>
                <Select
                  value={formData.device}
                  onValueChange={(value) => setFormData({ ...formData, device: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Computer">Computer</SelectItem>
                    <SelectItem value="Phone">Phone</SelectItem>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Urgency */}
            <div className="space-y-3">
              <Label>How urgent is this? *</Label>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'blocking', label: 'Blocking', description: "I can't do my work", color: 'red' },
                  { value: 'annoying', label: 'Annoying', description: 'I can work around it', color: 'orange' },
                  { value: 'minor', label: 'Minor', description: 'Just noticed it', color: 'green' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, urgency: option.value as 'blocking' | 'annoying' | 'minor' })}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                      formData.urgency === option.value
                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      formData.urgency === option.value ? 'border-primary' : 'border-gray-300'
                    )}>
                      {formData.urgency === option.value && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div>
                      <span className={cn(
                        'font-medium',
                        option.color === 'red' && 'text-red-600',
                        option.color === 'orange' && 'text-orange-600',
                        option.color === 'green' && 'text-green-600'
                      )}>
                        {option.label}
                      </span>
                      <span className="text-muted-foreground"> - {option.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitBugReport.isPending || !formData.action || !formData.actual || !formData.steps || !formData.browser || !formData.device}
            >
              {submitBugReport.isPending ? (
                'Submitting...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Bug Report
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
