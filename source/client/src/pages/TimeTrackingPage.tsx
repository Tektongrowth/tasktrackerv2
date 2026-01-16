import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { users, projects, dashboard } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, CalendarDays, FolderKanban, Users, TrendingUp, TrendingDown, PieChart, Minus } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { darkenColor, getThemeRadius } from '@/lib/theme';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export function TimeTrackingPage() {
  const { isAdmin } = useAuth();
  const { theme } = useTheme();
  const { data: entries = [] } = useTimeEntries();

  // Get theme colors and radius for charts - use theme object directly to avoid race condition
  const themeColors = useMemo(() => {
    const colors = theme?.colors || {
      primary: '#8b0000',
      accent: '#f91a1a',
      background: '#f9f9f9',
      cardBackground: '#ffffff',
      text: '#1a1a1a',
      mutedText: '#737373',
      border: '#e5e5e5',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    };
    const primaryDark = darkenColor(colors.primary, 30);
    const radius = getThemeRadius();
    return {
      ...colors,
      primaryDark,
      barRadius: radius,
      barRadiusVertical: [radius, radius, 0, 0] as [number, number, number, number],
      barRadiusHorizontal: [0, radius, radius, 0] as [number, number, number, number],
      chartColors: [colors.primary, colors.accent, '#3c3c3c', '#8f8f8f', primaryDark, '#151515'],
      tagColors: {
        web: colors.primary,
        admin: '#3c3c3c',
        gbp: colors.accent,
        ads: primaryDark,
      } as Record<string, string>,
    };
  }, [theme]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: users.list,
    enabled: isAdmin,
  });

  useQuery({
    queryKey: ['projects'],
    queryFn: projects.list,
  });

  useQuery({
    queryKey: ['dashboard', 'time-summary'],
    queryFn: () => dashboard.timeSummary(),
    enabled: isAdmin,
  });

  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Generate month options for the last 12 months
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedUser !== 'all' && entry.userId !== selectedUser) return false;
      if (selectedMonth !== 'all') {
        const entryDate = new Date(entry.startTime || entry.createdAt);
        const entryMonth = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
        if (entryMonth !== selectedMonth) return false;
      }
      return true;
    });
  }, [entries, selectedUser, selectedMonth]);

  // Calculate stats
  const today = new Date().toDateString();
  const todayMinutes = filteredEntries
    .filter((e) => new Date(e.startTime || e.createdAt).toDateString() === today)
    .reduce((acc, e) => acc + (e.durationMinutes || 0), 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekMinutes = filteredEntries
    .filter((e) => new Date(e.startTime || e.createdAt) >= weekStart)
    .reduce((acc, e) => acc + (e.durationMinutes || 0), 0);

  const totalMinutes = filteredEntries.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);

  // Chart data: Hours by Project
  const projectChartData = useMemo(() => {
    const byProject: Record<string, number> = {};
    filteredEntries.forEach((entry) => {
      const projectName = entry.project?.name || 'Unassigned';
      byProject[projectName] = (byProject[projectName] || 0) + (entry.durationMinutes || 0);
    });
    return Object.entries(byProject)
      .map(([name, minutes]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        hours: Math.round((minutes / 60) * 10) / 10,
        minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);
  }, [filteredEntries]);

  // Chart data: Hours by Tag
  const tagChartData = useMemo(() => {
    const byTag: Record<string, number> = {};
    filteredEntries.forEach((entry) => {
      // Get tags from associated task if available
      const taskTags = (entry as any).task?.tags || [];
      if (taskTags.length > 0) {
        taskTags.forEach((tag: string) => {
          byTag[tag] = (byTag[tag] || 0) + (entry.durationMinutes || 0);
        });
      } else {
        byTag['Other'] = (byTag['Other'] || 0) + (entry.durationMinutes || 0);
      }
    });
    return Object.entries(byTag).map(([name, minutes]) => ({
      name,
      hours: Math.round((minutes / 60) * 10) / 10,
      value: minutes,
    }));
  }, [filteredEntries]);

  // Chart data: Hours by Month (last 6 months)
  const monthlyChartData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    const now = new Date();

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short' });
      byMonth[key] = 0;
    }

    entries.forEach((entry) => {
      // Apply user filter but not month filter for this chart
      if (selectedUser !== 'all' && entry.userId !== selectedUser) return;

      const entryDate = new Date(entry.startTime || entry.createdAt);
      const monthsAgo = (now.getFullYear() - entryDate.getFullYear()) * 12 + now.getMonth() - entryDate.getMonth();
      if (monthsAgo >= 0 && monthsAgo < 6) {
        const key = entryDate.toLocaleDateString('en-US', { month: 'short' });
        byMonth[key] = (byMonth[key] || 0) + (entry.durationMinutes || 0);
      }
    });

    return Object.entries(byMonth).map(([name, minutes]) => ({
      name,
      hours: Math.round((minutes / 60) * 10) / 10,
    }));
  }, [entries, selectedUser]);

  // Chart data: Hours by User (for payroll)
  const userChartData = useMemo(() => {
    if (!isAdmin) return [];

    const byUser: Record<string, { name: string; minutes: number }> = {};
    filteredEntries.forEach((entry) => {
      const userId = entry.userId;
      const userName = entry.user?.name || 'Unknown';
      if (!byUser[userId]) {
        byUser[userId] = { name: userName, minutes: 0 };
      }
      byUser[userId].minutes += entry.durationMinutes || 0;
    });

    return Object.values(byUser)
      .map((data) => ({
        name: data.name,
        hours: Math.round((data.minutes / 60) * 10) / 10,
        minutes: data.minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [filteredEntries, isAdmin]);

  // Contractor Report Cards Data
  const contractorReports = useMemo(() => {
    if (!isAdmin) return [];

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const reports: Array<{
      id: string;
      name: string;
      avatarUrl?: string | null;
      currentMonthMinutes: number;
      lastMonthMinutes: number;
      twoMonthsAgoMinutes: number;
      totalMinutes: number;
      entriesCount: number;
      avgDailyMinutes: number;
      percentChange: number;
      trend: 'up' | 'down' | 'stable';
    }> = [];

    // Group entries by user
    const byUser: Record<string, typeof entries> = {};
    entries.forEach((entry) => {
      if (!byUser[entry.userId]) byUser[entry.userId] = [];
      byUser[entry.userId].push(entry);
    });

    // Calculate stats for each user
    Object.entries(byUser).forEach(([userId, userEntries]) => {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return;

      let currentMonthMinutes = 0;
      let lastMonthMinutes = 0;
      let twoMonthsAgoMinutes = 0;
      let totalMinutes = 0;

      userEntries.forEach((entry) => {
        const entryDate = new Date(entry.startTime || entry.createdAt);
        const minutes = entry.durationMinutes || 0;
        totalMinutes += minutes;

        if (entryDate >= currentMonthStart) {
          currentMonthMinutes += minutes;
        } else if (entryDate >= lastMonthStart && entryDate <= lastMonthEnd) {
          lastMonthMinutes += minutes;
        } else if (entryDate >= twoMonthsAgoStart && entryDate < lastMonthStart) {
          twoMonthsAgoMinutes += minutes;
        }
      });

      // Calculate percent change from last month
      let percentChange = 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (lastMonthMinutes > 0) {
        percentChange = Math.round(((currentMonthMinutes - lastMonthMinutes) / lastMonthMinutes) * 100);
        trend = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';
      } else if (currentMonthMinutes > 0) {
        percentChange = 100;
        trend = 'up';
      }

      // Calculate avg daily minutes (based on days worked this month)
      const workingDays = Math.ceil((now.getTime() - currentMonthStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      const avgDailyMinutes = Math.round(currentMonthMinutes / workingDays);

      reports.push({
        id: userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        currentMonthMinutes,
        lastMonthMinutes,
        twoMonthsAgoMinutes,
        totalMinutes,
        entriesCount: userEntries.length,
        avgDailyMinutes,
        percentChange,
        trend,
      });
    });

    return reports.sort((a, b) => b.currentMonthMinutes - a.currentMonthMinutes);
  }, [entries, allUsers, isAdmin]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} hours ({formatDuration(payload[0].payload.minutes || payload[0].value * 60)})
          </p>
        </div>
      );
    }
    return null;
  };

  const headerActions = (
    <div className="flex items-center gap-3" data-guide="time-filters">
      {isAdmin && (
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {allUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          {monthOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Time Analytics"
        subtitle="Insights into time spent across projects and team members"
        actions={headerActions}
      />

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="text-white border-0" style={{ background: `linear-gradient(to bottom right, var(--theme-primary), var(--theme-primary-dark))` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Today</p>
                  <p className="text-3xl font-bold mt-1">{formatDuration(todayMinutes)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <CalendarDays className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-white border-0" style={{ background: `linear-gradient(to bottom right, var(--theme-sidebar), var(--theme-sidebar-dark))` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">This Week</p>
                  <p className="text-3xl font-bold mt-1">{formatDuration(weekMinutes)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-white border-0" style={{ background: `linear-gradient(to bottom right, var(--theme-accent), var(--theme-primary))` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm font-medium">Total (Filtered)</p>
                  <p className="text-3xl font-bold mt-1">{formatDuration(totalMinutes)}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#8f8f8f] to-[#3c3c3c] text-white border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-200 text-sm font-medium">Entries</p>
                  <p className="text-3xl font-bold mt-1">{filteredEntries.length}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <FolderKanban className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-guide="time-chart">
          {/* Monthly Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[var(--theme-primary)]" />
                Hours by Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" fill={themeColors.primary} radius={themeColors.barRadiusVertical} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Hours by Project */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-[var(--theme-primary)]" />
                Hours by Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" fill={themeColors.accent} radius={themeColors.barRadiusHorizontal} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hours by Tag (Donut) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[var(--theme-primary)]" />
                Hours by Tag Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={tagChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, payload }) => `${name}: ${(payload as any)?.hours || 0}h`}
                      labelLine={false}
                    >
                      {tagChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={themeColors.tagColors[entry.name.toLowerCase()] || themeColors.chartColors[index % themeColors.chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      formatter={(value) => [formatDuration(value as number), 'Time']}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Hours by Team Member (Payroll) - Admin Only */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-[var(--theme-primary)]" />
                  Hours by Team Member
                  <Badge variant="secondary" className="ml-auto">Payroll</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="hours" fill={themeColors.primaryDark} radius={themeColors.barRadiusVertical} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Summary Table */}
                <div className="mt-4 border-t pt-4">
                  <div className="space-y-2">
                    {userChartData.map((user) => (
                      <div key={user.name} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{user.name}</span>
                        <span className="font-mono">{formatDuration(user.minutes)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm font-bold border-t pt-2">
                      <span>Total</span>
                      <span className="font-mono">{formatDuration(totalMinutes)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Contractor Report Cards - Admin Only */}
        {isAdmin && contractorReports.length > 0 && (
          <div data-guide="time-entries">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--theme-primary)]" />
              Contractor Reports
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contractorReports.map((report) => (
                <Card key={report.id} className="overflow-hidden">
                  <CardHeader className="bg-slate-50 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] flex items-center justify-center text-white font-semibold">
                        {report.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-base">{report.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{report.entriesCount} time entries</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {/* Current Month Hours */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">This Month</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold font-mono">{formatDuration(report.currentMonthMinutes)}</span>
                        {report.trend === 'up' && (
                          <div className="flex items-center text-green-600 text-sm">
                            <TrendingUp className="h-4 w-4 mr-0.5" />
                            <span>+{report.percentChange}%</span>
                          </div>
                        )}
                        {report.trend === 'down' && (
                          <div className="flex items-center text-red-600 text-sm">
                            <TrendingDown className="h-4 w-4 mr-0.5" />
                            <span>{report.percentChange}%</span>
                          </div>
                        )}
                        {report.trend === 'stable' && (
                          <div className="flex items-center text-slate-500 text-sm">
                            <Minus className="h-4 w-4 mr-0.5" />
                            <span>{report.percentChange}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mini Bar Chart - Last 3 Months */}
                    <div className="mb-4">
                      <div className="flex items-end gap-1 h-12">
                        {[
                          { label: '2 mo ago', value: report.twoMonthsAgoMinutes },
                          { label: 'Last mo', value: report.lastMonthMinutes },
                          { label: 'This mo', value: report.currentMonthMinutes },
                        ].map((bar, i) => {
                          const maxVal = Math.max(report.twoMonthsAgoMinutes, report.lastMonthMinutes, report.currentMonthMinutes, 1);
                          const height = (bar.value / maxVal) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className={`w-full rounded-t transition-all ${i === 2 ? 'bg-[var(--theme-primary)]' : 'bg-slate-300'}`}
                                style={{ height: `${Math.max(height, 4)}%` }}
                              />
                              <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Last Month</p>
                        <p className="font-mono font-medium">{formatDuration(report.lastMonthMinutes)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg/Day</p>
                        <p className="font-mono font-medium">{formatDuration(report.avgDailyMinutes)}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">All Time Total</p>
                        <p className="font-mono font-medium">{formatDuration(report.totalMinutes)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
