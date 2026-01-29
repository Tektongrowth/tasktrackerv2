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
import { Bug, Lightbulb, Send, CheckCircle, BookOpen, MessageCircle, Bell, Reply, AtSign, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HelpPage() {
  const [activeTab, setActiveTab] = useState<'guides' | 'bug' | 'feature'>('guides');
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
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'guides' | 'bug' | 'feature')}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="guides" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Guides
          </TabsTrigger>
          <TabsTrigger value="bug" className="flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Bug Report
          </TabsTrigger>
          <TabsTrigger value="feature" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Feature Request
          </TabsTrigger>
        </TabsList>

        {/* Guides Tab */}
        <TabsContent value="guides">
          <div className="space-y-6">
            {/* Telegram Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-6 w-6 text-[#0088cc]" />
                  Telegram Notifications Guide
                </CardTitle>
                <CardDescription>
                  Get instant push notifications on your phone and reply to comments directly from Telegram
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Section 1: Getting Started */}
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Connecting Your Account
                  </h3>
                  <div className="pl-8 space-y-3 text-muted-foreground">
                    <p>To start receiving Telegram notifications:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Go to <strong className="text-foreground">My Settings</strong> (click your name in the sidebar)</li>
                      <li>Find the <strong className="text-foreground">Telegram Notifications</strong> section</li>
                      <li>Click <strong className="text-foreground">Connect Telegram</strong></li>
                      <li>Telegram will open - tap <strong className="text-foreground">Start</strong> to complete the connection</li>
                      <li>You'll see a confirmation message in Telegram when connected</li>
                    </ol>
                  </div>
                </section>

                {/* Section 2: What Notifications */}
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    What Notifications Will I Receive?
                  </h3>
                  <div className="pl-8 space-y-3 text-muted-foreground">
                    <p>Once connected, you'll receive Telegram notifications when:</p>
                    <ul className="space-y-2 ml-2">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span><strong className="text-foreground">Someone @mentions you</strong> in a task comment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span><strong className="text-foreground">You're assigned to a task</strong> (new tasks or when added as assignee)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span><strong className="text-foreground">Someone sends you a chat message</strong> (when you're offline)</span>
                      </li>
                    </ul>
                    <p className="mt-4 text-sm bg-muted p-3 rounded-lg">
                      Notifications include images and documents when attached to comments.
                    </p>
                  </div>
                </section>

                {/* Section 3: Replying */}
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Reply className="h-5 w-5 text-primary" />
                    Replying from Telegram
                  </h3>
                  <div className="pl-8 space-y-3 text-muted-foreground">
                    <p>You can reply to task comments directly from Telegram without opening the app:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li><strong className="text-foreground">Swipe left</strong> on the notification message (or long-press and tap Reply)</li>
                      <li>Type your response</li>
                      <li>Send it - your reply will appear as a comment on the task</li>
                    </ol>
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-2">Example:</p>
                      <div className="text-sm space-y-2">
                        <p className="bg-background p-2 rounded border">
                          <span className="font-medium">Notification:</span> Alice (@alice) mentioned you in "Fix login bug": "Hey @Bob can you check this?"
                        </p>
                        <p className="bg-background p-2 rounded border">
                          <span className="font-medium">Your reply:</span> "Looks good, I'll merge it"
                        </p>
                        <p className="text-muted-foreground">
                          → Creates comment: "@Alice Looks good, I'll merge it"
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 4: Mentioning Others */}
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AtSign className="h-5 w-5 text-primary" />
                    Mentioning Others in Replies
                  </h3>
                  <div className="pl-8 space-y-3 text-muted-foreground">
                    <p>By default, your reply automatically mentions the person who tagged you. To mention someone else instead:</p>
                    <ul className="space-y-2 ml-2">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Type <code className="bg-muted px-1 rounded">@name</code> at the start of your reply</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>Use first name or full name (case doesn't matter)</span>
                      </li>
                    </ul>
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-2">Examples:</p>
                      <ul className="text-sm space-y-1">
                        <li><code className="bg-background px-1 rounded">@mark can you help with this?</code> → Mentions Mark</li>
                        <li><code className="bg-background px-1 rounded">@Sarah Johnson approved!</code> → Mentions Sarah Johnson</li>
                      </ul>
                    </div>
                  </div>
                </section>

                {/* Section 5: Disconnecting */}
                <section>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Unlink className="h-5 w-5 text-primary" />
                    Disconnecting Telegram
                  </h3>
                  <div className="pl-8 space-y-3 text-muted-foreground">
                    <p>To stop receiving Telegram notifications:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                      <li>Go to <strong className="text-foreground">My Settings</strong></li>
                      <li>Click <strong className="text-foreground">Disconnect</strong> in the Telegram section</li>
                    </ol>
                    <p className="mt-2">You can reconnect at any time by clicking "Connect Telegram" again.</p>
                  </div>
                </section>

                {/* Tips */}
                <section className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                  <h3 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Tips</h3>
                  <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <li className="flex items-start gap-2">
                      <span>💡</span>
                      <span>Keep Telegram notifications enabled on your phone for instant alerts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>💡</span>
                      <span>Reply within 30 days - older notifications can't be replied to</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>💡</span>
                      <span>You can mute the bot in Telegram if you want to check messages manually</span>
                    </li>
                  </ul>
                </section>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
