export type TaskStatus = 'backlog' | 'planned' | 'in-progress' | 'completed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: TaskStatus;
  storyPoints: number;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: string;
  userId?: number;
  user?: {
    id: number;
    name?: string;
    email: string;
  };
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface CapacityConfig {
  dailyLimitStoryPoints: number;
  weeklyLimitStoryPoints: number;
}

export interface CapacityCalculationResult {
  selectedDate: string;
  plannedDayStoryPoints: number;
  plannedWeekStoryPoints: number;
  remainingDailyCapacity: number;
  remainingWeeklyCapacity: number;
  dailyLimit: number;
  weeklyLimit: number;
  requestedStoryPoints: number;
  exceedsDaily: boolean;
  exceedsWeekly: boolean;
  isExceeded: boolean;
  validationMessage?: string;
}

export interface DashboardSummary {
  totalTasks: number;
  backlogTasks: number;
  plannedTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  totalStoryPoints: number;
}
