import type { WelcomeStep, TourDefinition } from './types';

export const welcomeSteps: WelcomeStep[] = [
  {
    id: 'welcome',
    icon: 'Sparkles',
    title: 'Welcome to Task Tracker!',
    description: 'Your central hub for managing tasks, tracking time, and collaborating with your team. Let\'s take a quick tour to get you started.',
  },
  {
    id: 'dashboard',
    icon: 'LayoutDashboard',
    title: 'Your Dashboard',
    description: 'Get a quick overview of your tasks, upcoming deadlines, and recent activity. The dashboard gives you everything you need at a glance.',
  },
  {
    id: 'kanban',
    icon: 'Columns3',
    title: 'Kanban Board',
    description: 'Organize your work visually with drag-and-drop task management. Move tasks between To Do, In Review, and Completed columns.',
  },
  {
    id: 'time',
    icon: 'Clock',
    title: 'Time Tracking',
    description: 'Track time spent on tasks with a simple click. Start a timer, log manual entries, and view reports of your productivity.',
  },
  {
    id: 'admin-settings',
    icon: 'Settings',
    title: 'Admin Settings',
    description: 'Manage users, configure permissions, and customize the application to fit your team\'s needs.',
    adminOnly: true,
  },
  {
    id: 'admin-templates',
    icon: 'FileText',
    title: 'Task Templates',
    description: 'Create reusable task templates and automate task creation for new projects. Save time with predefined workflows.',
    adminOnly: true,
  },
];

export function getWelcomeStepsForRole(role: 'admin' | 'contractor'): WelcomeStep[] {
  return welcomeSteps.filter(step => !step.adminOnly || role === 'admin');
}

export const spotlightTours: TourDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard Tour',
    description: 'Learn about the dashboard features',
    path: '/dashboard',
    steps: [
      {
        id: 'task-progress',
        target: 'task-progress',
        title: 'Task Progress',
        description: 'This chart shows your overall task completion rate. Hover over sections to see detailed breakdowns.',
        placement: 'right',
      },
      {
        id: 'quick-stats',
        target: 'quick-stats',
        title: 'Quick Stats',
        description: 'View key metrics at a glance: tasks due today, overdue items, and tasks needing attention.',
        placement: 'bottom',
      },
      {
        id: 'upcoming-tasks',
        target: 'upcoming-tasks',
        title: 'Upcoming Tasks',
        description: 'See what\'s coming up next. Click on any task to view details or update its status.',
        placement: 'left',
      },
    ],
  },
  {
    id: 'kanban',
    name: 'Kanban Board Tour',
    description: 'Master the drag-and-drop board',
    path: '/kanban',
    steps: [
      {
        id: 'kanban-columns',
        target: 'kanban-columns',
        title: 'Kanban Columns',
        description: 'Tasks flow through these columns: To Do, In Review, and Completed. Drag tasks between columns to update their status.',
        placement: 'bottom',
      },
      {
        id: 'new-task-button',
        target: 'new-task-button',
        title: 'Create Tasks',
        description: 'Click here to create a new task. You can also press "N" as a keyboard shortcut.',
        placement: 'bottom',
      },
      {
        id: 'filter-my-tasks',
        target: 'filter-my-tasks',
        title: 'Filter Your Tasks',
        description: 'Toggle this to see only tasks assigned to you. Press "M" as a shortcut.',
        placement: 'bottom',
      },
      {
        id: 'task-card',
        target: 'task-card',
        title: 'Task Cards',
        description: 'Each card shows task details. Click to open the full detail panel, or drag to change status.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'timeTracking',
    name: 'Time Tracking Tour',
    description: 'Track and analyze your time',
    path: '/time',
    steps: [
      {
        id: 'time-charts',
        target: 'time-charts',
        title: 'Time Analysis',
        description: 'View your time distribution across projects and tasks. Toggle between different chart views.',
        placement: 'bottom',
      },
      {
        id: 'time-filters',
        target: 'time-filters',
        title: 'Filter Time Entries',
        description: 'Filter by date range, project, or user to focus on specific time periods.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'settings',
    name: 'Settings Tour',
    description: 'Configure your workspace',
    path: '/settings',
    adminOnly: true,
    steps: [
      {
        id: 'settings-tabs',
        target: 'settings-tabs',
        title: 'Settings Sections',
        description: 'Navigate between different settings: Users, Clients, Appearance, and more.',
        placement: 'bottom',
      },
      {
        id: 'invite-user',
        target: 'invite-user',
        title: 'Invite Team Members',
        description: 'Add new users to your workspace. They\'ll receive an email invitation to join.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'templates',
    name: 'Templates Tour',
    description: 'Create task templates',
    path: '/templates',
    adminOnly: true,
    steps: [
      {
        id: 'template-sets',
        target: 'template-sets',
        title: 'Template Sets',
        description: 'Template sets group related templates together. They can be triggered manually or automatically.',
        placement: 'right',
      },
      {
        id: 'create-template',
        target: 'create-template',
        title: 'Create Templates',
        description: 'Build reusable task templates with predefined titles, descriptions, and due dates.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'submissions',
    name: 'Task Submissions Tour',
    description: 'Review client requests',
    path: '/submissions',
    adminOnly: true,
    steps: [
      {
        id: 'submissions-list',
        target: 'submissions-list',
        title: 'Client Submissions',
        description: 'Clients can submit task requests through their portal. Review and approve them here.',
        placement: 'bottom',
      },
      {
        id: 'approve-button',
        target: 'approve-button',
        title: 'Approve Requests',
        description: 'Approve submissions to convert them into tasks, or reject with feedback.',
        placement: 'left',
      },
    ],
  },
  {
    id: 'clientPortal',
    name: 'Client Portal Tour',
    description: 'Set up client access',
    path: '/settings',
    adminOnly: true,
    steps: [
      {
        id: 'client-portal-settings',
        target: 'client-portal-settings',
        title: 'Client Portal',
        description: 'Configure which clients can access the portal and manage their viewer permissions.',
        placement: 'bottom',
      },
    ],
  },
];
