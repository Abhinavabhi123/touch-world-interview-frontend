import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CapacityCalculationResult, CapacityConfig, Task, TaskStatus } from '../models/task.model';
import { environment } from '../../environments/environment';
import { toast } from 'ngx-sonner';
import { Observable, catchError, of, tap } from 'rxjs';

export interface TasksApiResponse {
  success: boolean;
  message?: string;
  tasks?: Task[];
  task?: Task;
  data?: any;
}

export interface CapacityApiResponse {
  success: boolean;
  message?: string;
  dailyLimitStoryPoints?: number;
  weeklyLimitStoryPoints?: number;
  data?: CapacityConfig;
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);

  private readonly tasksApiUrl = `${environment.apiUrl}/tasks`;
  private readonly settingsApiUrl = `${environment.apiUrl}/settings/capacity`;

  // Reactive state using Angular Signals - starts empty, loaded from database
  readonly tasks = signal<Task[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly capacityConfig = signal<CapacityConfig>({
    dailyLimitStoryPoints: 8,
    weeklyLimitStoryPoints: 40
  });

  constructor() {
    this.loadCapacityConfig();
    this.loadTasks();
  }

  // 1. Total Tasks
  readonly totalTasks = computed(() => this.tasks().length);

  // 2. Backlog Tasks
  readonly backlogTasks = computed(
    () => this.tasks().filter((task) => task.status === 'backlog').length
  );

  // 3. Planned Tasks
  readonly plannedTasks = computed(
    () => this.tasks().filter((task) => task.status === 'planned').length
  );

  // 4. In Progress Tasks
  readonly inProgressTasks = computed(
    () => this.tasks().filter((task) => task.status === 'in-progress').length
  );

  // 5. Completed Tasks
  readonly completedTasks = computed(
    () => this.tasks().filter((task) => task.status === 'completed').length
  );

  // 6. Total Story Points
  readonly totalStoryPoints = computed(() =>
    this.tasks().reduce((sum, task) => sum + task.storyPoints, 0)
  );

  // Status-specific Story Points
  readonly backlogStoryPoints = computed(() =>
    this.tasks()
      .filter((t) => t.status === 'backlog')
      .reduce((sum, t) => sum + t.storyPoints, 0)
  );

  readonly plannedStoryPoints = computed(() =>
    this.tasks()
      .filter((t) => t.status === 'planned')
      .reduce((sum, t) => sum + t.storyPoints, 0)
  );

  readonly inProgressStoryPoints = computed(() =>
    this.tasks()
      .filter((t) => t.status === 'in-progress')
      .reduce((sum, t) => sum + t.storyPoints, 0)
  );

  readonly completedStoryPoints = computed(() =>
    this.tasks()
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.storyPoints, 0)
  );

  // Active workload (Planned + In-Progress)
  readonly activeStoryPoints = computed(
    () => this.plannedStoryPoints() + this.inProgressStoryPoints()
  );

  // Capacity calculations
  readonly weeklyCapacityUsagePercent = computed(() => {
    const limit = this.capacityConfig().weeklyLimitStoryPoints;
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((this.activeStoryPoints() / limit) * 100));
  });

  readonly isWeeklyCapacityExceeded = computed(() => {
    return this.activeStoryPoints() > this.capacityConfig().weeklyLimitStoryPoints;
  });

  // -------------------------------------------------------------------------
  // CAPACITY CALCULATION ENGINE
  // -------------------------------------------------------------------------

  private getDayRange(targetDate: Date | string): { dayStart: Date; dayEnd: Date } {
    const d = new Date(targetDate);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { dayStart, dayEnd };
  }

  private getWeekRange(targetDate: Date | string): { weekStart: Date; weekEnd: Date } {
    const d = new Date(targetDate);
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const weekStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);

    const sunday = new Date(weekStart);
    sunday.setDate(weekStart.getDate() + 6);
    const weekEnd = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);

    return { weekStart, weekEnd };
  }

  /**
   * Whenever a task is created or updated, calculate:
   * 1. Story Points already planned for the selected day
   * 2. Story Points already planned for the selected week
   * 3. Remaining Daily Capacity
   * 4. Remaining Weekly Capacity
   *
   * @param date - The selected target date
   * @param requestedStoryPoints - Story points of new or updated task
   * @param excludeTaskId - Task ID to exclude (when updating an existing task)
   */
  calculateCapacityMetrics(
    date: Date | string | null | undefined,
    requestedStoryPoints = 0,
    excludeTaskId?: string | number | null
  ): CapacityCalculationResult {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const { dayStart, dayEnd } = this.getDayRange(targetDate);
    const { weekStart, weekEnd } = this.getWeekRange(targetDate);

    const dailyLimit = this.capacityConfig().dailyLimitStoryPoints;
    const weeklyLimit = this.capacityConfig().weeklyLimitStoryPoints;

    // Filter active tasks scheduled for the day
    const dayTasks = this.tasks().filter((t) => {
      if (excludeTaskId && String(t.id) === String(excludeTaskId)) return false;
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      const tDate = new Date(t.dueDate);
      return tDate >= dayStart && tDate <= dayEnd;
    });

    // Filter active tasks scheduled for the week
    const weekTasks = this.tasks().filter((t) => {
      if (excludeTaskId && String(t.id) === String(excludeTaskId)) return false;
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      const tDate = new Date(t.dueDate);
      return tDate >= weekStart && tDate <= weekEnd;
    });

    const plannedDayStoryPoints = dayTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const plannedWeekStoryPoints = weekTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    const remainingDailyCapacity = Math.max(0, dailyLimit - plannedDayStoryPoints);
    const remainingWeeklyCapacity = Math.max(0, weeklyLimit - plannedWeekStoryPoints);

    const requestedSP = Math.max(0, Number(requestedStoryPoints) || 0);

    const exceedsDaily = (plannedDayStoryPoints + requestedSP) > dailyLimit;
    const exceedsWeekly = (plannedWeekStoryPoints + requestedSP) > weeklyLimit;
    const isExceeded = exceedsDaily || exceedsWeekly;

    let validationMessage = '';
    if (exceedsDaily) {
      validationMessage = `Daily capacity limit exceeded! Selected day (${dateStr}) has ${plannedDayStoryPoints} SP planned. Remaining daily capacity: ${remainingDailyCapacity} SP (Daily limit: ${dailyLimit} SP). Cannot add ${requestedSP} SP.`;
    } else if (exceedsWeekly) {
      validationMessage = `Weekly capacity limit exceeded! Selected week has ${plannedWeekStoryPoints} SP planned. Remaining weekly capacity: ${remainingWeeklyCapacity} SP (Weekly limit: ${weeklyLimit} SP). Cannot add ${requestedSP} SP.`;
    }

    return {
      selectedDate: dateStr,
      plannedDayStoryPoints,
      plannedWeekStoryPoints,
      remainingDailyCapacity,
      remainingWeeklyCapacity,
      dailyLimit,
      weeklyLimit,
      requestedStoryPoints: requestedSP,
      exceedsDaily,
      exceedsWeekly,
      isExceeded,
      validationMessage
    };
  }

  // -------------------------------------------------------------------------
  // BACKEND API INTEGRATIONS
  // -------------------------------------------------------------------------

  /**
   * GET /tasks or GET /api/tasks
   */
  loadTasks(): void {
    this.isLoading.set(true);
    this.http.get<TasksApiResponse>(this.tasksApiUrl).pipe(
      catchError(() => {
        return of({ success: false, tasks: [] } as TasksApiResponse);
      })
    ).subscribe((response: TasksApiResponse) => {
      this.isLoading.set(false);
      const fetchedTasks = response.tasks || (Array.isArray(response.data) ? response.data : undefined);
      if (Array.isArray(fetchedTasks)) {
        this.tasks.set(fetchedTasks);
      }
    });
  }

  /**
   * GET /settings/capacity or GET /api/settings/capacity
   */
  loadCapacityConfig(): void {
    this.http.get<CapacityApiResponse>(this.settingsApiUrl).pipe(
      catchError(() => of(null))
    ).subscribe((response: CapacityApiResponse | null) => {
      if (response) {
        const daily = response.dailyLimitStoryPoints || response.data?.dailyLimitStoryPoints;
        const weekly = response.weeklyLimitStoryPoints || response.data?.weeklyLimitStoryPoints;
        if (daily && weekly) {
          this.capacityConfig.set({
            dailyLimitStoryPoints: Number(daily),
            weeklyLimitStoryPoints: Number(weekly)
          });
        }
      }
    });
  }

  /**
   * POST /tasks or POST /api/tasks
   */
  addTask(newTaskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      // 1. Client-Side Capacity Guard Check
      if (newTaskData.status !== 'completed') {
        const metrics = this.calculateCapacityMetrics(
          newTaskData.dueDate,
          newTaskData.storyPoints,
          null
        );

        if (metrics.isExceeded) {
          toast.error('Capacity Limit Exceeded', {
            description: metrics.validationMessage
          });
          reject(new Error(metrics.validationMessage));
          return;
        }
      }

      // 2. Call Express Backend POST /tasks
      this.http.post<TasksApiResponse>(this.tasksApiUrl, newTaskData).subscribe({
        next: (response: TasksApiResponse) => {
          const created = response.task || (response.data && !Array.isArray(response.data) ? response.data : undefined) || {
            ...newTaskData,
            id: Date.now(),
            createdAt: new Date()
          };

          this.tasks.update((list) => [created, ...list]);

          toast.success('Task Created Successfully', {
            description: `"${created.title}" saved with ${created.storyPoints} Story Points.`
          });
          resolve(created);
        },
        error: (err) => {
          const msg = err.error?.message || err.message || 'Failed to save task to backend.';
          toast.error('Task Creation Blocked', {
            description: msg
          });
          reject(err);
        }
      });
    });
  }

  /**
   * PUT /tasks/:id or PUT /api/tasks/:id
   */
  updateTask(taskId: string | number, updatedData: Partial<Task>): Promise<Task | null> {
    return new Promise((resolve, reject) => {
      const existing = this.tasks().find((t) => String(t.id) === String(taskId));
      if (!existing) {
        reject(new Error('Task not found'));
        return;
      }

      const merged = { ...existing, ...updatedData };

      // 1. Client-Side Capacity Guard Check
      if (merged.status !== 'completed') {
        const metrics = this.calculateCapacityMetrics(
          merged.dueDate,
          merged.storyPoints,
          taskId
        );

        if (metrics.isExceeded) {
          toast.error('Capacity Limit Exceeded', {
            description: metrics.validationMessage
          });
          reject(new Error(metrics.validationMessage));
          return;
        }
      }

      // 2. Call Express Backend PUT /tasks/:id
      this.http.put<TasksApiResponse>(`${this.tasksApiUrl}/${taskId}`, updatedData).subscribe({
        next: (response: TasksApiResponse) => {
          const updated = response.task || (response.data && !Array.isArray(response.data) ? response.data : undefined) || merged;

          this.tasks.update((list) =>
            list.map((t) => (String(t.id) === String(taskId) ? updated : t))
          );

          toast.success('Task Updated Successfully', {
            description: `"${updated.title}" has been saved.`
          });
          resolve(updated);
        },
        error: (err) => {
          const msg = err.error?.message || err.message || 'Failed to update task.';
          toast.error('Update Blocked', {
            description: msg
          });
          reject(err);
        }
      });
    });
  }

  /**
   * Update task status shortcut
   */
  updateTaskStatus(taskId: string | number, newStatus: TaskStatus): void {
    const existing = this.tasks().find((t) => String(t.id) === String(taskId));
    if (!existing) return;

    this.updateTask(taskId, { status: newStatus }).then(() => {
      toast.info('Status Updated', {
        description: `Task moved to ${newStatus.toUpperCase()}`
      });
    }).catch(() => {});
  }

  /**
   * DELETE /tasks/:id or DELETE /api/tasks/:id
   */
  deleteTask(taskId: string | number): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.delete(`${this.tasksApiUrl}/${taskId}`).subscribe({
        next: () => {
          this.tasks.update((list) => list.filter((t) => String(t.id) !== String(taskId)));
          toast.success('Task Deleted', {
            description: `Task has been removed from database.`
          });
          resolve(true);
        },
        error: () => {
          // If network failed, remove locally
          this.tasks.update((list) => list.filter((t) => String(t.id) !== String(taskId)));
          toast.success('Task Deleted', {
            description: `Task removed.`
          });
          resolve(true);
        }
      });
    });
  }

  /**
   * PUT /settings/capacity or PUT /api/settings/capacity
   */
  updateCapacityConfig(newConfig: CapacityConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.put(this.settingsApiUrl, newConfig).subscribe({
        next: () => {
          this.capacityConfig.set(newConfig);
          toast.success('Capacity Settings Saved', {
            description: `Daily Limit: ${newConfig.dailyLimitStoryPoints} SP | Weekly Limit: ${newConfig.weeklyLimitStoryPoints} SP saved to DB.`
          });
          resolve(true);
        },
        error: () => {
          // Fallback update in state
          this.capacityConfig.set(newConfig);
          toast.success('Capacity Settings Updated', {
            description: `Daily Limit: ${newConfig.dailyLimitStoryPoints} SP | Weekly Limit: ${newConfig.weeklyLimitStoryPoints} SP.`
          });
          resolve(true);
        }
      });
    });
  }
}
