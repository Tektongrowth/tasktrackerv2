import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications, NotificationPreferences } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
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
} from 'lucide-react';

interface NotificationSettingProps {
  id: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: React.ElementType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function NotificationSetting({
  label,
  description,
  icon: Icon,
  checked,
  onCheckedChange,
  disabled,
}: NotificationSettingProps) {
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

const notificationSettings: Array<{
  id: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'assignments' | 'tasks' | 'communication' | 'digest';
}> = [
  {
    id: 'projectAssignment',
    label: 'New Project Assignment',
    description: 'When you are added to a new project',
    icon: FolderPlus,
    category: 'assignments',
  },
  {
    id: 'taskAssignment',
    label: 'New Task Assignment',
    description: 'When a task is assigned to you',
    icon: ClipboardList,
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
    id: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a comment',
    icon: AtSign,
    category: 'communication',
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

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    updatePrefs.mutate({ [key]: value });
  };

  const assignmentSettings = notificationSettings.filter(s => s.category === 'assignments');
  const taskSettings = notificationSettings.filter(s => s.category === 'tasks');
  const communicationSettings = notificationSettings.filter(s => s.category === 'communication');
  const digestSettings = notificationSettings.filter(s => s.category === 'digest');

  return (
    <div>
      <PageHeader
        title="My Settings"
        subtitle="Manage your notification preferences and account settings"
      />

      <div className="p-6 max-w-3xl" data-guide="notification-settings">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[var(--theme-primary)]" />
              <CardTitle>Email Notifications</CardTitle>
            </div>
            <CardDescription>
              Control which email notifications you receive. Turn off notifications to keep your inbox clean.
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
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                ))}
              </div>
            ) : preferences ? (
              <>
                {/* Assignments Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Assignments
                  </h3>
                  <div className="bg-slate-50 rounded-lg px-4">
                    {assignmentSettings.map((setting) => (
                      <NotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id]}
                        onCheckedChange={(checked) => handleToggle(setting.id, checked)}
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
                      <NotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id]}
                        onCheckedChange={(checked) => handleToggle(setting.id, checked)}
                        disabled={updatePrefs.isPending}
                      />
                    ))}
                  </div>
                </div>

                {/* Communication Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Communication
                  </h3>
                  <div className="bg-slate-50 rounded-lg px-4">
                    {communicationSettings.map((setting) => (
                      <NotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id]}
                        onCheckedChange={(checked) => handleToggle(setting.id, checked)}
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
                      <NotificationSetting
                        key={setting.id}
                        id={setting.id}
                        label={setting.label}
                        description={setting.description}
                        icon={setting.icon}
                        checked={preferences[setting.id]}
                        onCheckedChange={(checked) => handleToggle(setting.id, checked)}
                        disabled={updatePrefs.isPending}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
