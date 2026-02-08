import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users, tags as tagsApi, roles as rolesApi, clients as clientsApi, projects as projectsApi, projectAccess as projectAccessApi, auditLogs, backups, emailTemplates, EmailTemplates, settings } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, UserPlus, Mail, Trash2, Pencil, Shield, Eye, Edit2, History, Database, RefreshCw, Copy, Code, ExternalLink, Users, Archive, RotateCcw, ChevronDown, ChevronRight, Send, Palette, RotateCw, Image, ImagePlus, X, Upload, CheckCircle, AlertCircle, CreditCard } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { ThemeSettings, availableFonts, defaultTheme } from '@/lib/theme';
import { toast } from '@/components/ui/toaster';
import { useConfirm } from '@/components/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { UserAvatar } from '@/components/UserAvatar';
import { cn, formatDate } from '@/lib/utils';
import type { AccessLevel } from '@/lib/types';

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, entityTypeFilter],
    queryFn: () => auditLogs.list({ page, action: actionFilter || undefined, entityType: entityTypeFilter || undefined }),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: auditLogs.getActions,
  });

  const { data: entityTypes = [] } = useQuery({
    queryKey: ['audit-log-entity-types'],
    queryFn: auditLogs.getEntityTypes,
  });

  const formatAction = (action: string) => {
    return action.replace(/\./g, ' ').replace(/_/g, ' ');
  };

  return (
    <TabsContent value="audit" className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Audit Log</h2>
          <p className="text-sm text-white/60">Track all system actions and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((action: string) => (
                <SelectItem key={action} value={action}>
                  {formatAction(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {entityTypes.map((type: string) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-8 text-white/60">Loading...</div>
          ) : !data?.logs?.length ? (
            <div className="text-center py-8 text-white/60">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.logs.map((log: any) => (
                <div key={log.id} className="p-4 hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.entityType}</Badge>
                        <span className="font-medium capitalize">{formatAction(log.action)}</span>
                      </div>
                      <p className="text-sm text-white/60">
                        {log.user?.name || 'System'} • {formatDate(log.createdAt)}
                      </p>
                      {log.details && (
                        <p className="text-xs text-white/60 font-mono bg-white/[0.06] p-2 rounded mt-2">
                          {JSON.stringify(log.details, null, 2).slice(0, 200)}
                          {JSON.stringify(log.details).length > 200 && '...'}
                        </p>
                      )}
                    </div>
                    {log.entityIds?.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {log.entityIds.length} item{log.entityIds.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-white/60">
            Page {page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </TabsContent>
  );
}

function BackupsTab() {
  const queryClient = useQueryClient();

  const { data: backupList = [], isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: backups.list,
  });

  const { data: stats } = useQuery({
    queryKey: ['backup-stats'],
    queryFn: backups.getStats,
  });

  const triggerBackup = useMutation({
    mutationFn: backups.trigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
      toast({ title: 'Backup created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteBackup = useMutation({
    mutationFn: backups.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
      toast({ title: 'Backup deleted' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <TabsContent value="backups" className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Database Backups</h2>
          <p className="text-sm text-white/60">Automatic daily backups at 2 AM UTC</p>
        </div>
        <Button onClick={() => triggerBackup.mutate()} disabled={triggerBackup.isPending}>
          {triggerBackup.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Create Backup
            </>
          )}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.totalBackups}</div>
              <p className="text-sm text-white/60">Total Backups</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes || 0)}</div>
              <p className="text-sm text-white/60">Total Size</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {stats.lastBackupAt ? formatDate(stats.lastBackupAt) : 'Never'}
              </div>
              <p className="text-sm text-white/60">Last Backup</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup History</CardTitle>
          <CardDescription>Backups are automatically deleted after 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-white/60">Loading...</div>
          ) : backupList.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backups yet</p>
              <p className="text-sm">Create a manual backup or wait for the daily scheduled backup.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backupList.map((backup: any) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-white/60" />
                    <div>
                      <p className="font-medium text-sm">{backup.filename}</p>
                      <p className="text-xs text-white/60">
                        {formatDate(backup.createdAt)} • {formatBytes(backup.sizeBytes)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {backup.expiresAt && (
                      <span className="text-xs text-white/60">
                        Expires: {formatDate(backup.expiresAt)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-transparent"
                      onClick={() => deleteBackup.mutate(backup.id)}
                      disabled={deleteBackup.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function StripeConfigTab() {
  const { data: stripePrices, isLoading } = useQuery({
    queryKey: ['stripe-prices'],
    queryFn: settings.getStripePrices,
  });

  const { data: webhookInfo } = useQuery({
    queryKey: ['webhook-url'],
    queryFn: settings.getWebhookUrl,
  });

  const webhookUrl = webhookInfo?.url || 'Loading...';

  const testConnection = useMutation({
    mutationFn: settings.testStripeConnection,
    onSuccess: (data) => {
      toast({ title: data.message });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  return (
    <TabsContent value="stripe" className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Configuration
          </CardTitle>
          <CardDescription>
            Configure your Stripe integration for automatic client and project creation when customers subscribe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                data-sensitive
              />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: 'Copied to clipboard' });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-white/60">
              Add this URL to your Stripe webhook settings.
            </p>
          </div>

          {/* Required Events */}
          <div className="space-y-2">
            <Label>Required Webhook Events</Label>
            <div className="text-sm text-white/60 space-y-1 bg-white/[0.04] p-3 rounded-md font-mono">
              <p>customer.subscription.created</p>
              <p>customer.subscription.updated</p>
              <p>customer.subscription.deleted</p>
              <p>invoice.paid</p>
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Test Stripe Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Price to Plan Mappings</span>
            {stripePrices && (
              <Badge variant={stripePrices.summary.missing > 0 ? 'destructive' : 'default'}>
                {stripePrices.summary.configured} / {stripePrices.summary.total} configured
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Map your Stripe price IDs to plan types. Set these in your environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-white/60">Loading...</div>
          ) : (
            <div className="space-y-3">
              {stripePrices?.prices.map((price) => (
                <div
                  key={price.envVar}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-md border',
                    price.isConfigured ? 'border-green-500/20 bg-green-500/10' : 'border-amber-500/20 bg-amber-500/10'
                  )}
                >
                  <div className="space-y-1">
                    <div className="font-medium">{price.label}</div>
                    <div className="text-sm text-white/60 font-mono">{price.envVar}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {price.isConfigured ? (
                      <>
                        <code className="text-xs bg-white/[0.06] px-2 py-1 rounded border">
                          {price.priceId?.slice(0, 20)}...
                        </code>
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-amber-400">Not configured</span>
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-white/[0.04] rounded-md">
            <p className="text-sm text-white/60">
              <strong>How to configure:</strong> Add these environment variables to your deployment:
            </p>
            <pre className="mt-2 text-xs bg-white/[0.06] p-2 rounded border border-white/[0.08] overflow-x-auto text-white/70">
{`STRIPE_PRICE_PACKAGE_ONE=price_xxx      # Package 1
STRIPE_PRICE_PACKAGE_TWO=price_xxx      # Package 2
STRIPE_PRICE_PACKAGE_THREE=price_xxx    # Package 3
STRIPE_PRICE_PACKAGE_FOUR=price_xxx     # Package 4
STRIPE_PRICE_FACEBOOK_ADS=price_xxx     # Facebook Ads Add-on
STRIPE_PRICE_CUSTOM_WEBSITE=price_xxx   # Custom Website Add-on`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function EmailTemplatesTab() {
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: emailTemplates.get,
  });

  const [welcomeSubject, setWelcomeSubject] = useState('');
  const [welcomeHeading, setWelcomeHeading] = useState('');
  const [welcomeBody, setWelcomeBody] = useState('');
  const [welcomeButtonText, setWelcomeButtonText] = useState('');
  const [welcomeFooter, setWelcomeFooter] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form when data loads
  useState(() => {
    if (templates?.welcome) {
      setWelcomeSubject(templates.welcome.subject);
      setWelcomeHeading(templates.welcome.heading);
      setWelcomeBody(templates.welcome.body);
      setWelcomeButtonText(templates.welcome.buttonText);
      setWelcomeFooter(templates.welcome.footer);
    }
  });

  // Update form when templates change
  if (templates?.welcome && !hasChanges) {
    if (welcomeSubject !== templates.welcome.subject) {
      setWelcomeSubject(templates.welcome.subject);
      setWelcomeHeading(templates.welcome.heading);
      setWelcomeBody(templates.welcome.body);
      setWelcomeButtonText(templates.welcome.buttonText);
      setWelcomeFooter(templates.welcome.footer);
    }
  }

  const updateTemplates = useMutation({
    mutationFn: (data: Partial<EmailTemplates>) => emailTemplates.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast({ title: 'Email template saved' });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: 'Failed to save template', variant: 'destructive' });
    },
  });

  const resetTemplates = useMutation({
    mutationFn: emailTemplates.reset,
    onSuccess: (data) => {
      queryClient.setQueryData(['email-templates'], data);
      setWelcomeSubject(data.welcome.subject);
      setWelcomeHeading(data.welcome.heading);
      setWelcomeBody(data.welcome.body);
      setWelcomeButtonText(data.welcome.buttonText);
      setWelcomeFooter(data.welcome.footer);
      toast({ title: 'Templates reset to defaults' });
      setHasChanges(false);
    },
  });

  const handleSave = () => {
    updateTemplates.mutate({
      welcome: {
        subject: welcomeSubject,
        heading: welcomeHeading,
        body: welcomeBody,
        buttonText: welcomeButtonText,
        footer: welcomeFooter,
      },
    });
  };

  const handleFieldChange = (setter: (value: string) => void) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <TabsContent value="emails" className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-white">Email Templates</h2>
          <p className="text-sm text-white/60">Customize the emails sent by the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => resetTemplates.mutate()}
            disabled={resetTemplates.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTemplates.isPending || !hasChanges}
          >
            {updateTemplates.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card data-guide="welcome-email-settings">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--theme-primary)]" />
            <CardTitle>Welcome Email</CardTitle>
          </div>
          <CardDescription>
            This email is sent when inviting new contractors to join the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-white/60">Loading...</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input
                  value={welcomeSubject}
                  onChange={handleFieldChange(setWelcomeSubject)}
                  placeholder="Welcome to Task Tracker!"
                />
              </div>

              <div className="space-y-2">
                <Label>Heading</Label>
                <Input
                  value={welcomeHeading}
                  onChange={handleFieldChange(setWelcomeHeading)}
                  placeholder="Welcome to the team!"
                />
                <p className="text-xs text-white/60">The main heading shown in the email</p>
              </div>

              <div className="space-y-2">
                <Label>Body Text</Label>
                <Textarea
                  value={welcomeBody}
                  onChange={handleFieldChange(setWelcomeBody)}
                  placeholder="You have been invited to join..."
                  rows={4}
                />
                <p className="text-xs text-white/60">The main message explaining the invitation</p>
              </div>

              <div className="space-y-2">
                <Label>Button Text</Label>
                <Input
                  value={welcomeButtonText}
                  onChange={handleFieldChange(setWelcomeButtonText)}
                  placeholder="Complete Setup"
                />
                <p className="text-xs text-white/60">Text shown on the call-to-action button</p>
              </div>

              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Textarea
                  value={welcomeFooter}
                  onChange={handleFieldChange(setWelcomeFooter)}
                  placeholder="If you have any questions..."
                  rows={2}
                />
                <p className="text-xs text-white/60">Additional text shown at the bottom of the email</p>
              </div>

              {/* Email Preview */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview
                </h4>
                <div className="bg-white/[0.03] rounded-lg p-6 border">
                  <div className="bg-white/[0.06] rounded-lg shadow-sm p-6 max-w-md mx-auto">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-white mb-3">{welcomeHeading || 'Welcome!'}</h2>
                      <p className="text-white/70 text-sm mb-4 whitespace-pre-wrap">{welcomeBody || 'You have been invited...'}</p>
                      <button className="bg-[var(--theme-primary)] text-white px-6 py-2 rounded-md text-sm font-medium mb-4">
                        {welcomeButtonText || 'Complete Setup'}
                      </button>
                      <p className="text-xs text-white/40 whitespace-pre-wrap">{welcomeFooter || 'Contact us if you need help.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.list,
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data: allProjectAccess = [] } = useQuery({
    queryKey: ['project-access'],
    queryFn: () => projectAccessApi.list(),
  });

  // Invite user state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AccessLevel>('editor');
  const [inviteProjectIds, setInviteProjectIds] = useState<string[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Initialize invite projects when dialog opens or projects change
  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteRole('editor');
    setInviteProjectIds(allProjects.map(p => p.id));
  };

  // Edit user state
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; email: string; googleId?: string; jobRoleId?: string | null } | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobRoleId, setEditJobRoleId] = useState<string | undefined>(undefined);

  // Archived contractors toggle
  const [showArchived, setShowArchived] = useState(false);

  // Tag state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3182ce');
  const [showTagDialog, setShowTagDialog] = useState(false);

  // Role state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3182ce');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  // Contractor invite role state
  const [inviteJobRoleId, setInviteJobRoleId] = useState<string | undefined>(undefined);

  // Client state
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<{ id: string; name: string; email?: string; phone?: string; ghlLocationId?: string; gbpLocationId?: string; googleAdsCustomerId?: string } | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientGhlLocationId, setClientGhlLocationId] = useState('');
  const [clientGbpLocationId, setClientGbpLocationId] = useState('');
  const [clientGoogleAdsCustomerId, setClientGoogleAdsCustomerId] = useState('');

  // Viewer state
  const [showViewersDialog, setShowViewersDialog] = useState(false);
  const [viewersClientId, setViewersClientId] = useState<string | null>(null);
  const [viewersClientName, setViewersClientName] = useState('');
  const [newViewerEmail, setNewViewerEmail] = useState('');
  const [newViewerName, setNewViewerName] = useState('');

  // Project state
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; clientId: string; planType?: string; subscriptionStatus?: string } | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectClientId, setProjectClientId] = useState('');
  const [projectPlanType, setPlanType] = useState('package_one');
  const [projectStatus, setProjectStatus] = useState('active');

  // Upgrade state
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradingProject, setUpgradingProject] = useState<{ id: string; name: string; planType?: string } | null>(null);
  const [upgradePlanType, setUpgradePlanType] = useState('');

  // Offboard state
  const [showOffboardDialog, setShowOffboardDialog] = useState(false);
  const [offboardingProject, setOffboardingProject] = useState<{ id: string; name: string; clientName?: string } | null>(null);

  // Permissions state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Theme/Appearance state
  const { theme, updateTheme, resetTheme, isUpdating, isResetting } = useTheme();
  const [localTheme, setLocalTheme] = useState<ThemeSettings | null>(null);

  // Initialize local theme when theme loads
  const effectiveTheme = localTheme || theme || defaultTheme;

  const handleThemeChange = (path: string[], value: string) => {
    // Deep clone to avoid mutation issues with nested objects
    const newTheme = JSON.parse(JSON.stringify(effectiveTheme)) as ThemeSettings;

    // Ensure branding object exists
    if (!newTheme.branding) {
      newTheme.branding = { logoUrl: '', backgroundImage: '', backgroundColor: '' };
    }

    let current: any = newTheme;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setLocalTheme(newTheme);
    updateTheme(newTheme);
  };

  const handleResetTheme = () => {
    setLocalTheme(null);
    resetTheme();
  };

  const inviteUser = useMutation({
    mutationFn: async (data: { email: string; name?: string; accessLevel: AccessLevel; projectIds: string[]; jobRoleId?: string }) => {
      // First create the user with job role
      const newUser = await users.invite({ email: data.email, name: data.name, jobRoleId: data.jobRoleId });

      // Update their access level
      await users.update(newUser.id, { accessLevel: data.accessLevel });

      // Create project access for each selected project
      for (const projectId of data.projectIds) {
        await projectAccessApi.create({
          userId: newUser.id,
          projectId,
          canView: true,
          canEdit: true,
          canDelete: false,
        });
      }

      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['project-access'] });
      resetInviteForm();
      setShowInviteDialog(false);
      toast({ title: 'Invitation sent' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => users.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update user', description: error.message, variant: 'destructive' });
    },
  });

  const archiveUser = useMutation({
    mutationFn: users.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Contractor archived. Their tasks have been unassigned.' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const unarchiveUser = useMutation({
    mutationFn: users.unarchive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Contractor restored' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const deleteUser = useMutation({
    mutationFn: users.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Contractor permanently deleted' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const resendInvite = useMutation({
    mutationFn: users.resendInvite,
    onSuccess: () => {
      toast({ title: 'Invitation resent' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const createTag = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      setNewTagColor('#3182ce');
      setShowTagDialog(false);
      toast({ title: 'Tag created' });
    },
  });

  const deleteTag = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast({ title: 'Tag deleted' });
    },
  });

  // Role mutations
  const createRole = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setNewRoleName('');
      setNewRoleColor('#3182ce');
      setNewRoleDescription('');
      setShowRoleDialog(false);
      toast({ title: 'Role created' });
    },
  });

  const deleteRole = useMutation({
    mutationFn: rolesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Role deleted' });
    },
  });

  // Client mutations
  const createClient = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetClientForm();
      setShowClientDialog(false);
      toast({ title: 'Client created' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const updateClient = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; email?: string; phone?: string; ghlLocationId?: string; gbpLocationId?: string; googleAdsCustomerId?: string } }) =>
      clientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingClient(null);
      toast({ title: 'Client updated' });
    },
  });

  const deleteClient = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast({ title: 'Client deleted' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Viewer queries and mutations
  const { data: clientViewers = [], isLoading: viewersLoading } = useQuery({
    queryKey: ['client-viewers', viewersClientId],
    queryFn: () => clientsApi.listViewers(viewersClientId!),
    enabled: !!viewersClientId,
  });

  const addViewer = useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: { email: string; name?: string } }) =>
      clientsApi.addViewer(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-viewers', viewersClientId] });
      setNewViewerEmail('');
      setNewViewerName('');
      toast({ title: 'Viewer added' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const removeViewer = useMutation({
    mutationFn: ({ clientId, viewerId }: { clientId: string; viewerId: string }) =>
      clientsApi.removeViewer(clientId, viewerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-viewers', viewersClientId] });
      toast({ title: 'Viewer removed' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Project mutations
  const createProject = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      resetProjectForm();
      setShowProjectDialog(false);
      toast({ title: 'Project created' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; planType?: string; subscriptionStatus?: string } }) =>
      projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingProject(null);
      toast({ title: 'Project updated' });
    },
  });

  const deleteProject = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Project deleted' });
    },
  });

  const upgradeProject = useMutation({
    mutationFn: ({ id, planType }: { id: string; planType: string }) => projectsApi.upgrade(id, planType),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowUpgradeDialog(false);
      setUpgradingProject(null);
      setUpgradePlanType('');
      toast({
        title: 'Package upgraded successfully',
        description: `Created ${result.tasksCreated} new tasks (${result.skippedDuplicates} duplicates skipped)`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Upgrade failed', description: error.message, variant: 'destructive' });
    },
  });

  const offboardProjectMutation = useMutation({
    mutationFn: (id: string) => projectsApi.offboard(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowOffboardDialog(false);
      setOffboardingProject(null);
      toast({
        title: 'Project offboarded',
        description: `Created ${result.tasksCreated} offboarding tasks (${result.skippedDuplicates} duplicates skipped). Status changed to canceled.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Offboard failed', description: error.message, variant: 'destructive' });
    },
  });

  // Project access mutations with optimistic updates
  const updateProjectAccess = useMutation({
    mutationFn: (data: { userId: string; projectId: string; canView: boolean; canEdit: boolean; canDelete: boolean }) => {
      return projectAccessApi.create(data);
    },
    onMutate: async (newAccess) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['project-access'] });

      // Snapshot the previous value
      const previousAccess = queryClient.getQueryData(['project-access']);

      // Optimistically update - add or update the access entry
      queryClient.setQueryData(['project-access'], (old: any[] = []) => {
        const existingIndex = old.findIndex(
          (pa) => pa.userId === newAccess.userId && pa.projectId === newAccess.projectId
        );
        if (existingIndex >= 0) {
          // Update existing
          const updated = [...old];
          updated[existingIndex] = { ...updated[existingIndex], ...newAccess };
          return updated;
        } else {
          // Add new (with temporary ID)
          return [...old, { id: `temp-${Date.now()}`, ...newAccess }];
        }
      });

      return { previousAccess };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-access'] });
      toast({ title: 'Project access updated' });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousAccess) {
        queryClient.setQueryData(['project-access'], context.previousAccess);
      }
      toast({ title: error.message || 'Failed to update access', variant: 'destructive' });
    },
  });

  const deleteProjectAccess = useMutation({
    mutationFn: ({ userId, projectId }: { userId: string; projectId: string }) => {
      return projectAccessApi.deleteUserProject(userId, projectId);
    },
    onMutate: async ({ userId, projectId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['project-access'] });

      // Snapshot the previous value
      const previousAccess = queryClient.getQueryData(['project-access']);

      // Optimistically remove the access entry
      queryClient.setQueryData(['project-access'], (old: any[] = []) => {
        return old.filter((pa) => !(pa.userId === userId && pa.projectId === projectId));
      });

      return { previousAccess };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-access'] });
      toast({ title: 'Project access removed' });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousAccess) {
        queryClient.setQueryData(['project-access'], context.previousAccess);
      }
      toast({ title: error.message || 'Failed to remove access', variant: 'destructive' });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast({ title: 'Please enter an email address', variant: 'destructive' });
      return;
    }
    inviteUser.mutate({
      email: inviteEmail,
      name: inviteName || undefined,
      accessLevel: inviteRole,
      projectIds: inviteProjectIds,
      jobRoleId: inviteJobRoleId,
    });
  };

  const openEditDialog = (user: { id: string; name: string; email: string; googleId?: string; jobRoleId?: string | null }) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditJobRoleId(user.jobRoleId || undefined);
  };

  const handleEditSave = () => {
    if (!editingUser) return;
    updateUser.mutate(
      { id: editingUser.id, data: { name: editName, email: editEmail, jobRoleId: editJobRoleId || null } },
      {
        onSuccess: () => {
          setEditingUser(null);
        },
      }
    );
  };

  // Client handlers
  const resetClientForm = () => {
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientGhlLocationId('');
    setClientGbpLocationId('');
    setClientGoogleAdsCustomerId('');
  };

  const openClientEditDialog = (client: { id: string; name: string; email?: string; phone?: string; ghlLocationId?: string; gbpLocationId?: string; googleAdsCustomerId?: string }) => {
    setEditingClient(client);
    setClientName(client.name);
    setClientEmail(client.email || '');
    setClientPhone(client.phone || '');
    setClientGhlLocationId(client.ghlLocationId || '');
    setClientGbpLocationId(client.gbpLocationId || '');
    setClientGoogleAdsCustomerId(client.googleAdsCustomerId || '');
  };

  const handleClientSave = () => {
    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, data: { name: clientName, email: clientEmail || undefined, phone: clientPhone || undefined, ghlLocationId: clientGhlLocationId || undefined, gbpLocationId: clientGbpLocationId || undefined, googleAdsCustomerId: clientGoogleAdsCustomerId || undefined } });
    } else {
      if (!clientName) {
        toast({ title: 'Please enter a client name', variant: 'destructive' });
        return;
      }
      createClient.mutate({ name: clientName, email: clientEmail || undefined, phone: clientPhone || undefined, ghlLocationId: clientGhlLocationId || undefined, gbpLocationId: clientGbpLocationId || undefined, googleAdsCustomerId: clientGoogleAdsCustomerId || undefined });
    }
  };

  const openViewersDialog = (client: { id: string; name: string }) => {
    setViewersClientId(client.id);
    setViewersClientName(client.name);
    setShowViewersDialog(true);
  };

  const handleAddViewer = () => {
    if (!viewersClientId || !newViewerEmail) return;
    addViewer.mutate({
      clientId: viewersClientId,
      data: { email: newViewerEmail, name: newViewerName || undefined }
    });
  };

  // Project handlers
  const resetProjectForm = () => {
    setProjectName('');
    setProjectClientId('');
    setPlanType('package_one');
    setProjectStatus('active');
  };

  const openProjectEditDialog = (project: { id: string; name: string; clientId: string; planType?: string; subscriptionStatus?: string }) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectClientId(project.clientId);
    setPlanType(project.planType || 'package_one');
    setProjectStatus(project.subscriptionStatus || 'active');
  };

  const handleProjectSave = () => {
    if (editingProject) {
      updateProject.mutate({ id: editingProject.id, data: { name: projectName, planType: projectPlanType, subscriptionStatus: projectStatus } });
    } else {
      if (!projectName || !projectClientId) {
        toast({ title: 'Please enter project name and select a client', variant: 'destructive' });
        return;
      }
      createProject.mutate({ clientId: projectClientId, name: projectName, planType: projectPlanType });
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage users, projects, and system configuration"
      />

      <div className="p-6">
      <Tabs defaultValue="contractors">
        <TabsList data-guide="settings-tabs">
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="appearance" data-guide="appearance-tab">Appearance</TabsTrigger>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="emails" data-guide="emails-tab">Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="contractors" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Contractor Management</h2>
              <p className="text-sm text-white/60">Invite and manage team members</p>
            </div>
            <Dialog open={showInviteDialog} onOpenChange={(open) => {
              setShowInviteDialog(open);
              if (open) {
                // Reset form and select all projects by default when opening
                setInviteEmail('');
                setInviteName('');
                setInviteRole('editor');
                setInviteJobRoleId(undefined);
                setInviteProjectIds(allProjects.map(p => p.id));
              }
            }}>
              <DialogTrigger asChild>
                <Button data-guide="invite-user">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Contractor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Invite New Contractor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="contractor@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (optional)</Label>
                    <Input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AccessLevel)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-white/50" />
                            <span>Viewer</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div className="flex items-center gap-2">
                            <Edit2 className="h-4 w-4 text-amber-500" />
                            <span>Editor</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="project_manager">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span>Project Manager</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-purple-500" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Job Role (optional)</Label>
                    <p className="text-xs text-white/60">Assign a job role to automatically add this contractor to related tasks</p>
                    <Select value={inviteJobRoleId || 'none'} onValueChange={(v) => setInviteJobRoleId(v === 'none' ? undefined : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job role..." />
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
                              <span>{role.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Project Access</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setInviteProjectIds(allProjects.map(p => p.id))}
                        >
                          Select All
                        </button>
                        <span className="text-xs text-white/60">|</span>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setInviteProjectIds([])}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto bg-white/[0.03]">
                      {allClients.map((client) => {
                        const clientProjects = allProjects.filter((p) => p.client?.id === client.id);
                        if (clientProjects.length === 0) return null;

                        return (
                          <div key={client.id} className="space-y-1.5">
                            <div className="text-xs font-medium text-white/60 uppercase tracking-wide">
                              {client.name}
                            </div>
                            <div className="space-y-1 ml-2">
                              {clientProjects.map((project) => {
                                const isChecked = inviteProjectIds.includes(project.id);
                                return (
                                  <div key={project.id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`invite-project-${project.id}`}
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setInviteProjectIds([...inviteProjectIds, project.id]);
                                        } else {
                                          setInviteProjectIds(inviteProjectIds.filter(id => id !== project.id));
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`invite-project-${project.id}`}
                                      className="text-sm cursor-pointer"
                                    >
                                      {project.name}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {allProjects.length === 0 && (
                        <p className="text-sm text-white/60 text-center py-2">
                          No projects available
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-white/60">
                      {inviteProjectIds.length} of {allProjects.length} projects selected
                    </p>
                  </div>
                  <Button onClick={handleInvite} className="w-full" disabled={inviteUser.isPending}>
                    {inviteUser.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Active Contractors */}
          <div className="space-y-3">
            {allUsers.filter(u => !u.archived).map((user) => (
              <Card key={user.id}>
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                      <div>
                        <CardTitle className="text-base">{user.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span data-sensitive>{user.email}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!user.googleId && (
                        <Badge variant="outline" className="text-amber-400 border-amber-500/20 bg-amber-500/10">Pending Invite</Badge>
                      )}
                      {user.role === 'admin' ? (
                        <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">Admin</Badge>
                      ) : (
                        <Select
                          value={user.accessLevel || 'viewer'}
                          onValueChange={(value) => {
                            updateUser.mutate({
                              id: user.id,
                              data: { accessLevel: value }
                            });
                          }}
                        >
                          <SelectTrigger className="w-44 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-white/50" />
                                <span>Viewer</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="editor">
                              <div className="flex items-center gap-2">
                                <Edit2 className="h-4 w-4 text-amber-500" />
                                <span>Editor</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="project_manager">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-blue-500" />
                                <span>Project Manager</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-purple-500" />
                                <span>Admin</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent"
                        onClick={() => openEditDialog(user)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 text-white/60 hover:text-[var(--theme-primary)]" />
                      </Button>
                      {user.role !== 'admin' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-transparent"
                            onClick={() => archiveUser.mutate(user.id)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4 text-white/60 hover:text-[var(--theme-primary)]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-transparent"
                            onClick={async () => {
                              const confirmed = await confirm({
                                title: 'Delete Contractor',
                                description: 'Permanently delete this contractor? This action cannot be undone.',
                                confirmText: 'Delete',
                                cancelText: 'Cancel',
                                variant: 'danger',
                              });
                              if (confirmed) {
                                deleteUser.mutate(user.id);
                              }
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Archived Contractors Section */}
          {allUsers.filter(u => u.archived).length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-foreground transition-colors mb-3"
              >
                {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Archive className="h-4 w-4" />
                Archived Contractors ({allUsers.filter(u => u.archived).length})
              </button>

              {showArchived && (
                <div className="space-y-3 pl-6 border-l-2 border-white/[0.08]">
                  {allUsers.filter(u => u.archived).map((user) => (
                    <Card key={user.id} className="bg-white/[0.03] border-white/[0.08]">
                      <CardHeader className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
                            <div>
                              <CardTitle className="text-base text-white/70">{user.name}</CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Mail className="h-3 w-3" />
                                <span data-sensitive>{user.email}</span>
                              </CardDescription>
                              {user.archivedAt && (
                                <p className="text-xs text-white/60 mt-1">
                                  Archived {formatDate(user.archivedAt)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unarchiveUser.mutate(user.id)}
                              className="h-8"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-transparent"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: 'Delete Contractor',
                                  description: 'Permanently delete this contractor? This action cannot be undone.',
                                  confirmText: 'Delete',
                                  cancelText: 'Cancel',
                                  variant: 'danger',
                                });
                                if (confirmed) {
                                  deleteUser.mutate(user.id);
                                }
                              }}
                              title="Delete permanently"
                            >
                              <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit User Dialog */}
          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Contractor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Contractor name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="contractor@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Job Role</Label>
                  <p className="text-xs text-white/60">Assign a job role to automatically add this contractor to related tasks</p>
                  <Select value={editJobRoleId || 'none'} onValueChange={(v) => setEditJobRoleId(v === 'none' ? undefined : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job role..." />
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
                            <span>{role.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleEditSave} className="w-full" disabled={updateUser.isPending}>
                  {updateUser.isPending ? 'Saving...' : 'Save Changes'}
                </Button>

                {/* Resend Invite Button - only show for pending users */}
                {editingUser && !editingUser.googleId && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        resendInvite.mutate(editingUser.id);
                      }}
                      className="w-full"
                      disabled={resendInvite.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {resendInvite.isPending ? 'Sending...' : 'Resend Invitation Email'}
                    </Button>
                    <p className="text-xs text-white/60 mt-2 text-center">
                      Use this if you made a typo in the email or the user didn't receive it
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Role Permissions</h2>
              <p className="text-sm text-white/60">
                Define what each role can access in the system
              </p>
            </div>
          </div>

          {/* Role Definitions Matrix */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-[var(--theme-primary)]" />
                Role Definitions
              </CardTitle>
              <CardDescription>
                Click checkboxes to modify permissions for each role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-white">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm">Permission</th>
                      <th className="text-center py-3 px-4 font-medium text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <Eye className="h-4 w-4 text-white/50" />
                          <span>Viewer</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <Edit2 className="h-4 w-4 text-amber-500" />
                          <span>Editor</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Project Manager</span>
                        </div>
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <Shield className="h-4 w-4 text-purple-500" />
                          <span>Admin</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">View assigned tasks</td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">View all tasks</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Edit own tasks</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Edit all tasks</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Create new tasks</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">View own time entries</td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">View all time entries</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Manage templates</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Access Time Analytics</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox defaultChecked /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                    <tr className="hover:bg-white/[0.04]">
                      <td className="py-3 px-4 text-sm">Access Settings page</td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox /></td>
                      <td className="py-3 px-4 text-center"><Checkbox checked disabled className="opacity-50" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Project Assignments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Project Assignments</CardTitle>
              <CardDescription>
                Assign contractors to specific projects they can access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contractors List */}
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-white/60 uppercase tracking-wide mb-3">Select Contractor</h3>
                  <div className="space-y-2 p-1">
                    {allUsers
                      .filter((u) => u.role === 'contractor' && u.active)
                      .map((contractor) => {
                        const userAccess = allProjectAccess.filter((pa) => pa.userId === contractor.id);
                        const isSelected = selectedUserId === contractor.id;

                        return (
                          <div
                            key={contractor.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all',
                              isSelected ? 'ring-2 ring-[var(--theme-primary)] bg-[var(--theme-primary)]/5 border-[var(--theme-primary)]/30' : 'hover:bg-white/[0.04]'
                            )}
                            onClick={() => setSelectedUserId(contractor.id)}
                          >
                            <div className="flex items-center gap-3">
                              <UserAvatar name={contractor.name} avatarUrl={contractor.avatarUrl} size="sm" />
                              <div>
                                <p className="font-medium text-sm">{contractor.name}</p>
                                <p className="text-xs text-white/60">{contractor.accessLevel === 'project_manager' ? 'Project Manager' : contractor.accessLevel}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {userAccess.length} project{userAccess.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        );
                      })}
                    {allUsers.filter((u) => u.role === 'contractor' && u.active).length === 0 && (
                      <p className="text-sm text-white/60 text-center py-4">
                        No active contractors
                      </p>
                    )}
                  </div>
                </div>

                {/* Project Access Panel */}
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-white/60 uppercase tracking-wide mb-3">
                    {selectedUserId
                      ? `Projects for ${allUsers.find((u) => u.id === selectedUserId)?.name}`
                      : 'Select a Contractor'}
                  </h3>

                  {selectedUserId ? (
                    <div className="space-y-3">
                      {allClients.map((client) => {
                        const clientProjects = allProjects.filter((p) => p.client?.id === client.id);
                        if (clientProjects.length === 0) return null;

                        return (
                          <div key={client.id} className="space-y-2">
                            <div className="text-sm font-medium text-white/60 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[var(--theme-primary)]" />
                              {client.name}
                            </div>
                            <div className="space-y-1 ml-4">
                              {clientProjects.map((project) => {
                                const access = allProjectAccess.find(
                                  (pa) => pa.userId === selectedUserId && pa.projectId === project.id
                                );
                                const hasAccess = !!access;

                                return (
                                  <div
                                    key={project.id}
                                    className={cn(
                                      'flex items-center justify-between p-2 rounded-lg border transition-colors',
                                      hasAccess ? 'bg-green-500/10 border-green-500/20' : 'bg-white/[0.03] border-white/[0.08]'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        id={`access-${project.id}`}
                                        checked={hasAccess}
                                        onCheckedChange={(checked) => {
                                          if (!selectedUserId) return;
                                          if (checked) {
                                            updateProjectAccess.mutate({
                                              userId: selectedUserId,
                                              projectId: project.id,
                                              canView: true,
                                              canEdit: true,
                                              canDelete: false,
                                            });
                                          } else {
                                            deleteProjectAccess.mutate({
                                              userId: selectedUserId,
                                              projectId: project.id,
                                            });
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`access-${project.id}`}
                                        className={cn(
                                          'text-sm font-medium cursor-pointer',
                                          hasAccess ? 'text-green-400' : 'text-white/60'
                                        )}
                                      >
                                        {project.name}
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {allProjects.length === 0 && (
                        <p className="text-sm text-white/60 text-center py-4">
                          No projects available
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-white/60 py-8 bg-white/[0.03] rounded-lg">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a contractor to assign projects</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Client Management</h2>
              <p className="text-sm text-white/60">Manage client accounts and contacts</p>
            </div>
            <Dialog open={showClientDialog} onOpenChange={(open) => { setShowClientDialog(open); if (!open) { resetClientForm(); setEditingClient(null); } }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GHL Location ID</Label>
                    <Input
                      value={clientGhlLocationId}
                      onChange={(e) => setClientGhlLocationId(e.target.value)}
                      placeholder="vI2auSPhucdsnmIBeVDK"
                    />
                    <p className="text-xs text-white/60">
                      Find this in your GHL subaccount URL or settings
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>GBP Location ID</Label>
                    <Input
                      value={clientGbpLocationId}
                      onChange={(e) => setClientGbpLocationId(e.target.value)}
                      placeholder="accounts/123/locations/456"
                    />
                    <p className="text-xs text-white/60">
                      Google Business Profile location ID for SEO intelligence
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Google Ads Customer ID</Label>
                    <Input
                      value={clientGoogleAdsCustomerId}
                      onChange={(e) => setClientGoogleAdsCustomerId(e.target.value)}
                      placeholder="123-456-7890"
                    />
                    <p className="text-xs text-white/60">
                      Google Ads customer ID for SEO intelligence metrics
                    </p>
                  </div>
                  <Button
                    onClick={handleClientSave}
                    className="w-full"
                    disabled={createClient.isPending || updateClient.isPending}
                  >
                    {(createClient.isPending || updateClient.isPending) ? 'Saving...' : (editingClient ? 'Update Client' : 'Create Client')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {allClients.map((client: any) => (
              <Card key={client.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span data-sensitive>{client.email}</span>
                          </span>
                        )}
                        {client.phone && <span data-sensitive>{client.phone}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {client.projects?.length || 0} projects
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openViewersDialog(client)}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        Viewers
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => window.open('/client-portal', '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Portal
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent"
                        onClick={() => { openClientEditDialog(client); setShowClientDialog(true); }}
                      >
                        <Pencil className="h-4 w-4 text-white/60 hover:text-[var(--theme-primary)]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent"
                        onClick={() => deleteClient.mutate(client.id)}
                        disabled={client.projects && client.projects.length > 0}
                      >
                        <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                  {(client.embedToken || client.ghlLocationId) && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {client.ghlLocationId && (
                        <div>
                          <div className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                            <Code className="h-3 w-3" />
                            <span className="font-medium">GHL Location ID</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white/[0.06] px-2 py-1.5 rounded font-mono truncate">
                              {client.ghlLocationId}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs shrink-0"
                              onClick={() => {
                                const iframe = `<iframe src="${window.location.origin}/embed/location/${client.ghlLocationId}" style="width:100%;height:500px;border:none;"></iframe>`;
                                navigator.clipboard.writeText(iframe);
                                toast({ title: 'Iframe code copied to clipboard' });
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Iframe
                            </Button>
                          </div>
                        </div>
                      )}
                      {client.embedToken && (
                        <div>
                          <div className="flex items-center gap-2 text-xs text-white/60 mb-1.5">
                            <Code className="h-3 w-3" />
                            <span className="font-medium">Embed Token</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white/[0.06] px-2 py-1.5 rounded font-mono truncate">
                              {client.embedToken}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(client.embedToken);
                                toast({ title: 'Token copied to clipboard' });
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs shrink-0"
                              onClick={() => {
                                const url = `${window.location.origin}/embed/submit/${client.embedToken}`;
                                navigator.clipboard.writeText(url);
                                toast({ title: 'Embed URL copied to clipboard' });
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              URL
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
              </Card>
            ))}
            {allClients.length === 0 && (
              <p className="text-sm text-white/60 text-center py-8">
                No clients yet. Add one manually or they will be created automatically from Stripe subscriptions.
              </p>
            )}
          </div>

          {/* Viewers Dialog */}
          <Dialog open={showViewersDialog} onOpenChange={(open) => {
            setShowViewersDialog(open);
            if (!open) {
              setViewersClientId(null);
              setNewViewerEmail('');
              setNewViewerName('');
            }
          }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Manage Viewers</DialogTitle>
                <DialogDescription>
                  Viewers for {viewersClientName} can access the client portal
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Add new viewer */}
                <div className="space-y-2 p-3 bg-white/[0.03] rounded-lg">
                  <Label className="text-sm font-medium">Add New Viewer</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email *"
                      value={newViewerEmail}
                      onChange={(e) => setNewViewerEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Name"
                      value={newViewerName}
                      onChange={(e) => setNewViewerName(e.target.value)}
                      className="w-32"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddViewer}
                    disabled={!newViewerEmail || addViewer.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {addViewer.isPending ? 'Adding...' : 'Add Viewer'}
                  </Button>
                </div>

                {/* Existing viewers */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Current Viewers</Label>
                  {viewersLoading ? (
                    <p className="text-sm text-white/60 text-center py-4">Loading...</p>
                  ) : clientViewers.length === 0 ? (
                    <p className="text-sm text-white/60 text-center py-4">No viewers yet</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {clientViewers.map((viewer) => (
                        <div key={viewer.id} className="flex items-center justify-between p-2 bg-white/[0.06] border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{viewer.name || <span data-sensitive>{viewer.email}</span>}</p>
                            {viewer.name && <p className="text-xs text-white/60" data-sensitive>{viewer.email}</p>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => viewersClientId && removeViewer.mutate({ clientId: viewersClientId, viewerId: viewer.id })}
                            disabled={removeViewer.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Project Management</h2>
              <p className="text-sm text-white/60">Create and configure client projects</p>
            </div>
            <Dialog open={showProjectDialog} onOpenChange={(open) => { setShowProjectDialog(open); if (!open) { resetProjectForm(); setEditingProject(null); } }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProject ? 'Edit Project' : 'Create New Project'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Project name"
                    />
                  </div>
                  {!editingProject && (
                    <div className="space-y-2">
                      <Label>Client *</Label>
                      <select
                        value={projectClientId}
                        onChange={(e) => setProjectClientId(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select a client</option>
                        {allClients.map((client) => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Plan Type</Label>
                    <select
                      value={projectPlanType}
                      onChange={(e) => setPlanType(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="package_one">Package One</option>
                      <option value="package_two">Package Two</option>
                      <option value="package_three">Package Three</option>
                      <option value="package_four">Package Four</option>
                      <option value="facebook_ads_addon">Facebook Ads Add-on</option>
                      <option value="custom_website_addon">Custom Website Add-on</option>
                    </select>
                  </div>
                  {editingProject && (
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        value={projectStatus}
                        onChange={(e) => setProjectStatus(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="canceled">Canceled</option>
                        <option value="past_due">Past Due</option>
                      </select>
                    </div>
                  )}
                  <Button
                    onClick={handleProjectSave}
                    className="w-full"
                    disabled={createProject.isPending || updateProject.isPending}
                  >
                    {(createProject.isPending || updateProject.isPending) ? 'Saving...' : (editingProject ? 'Update Project' : 'Create Project')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {allProjects.map((project) => (
              <Card key={project.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription>
                        {project.client?.name} • {project.planType?.replace('_', ' ')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={project.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                        {project.subscriptionStatus}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setUpgradingProject({ id: project.id, name: project.name, planType: project.planType || undefined });
                          setUpgradePlanType(project.planType || 'package_one');
                          setShowUpgradeDialog(true);
                        }}
                      >
                        Upgrade
                      </Button>
                      {project.subscriptionStatus === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-orange-400 border-orange-500/20 hover:bg-orange-500/10"
                          onClick={() => {
                            setOffboardingProject({ id: project.id, name: project.name, clientName: project.client?.name });
                            setShowOffboardDialog(true);
                          }}
                        >
                          Offboard
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent"
                        onClick={() => { openProjectEditDialog({ ...project, clientId: project.client?.id || '' }); setShowProjectDialog(true); }}
                      >
                        <Pencil className="h-4 w-4 text-white/60 hover:text-[var(--theme-primary)]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent"
                        onClick={() => deleteProject.mutate(project.id)}
                      >
                        <Trash2 className="h-4 w-4 text-white/60 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
            {allProjects.length === 0 && (
              <p className="text-sm text-white/60 text-center py-8">
                No projects yet. Add one manually or they will be created automatically from Stripe subscriptions.
              </p>
            )}
          </div>

          {/* Upgrade Package Dialog */}
          <Dialog open={showUpgradeDialog} onOpenChange={(open) => { setShowUpgradeDialog(open); if (!open) { setUpgradingProject(null); setUpgradePlanType(''); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upgrade Package</DialogTitle>
                <DialogDescription>
                  Upgrade {upgradingProject?.name} to a new package. Only templates that haven't been applied yet will be added.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <p className="text-sm text-white/60">Current package:</p>
                  <p className="font-medium">{upgradingProject?.planType?.replace(/_/g, ' ') || 'None'}</p>
                </div>
                <div className="space-y-2">
                  <Label>New Package</Label>
                  <select
                    value={upgradePlanType}
                    onChange={(e) => setUpgradePlanType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="package_one">Package One</option>
                    <option value="package_two">Package Two</option>
                    <option value="package_three">Package Three</option>
                    <option value="package_four">Package Four</option>
                    <option value="facebook_ads_addon">Facebook Ads Add-on</option>
                    <option value="custom_website_addon">Custom Website Add-on</option>
                  </select>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-400">
                    Tasks from templates already applied to this project will be skipped to prevent duplicates.
                  </p>
                </div>
                <Button
                  onClick={() => upgradingProject && upgradeProject.mutate({ id: upgradingProject.id, planType: upgradePlanType })}
                  className="w-full"
                  disabled={upgradeProject.isPending || !upgradePlanType}
                >
                  {upgradeProject.isPending ? 'Upgrading...' : 'Upgrade Package'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Offboard Project Dialog */}
          <Dialog open={showOffboardDialog} onOpenChange={(open) => { setShowOffboardDialog(open); if (!open) { setOffboardingProject(null); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Offboard Project</DialogTitle>
                <DialogDescription>
                  Are you sure you want to offboard {offboardingProject?.name}?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="p-3 bg-white/[0.03] rounded-lg">
                  <p className="text-sm text-white/60">Client:</p>
                  <p className="font-medium">{offboardingProject?.clientName || 'Unknown'}</p>
                </div>
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm text-orange-400">
                    This will:
                  </p>
                  <ul className="text-sm text-orange-400 list-disc list-inside mt-1 space-y-1">
                    <li>Create offboarding tasks from your offboarding templates</li>
                    <li>Change the project status to "canceled"</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowOffboardDialog(false); setOffboardingProject(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => offboardingProject && offboardProjectMutation.mutate(offboardingProject.id)}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={offboardProjectMutation.isPending}
                  >
                    {offboardProjectMutation.isPending ? 'Offboarding...' : 'Offboard Project'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Tag Management</h2>
              <p className="text-sm text-white/60">Organize tasks with color-coded tags</p>
            </div>
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tag</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => createTag.mutate({ name: newTagName, color: newTagColor })}
                    className="w-full"
                  >
                    Create Tag
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-6">
              {allTags.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {allTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors"
                    >
                      <div
                        className="w-4 h-4 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium text-sm">{tag.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-1 hover:bg-transparent"
                        onClick={() => deleteTag.mutate(tag.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white/60 hover:text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <Plus className="h-6 w-6 text-white/40" />
                  </div>
                  <p className="text-white/60 font-medium">No tags yet</p>
                  <p className="text-sm text-white/40 mt-1">Create your first tag to organize tasks</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Role Management</h2>
              <p className="text-sm text-white/60">Create job roles to assign contractors and tasks</p>
            </div>
            <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="e.g. Virtual Assistant, CSM, SEO Specialist"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      placeholder="Brief description of this role"
                    />
                  </div>
                  <Button
                    onClick={() => createRole.mutate({ name: newRoleName, color: newRoleColor, description: newRoleDescription || undefined })}
                    className="w-full"
                    disabled={!newRoleName.trim()}
                  >
                    Create Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-6">
              {allRoles.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {allRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors"
                    >
                      <div
                        className="w-4 h-4 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: role.color }}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{role.name}</span>
                        {role.description && (
                          <span className="text-xs text-white/60">{role.description}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 ml-1 hover:bg-transparent"
                        onClick={() => deleteRole.mutate(role.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white/60 hover:text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <Users className="h-6 w-6 text-white/40" />
                  </div>
                  <p className="text-white/60 font-medium">No roles yet</p>
                  <p className="text-sm text-white/40 mt-1">Create roles to assign contractors to task types</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Appearance Settings</h2>
              <p className="text-sm text-white/60">Customize the look and feel of the application</p>
            </div>
            <Button
              variant="outline"
              onClick={handleResetTheme}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colors */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[var(--theme-primary)]" />
                  Colors
                </CardTitle>
                <CardDescription>
                  Customize the brand colors used throughout the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Primary Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.primary}
                        onChange={(e) => handleThemeChange(['colors', 'primary'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.primary}
                        onChange={(e) => handleThemeChange(['colors', 'primary'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-white/60">Main brand color for navigation, headers</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.accent}
                        onChange={(e) => handleThemeChange(['colors', 'accent'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.accent}
                        onChange={(e) => handleThemeChange(['colors', 'accent'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-white/60">Highlights, CTAs, and active states</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.background}
                        onChange={(e) => handleThemeChange(['colors', 'background'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.background}
                        onChange={(e) => handleThemeChange(['colors', 'background'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Card Background</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.cardBackground}
                        onChange={(e) => handleThemeChange(['colors', 'cardBackground'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.cardBackground}
                        onChange={(e) => handleThemeChange(['colors', 'cardBackground'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Text Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.text}
                        onChange={(e) => handleThemeChange(['colors', 'text'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.text}
                        onChange={(e) => handleThemeChange(['colors', 'text'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Muted Text</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.mutedText}
                        onChange={(e) => handleThemeChange(['colors', 'mutedText'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.mutedText}
                        onChange={(e) => handleThemeChange(['colors', 'mutedText'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Border Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={effectiveTheme.colors.border}
                        onChange={(e) => handleThemeChange(['colors', 'border'], e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={effectiveTheme.colors.border}
                        onChange={(e) => handleThemeChange(['colors', 'border'], e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium mb-3 block">Status Colors</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Success</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveTheme.colors.success}
                          onChange={(e) => handleThemeChange(['colors', 'success'], e.target.value)}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={effectiveTheme.colors.success}
                          onChange={(e) => handleThemeChange(['colors', 'success'], e.target.value)}
                          className="flex-1 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Warning</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveTheme.colors.warning}
                          onChange={(e) => handleThemeChange(['colors', 'warning'], e.target.value)}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={effectiveTheme.colors.warning}
                          onChange={(e) => handleThemeChange(['colors', 'warning'], e.target.value)}
                          className="flex-1 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">Error</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveTheme.colors.error}
                          onChange={(e) => handleThemeChange(['colors', 'error'], e.target.value)}
                          className="w-8 h-8 rounded border cursor-pointer"
                        />
                        <Input
                          value={effectiveTheme.colors.error}
                          onChange={(e) => handleThemeChange(['colors', 'error'], e.target.value)}
                          className="flex-1 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Border Radius & Fonts */}
            <div className="space-y-6">
              {/* Border Radius */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Border Radius</CardTitle>
                  <CardDescription>
                    Control the roundness of buttons and cards
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(['small', 'medium', 'large'] as const).map((radius) => (
                    <label
                      key={radius}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        effectiveTheme.borderRadius === radius
                          ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/5'
                          : 'border-white/[0.08] hover:border-white/[0.12]'
                      )}
                      onClick={() => handleThemeChange(['borderRadius'], radius)}
                    >
                      <input
                        type="radio"
                        name="borderRadius"
                        value={radius}
                        checked={effectiveTheme.borderRadius === radius}
                        onChange={() => handleThemeChange(['borderRadius'], radius)}
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          'w-12 h-8 bg-[var(--theme-primary)]',
                          radius === 'small' && 'rounded-sm',
                          radius === 'medium' && 'rounded-md',
                          radius === 'large' && 'rounded-lg'
                        )}
                      />
                      <span className="text-sm font-medium capitalize">{radius}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Fonts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Typography</CardTitle>
                  <CardDescription>
                    Choose fonts for headings and body text
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Heading Font</Label>
                    <Select
                      value={effectiveTheme.fonts.heading}
                      onValueChange={(value) => handleThemeChange(['fonts', 'heading'], value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFonts.heading.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Body Font</Label>
                    <Select
                      value={effectiveTheme.fonts.body}
                      onValueChange={(value) => handleThemeChange(['fonts', 'body'], value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFonts.body.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Branding */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="h-4 w-4 text-[var(--theme-primary)]" />
                Branding
              </CardTitle>
              <CardDescription>
                Customize your logo and background
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Logo</Label>
                  <p className="text-xs text-white/60">
                    Square logo (512x512px)
                  </p>
                  {/* Logo Dropzone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-[var(--radius)] p-4 text-center cursor-pointer transition-colors h-32 flex items-center justify-center",
                      "hover:border-[var(--theme-primary)] hover:bg-white/[0.04]",
                      effectiveTheme.branding?.logoUrl ? "border-green-500/20 bg-green-500/10" : "border-white/[0.12]"
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          handleThemeChange(['branding', 'logoUrl'], event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            handleThemeChange(['branding', 'logoUrl'], event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {effectiveTheme.branding?.logoUrl ? (
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={effectiveTheme.branding.logoUrl}
                          alt="Logo preview"
                          className="w-16 h-16 object-contain rounded-[var(--radius)] border bg-white/[0.06]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                        <p className="text-xs text-white/60">Click to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="h-6 w-6 text-white/60" />
                        <p className="text-xs font-medium">Drop logo here</p>
                      </div>
                    )}
                  </div>
                  {/* URL Input */}
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Or paste URL"
                      value={effectiveTheme.branding?.logoUrl?.startsWith('data:') ? '' : (effectiveTheme.branding?.logoUrl || '')}
                      onChange={(e) => handleThemeChange(['branding', 'logoUrl'], e.target.value)}
                      className="text-xs flex-1"
                    />
                    {effectiveTheme.branding?.logoUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => handleThemeChange(['branding', 'logoUrl'], '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Background Image */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Background Image</Label>
                  <p className="text-xs text-white/60">
                    Optional background
                  </p>
                  {/* Background Image Dropzone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-[var(--radius)] p-4 text-center cursor-pointer transition-colors h-32 flex items-center justify-center",
                      "hover:border-[var(--theme-primary)] hover:bg-white/[0.04]",
                      effectiveTheme.branding?.backgroundImage ? "border-green-500/20 bg-green-500/10" : "border-white/[0.12]"
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-[var(--theme-primary)]', 'bg-white/[0.03]');
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          handleThemeChange(['branding', 'backgroundImage'], event.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            handleThemeChange(['branding', 'backgroundImage'], event.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    {effectiveTheme.branding?.backgroundImage ? (
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className="w-20 h-14 rounded-[var(--radius)] border bg-cover bg-center"
                          style={{ backgroundImage: `url('${effectiveTheme.branding.backgroundImage}')` }}
                        />
                        <p className="text-xs text-white/60">Click to replace</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <ImagePlus className="h-6 w-6 text-white/60" />
                        <p className="text-xs font-medium">Drop image here</p>
                      </div>
                    )}
                  </div>
                  {/* URL Input */}
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Or paste URL"
                      value={effectiveTheme.branding?.backgroundImage?.startsWith('data:') ? '' : (effectiveTheme.branding?.backgroundImage || '')}
                      onChange={(e) => handleThemeChange(['branding', 'backgroundImage'], e.target.value)}
                      className="text-xs flex-1"
                    />
                    {effectiveTheme.branding?.backgroundImage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => handleThemeChange(['branding', 'backgroundImage'], '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Background Color</Label>
                  <p className="text-xs text-white/60">
                    App background color
                  </p>
                  {/* Color Preview Box */}
                  <div
                    className="border-2 border-dashed rounded-[var(--radius)] h-32 flex items-center justify-center cursor-pointer transition-colors hover:border-[var(--theme-primary)]"
                    style={{ backgroundColor: effectiveTheme.branding?.backgroundColor || '#f9f9f9' }}
                    onClick={() => {
                      const input = document.querySelector('#bg-color-picker') as HTMLInputElement;
                      input?.click();
                    }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="w-12 h-12 rounded-[var(--radius)] border-2 border-white shadow-md"
                        style={{ backgroundColor: effectiveTheme.branding?.backgroundColor || '#f9f9f9' }}
                      />
                      <p className="text-xs font-medium" style={{ color: effectiveTheme.branding?.backgroundColor && effectiveTheme.branding.backgroundColor !== '#f9f9f9' ? '#fff' : '#737373' }}>
                        Click to change
                      </p>
                    </div>
                  </div>
                  {/* Color Input */}
                  <div className="flex items-center gap-2">
                    <input
                      id="bg-color-picker"
                      type="color"
                      value={effectiveTheme.branding?.backgroundColor || '#f9f9f9'}
                      onChange={(e) => handleThemeChange(['branding', 'backgroundColor'], e.target.value)}
                      className="w-8 h-8 rounded-[var(--radius)] border cursor-pointer"
                    />
                    <Input
                      placeholder="#f9f9f9"
                      value={effectiveTheme.branding?.backgroundColor || ''}
                      onChange={(e) => handleThemeChange(['branding', 'backgroundColor'], e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                    {effectiveTheme.branding?.backgroundColor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => handleThemeChange(['branding', 'backgroundColor'], '')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Preview</CardTitle>
              <CardDescription>
                See how your theme changes look in real-time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-lg">
                <Button className="bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)]">
                  Primary Button
                </Button>
                <Button className="bg-[var(--theme-accent)] hover:brightness-90">
                  Accent Button
                </Button>
                <Button variant="outline">
                  Outline Button
                </Button>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: effectiveTheme.colors.success }}
                  />
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: effectiveTheme.colors.warning }}
                  />
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: effectiveTheme.colors.error }}
                  />
                </div>
              </div>
              <div className="mt-4 p-4 border rounded-lg" style={{ borderColor: effectiveTheme.colors.border }}>
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: `'${effectiveTheme.fonts.heading}', system-ui, sans-serif`, color: effectiveTheme.colors.text }}
                >
                  Sample Heading
                </h3>
                <p
                  className="text-sm mt-1"
                  style={{ fontFamily: `'${effectiveTheme.fonts.body}', system-ui, sans-serif`, color: effectiveTheme.colors.mutedText }}
                >
                  This is sample body text to demonstrate how your font choices will look in the application.
                </p>
              </div>
            </CardContent>
          </Card>

          {isUpdating && (
            <div className="text-center text-sm text-white/60">
              <RotateCw className="h-4 w-4 animate-spin inline mr-2" />
              Saving changes...
            </div>
          )}
        </TabsContent>

        <StripeConfigTab />

        <AuditLogTab />

        <BackupsTab />

        <EmailTemplatesTab />
      </Tabs>
      </div>
    </div>
  );
}
