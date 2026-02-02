import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications, ChannelPrefs, telegram } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { PushNotificationSettings } from '@/components/PushNotificationPrompt';
import {
  Bell,
  FolderPlus,
  ClipboardList,
  Eye,
  CheckCircle,
  AlertTriangle,
  Clock,
  AtSign,
  Calendar,
  CalendarDays,
  MessageCircle,
  ExternalLink,
  Unlink,
  Smartphone,
  Mail,
  Send,
} from 'lucide-react';

// Legacy notification types (email-only)
type LegacyNotificationKey = 'projectAssignment' | 'taskMovedToReview' | 'taskCompleted' | 'taskOverdue' | 'taskDueSoon' | 'dailyDigest' | 'weeklyDigest';

// Channel-based notification types
type ChannelNotificationKey = 'taskAssignment' | 'mentions' | 'chatMessages';

interface LegacyNotificationSettingProps {
  id: LegacyNotificationKey;
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function LegacyNotificationSetting({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
  disabled,
}: LegacyNotificationSettingProps) {
  return (
    <div className="flex items-start justify-between py-4 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

// Channel-based notification settings with 3 toggles per row
interface ChannelNotificationRowProps {
  id: ChannelNotificationKey;
  label: string;
  description: string;
  icon: React.ElementType;
  prefs: ChannelPrefs;
  onChannelChange: (channel: keyof ChannelPrefs, checked: boolean) => void;
  disabled?: boolean;
  telegramConnected?: boolean;
}

function ChannelNotificationRow({
  label,
  description,
  icon: Icon,
  prefs,
  onChannelChange,
  disabled,
  telegramConnected,
}: ChannelNotificationRowProps) {
  return (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-[var(--theme-primary)]/10 text-[var(--theme-primary)]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 ml-11">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-12">Email</span>
          <Switch
            checked={prefs.email}
            onCheckedChange={(checked) => onChannelChange('email', checked)}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-12">Push</span>
          <Switch
            checked={prefs.push}
            onCheckedChange={(checked) => onChannelChange('push', checked)}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground w-12">Telegram</span>
          <Switch
            checked={prefs.telegram}
            onCheckedChange={(checked) => onChannelChange('telegram', checked)}
            disabled={disabled || !telegramConnected}
          />
        </div>
      </div>
    </div>
  );
}

// Channel-based notification types config
const channelNotificationSettings: Array<{
  id: ChannelNotificationKey;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'taskAssignment',
    label: 'Task Assignments',
    description: 'When a task is assigned to you',
    icon: ClipboardList,
  },
  {
    id: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a comment',
    icon: AtSign,
  },
  {
    id: 'chatMessages',
    label: 'Chat Messages',
    description: 'When you receive a new chat message while offline',
    icon: MessageCircle,
  },
];

// Legacy notification settings (email-only)
const legacyNotificationSettings: Array<{
  id: LegacyNotificationKey;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'assignments' | 'tasks' | 'digest';
}> = [
  {
    id: 'projectAssignment',
    label: 'New Project Assignment',
    description: 'When you are added to a new project',
    icon: FolderPlus,
    category: 'assignments',
  },
  {
    id: 'taskMovedToReview',
    label: 'Task Moved to Review',
    description: 'When a task you are assigned to is moved to review',
    icon: Eye,
    category: 'tasks',
  },
  {
    id: 'taskCompleted',
    label: 'Task Completed',
    description: 'When a task you are assigned to is marked complete',
    icon: CheckCircle,
    category: 'tasks',
  },
  {
    id: 'taskOverdue',
    label: 'Overdue Tasks',
    description: 'When a task becomes overdue',
    icon: AlertTriangle,
    category: 'tasks',
  },
  {
    id: 'taskDueSoon',
    label: 'Due Soon Reminders',
    description: 'When a task is due within 24 hours',
    icon: Clock,
    category: 'tasks',
  },
  {
    id: 'dailyDigest',
    label: 'Daily Digest',
    description: 'Receive a daily summary of your tasks and activity',
    icon: Calendar,
    category: 'digest',
  },
  {
    id: 'weeklyDigest',
    label: 'Weekly Digest',
    description: 'Receive a weekly summary of your tasks and activity',
    icon: CalendarDays,
    category: 'digest',
  },
];

export function MySettingsPage() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notifications.getPreferences,
  });

  // Telegram status query
  const { data: telegramStatus, isLoading: telegramLoading } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegram.getStatus,
  });

  // Get Telegram link
  const getTelegramLink = useMutation({
    mutationFn: telegram.getLink,
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
        toast({ title: 'Opening Telegram...', description: 'Click Start in the Telegram app to connect.' });
      } else if (data.connected) {
        queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
      }
    },
    onError: () => {
      toast({ title: 'Failed to get link', variant: 'destructive' });
    },
  });

  // Disconnect Telegram
  const disconnectTelegram = useMutation({
    mutationFn: telegram.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] });
      toast({ title: 'Telegram disconnected' });
    },
    onError: () => {
      toast({ title: 'Failed to disconnect', variant: 'destructive' });
    },
  });

  // Debug log
  console.log('Notification preferences:', { preferences, isLoading, error });

  const updatePrefs = useMutation({
    mutationFn: notifications.updatePreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-preferences'], data);
      toast({ title: 'Preferences saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save preferences', variant: 'destructive' });
    },
  });

  // Handle legacy (email-only) notification toggle
  const handleLegacyToggle = (key: LegacyNotificationKey, value: boolean) => {
    updatePrefs.mutate({ [key]: value });
  };

  // Handle channel-based notification toggle
  const handleChannelToggle = (type: ChannelNotificationKey, channel: keyof ChannelPrefs, value: boolean) => {
    if (!preferences) return;
    const currentPrefs = preferences[type] as ChannelPrefs;
    updatePrefs.mutate({
      [type]: {
        ...currentPrefs,
        [channel]: value,
      },
    });
  };

  const assignmentSettings = legacyNotificationSettings.filter(s => s.category === 'assignments');
  const taskSettings = legacyNotificationSettings.filter(s => s.category === 'tasks');
  const digestSettings = legacyNotificationSettings.filter(s => s.category === 'digest');

  return (
    <div>
      <PageHeader
        title="My Settings"
        subtitle="Manage your notification preferences and account settings"
      />

      <div className="p-6 max-w-3xl" data-guide="notification-settings">
        {/* Channel-based Notifications Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[var(--theme-primary)]" />
              <CardTitle>Notification Channels</CardTitle>
            </div>
            <CardDescription>
              Choose how you want to be notified for each type of notification. You can enable or disable Email, Push, and Telegram independently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                <p className="font-medium">Failed to load notification preferences</p>
                <p className="text-sm mt-1">{(error as Error).message || 'Please try again later.'}</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="py-4 border-b">
                    <div className="flex items-center gap-3 mb-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <div className="flex items-center gap-6 ml-11">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : preferences ? (
              <div className="bg-slate-50 rounded-lg px-4">
                {channelNotificationSettings.map((setting) => (
                  <ChannelNotificationRow
                    key={setting.id}
                    id={setting.id}
                    label={setting.label}
                    description={setting.description}
                    icon={setting.icon}
                    prefs={preferences[setting.id] as ChannelPrefs}
                    onChannelChange={(channel, checked) => handleChannelToggle(setting.id, channel, checked)}
                    disabled={updatePrefs.isPending}
                    telegramConnected={telegramStatus?.connected}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Legacy Email Notifications Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[var(--theme-primary)]" />
              <CardTitle>Email-Only Notifications</CardTitle>
            </div>
            <CardDescription>
              These notifications are sent via email only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isLoading && preferences ? (
              <>
                {/* Assignments Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Assignments
                  </h3>
                  <div className="bg-slate-50 rounded-lg px-4">
                    {assignmentSettings.map((setting) => (
                      <LegacyNotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id] as boolean}
                        onCheckedChange={(checked) => handleLegacyToggle(setting.id, checked)}
                        disabled={updatePrefs.isPending}
                      />
                    ))}
                  </div>
                </div>

                {/* Task Updates Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Task Updates
                  </h3>
                  <div className="bg-slate-50 rounded-lg px-4">
                    {taskSettings.map((setting) => (
                      <LegacyNotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id] as boolean}
                        onCheckedChange={(checked) => handleLegacyToggle(setting.id, checked)}
                        disabled={updatePrefs.isPending}
                      />
                    ))}
                  </div>
                </div>

                {/* Digest Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Email Digest
                  </h3>
                  <div className="bg-slate-50 rounded-lg px-4">
                    {digestSettings.map((setting) => (
                      <LegacyNotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id] as boolean}
                        onCheckedChange={(checked) => handleLegacyToggle(setting.id, checked)}
                        disabled={updatePrefs.isPending}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Push Notifications Card */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-[var(--theme-primary)]" />
              <CardTitle>Push Notifications</CardTitle>
            </div>
            <CardDescription>
              Enable push notifications in your browser. Use the channel toggles above to control which notifications you receive via push.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PushNotificationSettings />
          </CardContent>
        </Card>

        {/* Telegram Notifications Card */}
        {telegramStatus?.configured && (
          <Card className="mt-6" data-guide="telegram-section">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#0088cc]" />
                <CardTitle>Telegram Notifications</CardTitle>
              </div>
              <CardDescription>
                Get instant push notifications on your phone via Telegram when someone mentions you, assigns you a task, or sends you a message.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {telegramLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-32" />
                </div>
              ) : telegramStatus.connected ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-green-700">Connected</p>
                      <p className="text-sm text-muted-foreground">
                        Linked to @{telegramStatus.botUsername}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnectTelegram.mutate()}
                    disabled={disconnectTelegram.isPending}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Connect your Telegram account to receive notifications on your phone.
                    </p>
                  </div>
                  <Button
                    onClick={() => getTelegramLink.mutate()}
                    disabled={getTelegramLink.isPending}
                    className="bg-[#0088cc] hover:bg-[#006699]"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Telegram
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
