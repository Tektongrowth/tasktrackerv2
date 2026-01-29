import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { support, BugReportData, FeatureRequestData } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bug, Lightbulb, Send, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HelpPage() {
  const [activeTab, setActiveTab] = useState<'bug' | 'feature'>('bug');
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [featureSubmitted, setFeatureSubmitted] = useState(false);

  const [bugFormData, setBugFormData] = useState({
    action: '',
    actual: '',
    errorMessage: '',
    steps: '',
    browser: '',
    device: '',
    urgency: 'annoying' as 'blocking' | 'annoying' | 'minor',
  });

  const [featureFormData, setFeatureFormData] = useState({
    title: '',
    description: '',
    useCase: '',
    priority: 'would_help' as 'nice_to_have' | 'would_help' | 'important',
  });

  const submitBugReport = useMutation({
    mutationFn: (data: BugReportData) => support.submitBugReport(data),
    onSuccess: () => {
      setBugSubmitted(true);
      toast({ title: 'Bug report submitted', description: 'Thank you! We\'ll look into this.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    },
  });

  const submitFeatureRequest = useMutation({
    mutationFn: (data: FeatureRequestData) => support.submitFeatureRequest(data),
    onSuccess: () => {
      setFeatureSubmitted(true);
      toast({ title: 'Feature request submitted', description: 'Thank you for your suggestion!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    },
  });

  const handleBugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitBugReport.mutate({
      ...bugFormData,
      errorMessage: bugFormData.errorMessage || undefined,
    });
  };

  const handleFeatureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitFeatureRequest.mutate(featureFormData);
  };

  const resetBugForm = () => {
    setBugSubmitted(false);
    setBugFormData({
      action: '',
      actual: '',
      errorMessage: '',
      steps: '',
      browser: '',
      device: '',
      urgency: 'annoying',
    });
  };

  const resetFeatureForm = () => {
    setFeatureSubmitted(false);
    setFeatureFormData({
      title: '',
      description: '',
      useCase: '',
      priority: 'would_help',
    });
  };

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'bug' | 'feature')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="bug" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Bug Report
          </TabsTrigger>
          <TabsTrigger value="feature" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Feature Request
          </TabsTrigger>
        </TabsList>

        {/* Bug Report Tab */}
        <TabsContent value="bug">
          {bugSubmitted ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Bug Report Submitted!</h2>
                  <p className="text-muted-foreground mb-6">
                    Thank you for reporting this issue. We'll investigate and get back to you if needed.
                  </p>
                  <Button onClick={resetBugForm}>Submit Another Report</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
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
                <form onSubmit={handleBugSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="action">What were you trying to do? *</Label>
                    <Textarea
                      id="action"
                      placeholder="e.g., I was trying to add a comment to a task"
                      value={bugFormData.action}
                      onChange={(e) => setBugFormData({ ...bugFormData, action: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="actual">What happened instead? *</Label>
                    <Textarea
                      id="actual"
                      placeholder="e.g., Got an error message and the comment didn't post"
                      value={bugFormData.actual}
                      onChange={(e) => setBugFormData({ ...bugFormData, actual: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="errorMessage">Error message (if any)</Label>
                    <Input
                      id="errorMessage"
                      placeholder="Copy/paste any error text you saw"
                      value={bugFormData.errorMessage}
                      onChange={(e) => setBugFormData({ ...bugFormData, errorMessage: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="steps">Steps to reproduce *</Label>
                    <Textarea
                      id="steps"
                      placeholder={"1. Go to...\n2. Click on...\n3. Then..."}
                      value={bugFormData.steps}
                      onChange={(e) => setBugFormData({ ...bugFormData, steps: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="browser">Browser *</Label>
                      <Select
                        value={bugFormData.browser}
                        onValueChange={(value) => setBugFormData({ ...bugFormData, browser: value })}
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
                        value={bugFormData.device}
                        onValueChange={(value) => setBugFormData({ ...bugFormData, device: value })}
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
                          onClick={() => setBugFormData({ ...bugFormData, urgency: option.value as 'blocking' | 'annoying' | 'minor' })}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                            bugFormData.urgency === option.value
                              ? 'border-primary bg-primary/5 ring-2 ring-primary'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                            bugFormData.urgency === option.value ? 'border-primary' : 'border-gray-300'
                          )}>
                            {bugFormData.urgency === option.value && (
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
                    disabled={submitBugReport.isPending || !bugFormData.action || !bugFormData.actual || !bugFormData.steps || !bugFormData.browser || !bugFormData.device}
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
          )}
        </TabsContent>

        {/* Feature Request Tab */}
        <TabsContent value="feature">
          {featureSubmitted ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Feature Request Submitted!</h2>
                  <p className="text-muted-foreground mb-6">
                    Thank you for your suggestion! We'll review it and consider it for future updates.
                  </p>
                  <Button onClick={resetFeatureForm}>Submit Another Request</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-6 w-6" />
                  Request a Feature
                </CardTitle>
                <CardDescription>
                  Have an idea for a new feature or improvement? We'd love to hear it!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFeatureSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Feature Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Add dark mode"
                      value={featureFormData.title}
                      onChange={(e) => setFeatureFormData({ ...featureFormData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Describe the feature *</Label>
                    <Textarea
                      id="description"
                      placeholder="What would this feature do? How should it work?"
                      value={featureFormData.description}
                      onChange={(e) => setFeatureFormData({ ...featureFormData, description: e.target.value })}
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="useCase">How would this help you? *</Label>
                    <Textarea
                      id="useCase"
                      placeholder="Describe a situation where this feature would be useful"
                      value={featureFormData.useCase}
                      onChange={(e) => setFeatureFormData({ ...featureFormData, useCase: e.target.value })}
                      rows={3}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>How important is this to you? *</Label>
                    <div className="flex flex-col gap-2">
                      {[
                        { value: 'important', label: 'Important', description: 'Would significantly improve my work', color: 'purple' },
                        { value: 'would_help', label: 'Would Help', description: 'Would make things easier', color: 'orange' },
                        { value: 'nice_to_have', label: 'Nice to Have', description: 'Just a thought', color: 'green' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFeatureFormData({ ...featureFormData, priority: option.value as 'nice_to_have' | 'would_help' | 'important' })}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                            featureFormData.priority === option.value
                              ? 'border-primary bg-primary/5 ring-2 ring-primary'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                            featureFormData.priority === option.value ? 'border-primary' : 'border-gray-300'
                          )}>
                            {featureFormData.priority === option.value && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <div>
                            <span className={cn(
                              'font-medium',
                              option.color === 'purple' && 'text-purple-600',
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
                    disabled={submitFeatureRequest.isPending || !featureFormData.title || !featureFormData.description || !featureFormData.useCase}
                  >
                    {submitFeatureRequest.isPending ? (
                      'Submitting...'
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Feature Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
