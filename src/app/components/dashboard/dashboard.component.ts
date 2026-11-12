import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { KanbanBoardComponent } from '../kanban-board/kanban-board.component';
import { CapacityCalculationResult, Task, TaskPriority, TaskStatus } from '../../models/task.model';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    SidebarComponent,
    KanbanBoardComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly taskService = inject(TaskService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Sidebar state signals
  readonly isSidebarCollapsed = signal<boolean>(false);
  readonly isMobileSidebarOpen = signal<boolean>(false);
  readonly activeNavItem = signal<string>('dashboard');

  // Active filter tab for task list
  readonly selectedFilter = signal<'all' | TaskStatus>('all');

  // Search, Filter, Sort & Pagination Signals
  readonly searchQuery = signal<string>('');
  readonly selectedPriority = signal<'all' | TaskPriority>('all');
  readonly selectedStoryPoints = signal<string>('all');
  readonly sortBy = signal<'createdAt' | 'dueDate' | 'storyPoints' | 'priority' | 'title'>('createdAt');
  readonly sortOrder = signal<'asc' | 'desc'>('desc');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(6);
  readonly pageSizeOptions = [6, 9, 12, 24];

  // View mode switcher: 'kanban' (CDK Drag & Drop) or 'grid'
  readonly currentViewMode = signal<'kanban' | 'grid'>('kanban');

  // Modal / Form toggle states
  readonly isCreateTaskOpen = signal<boolean>(false);
  readonly isCapacitySettingsOpen = signal<boolean>(false);
  readonly editingTaskId = signal<string | number | null>(null);
  readonly isSubmitting = signal<boolean>(false);

  // Signal tracking live form values for real-time capacity calculations
  readonly formValuesSignal = signal<{
    dueDate: string;
    storyPoints: number;
    status: TaskStatus;
  }>({
    dueDate: new Date().toISOString().split('T')[0],
    storyPoints: 3,
    status: 'planned'
  });

  // Filtered tasks computation with multi-criteria support (status, search query, priority, story points)
  readonly filteredTasks = computed(() => {
    const statusFilter = this.selectedFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const priorityFilter = this.selectedPriority();
    const spFilter = this.selectedStoryPoints();

    return this.taskService.tasks().filter((task) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // 2. Priority Filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // 3. Story Points Filter
      if (spFilter !== 'all') {
        const points = task.storyPoints;
        if (spFilter === '1-3' && (points < 1 || points > 3)) return false;
        if (spFilter === '5-8' && (points < 5 || points > 8)) return false;
        if (spFilter === '13+' && points < 13) return false;
      }

      // 4. Search Filter (matches title, description, or task id)
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        const idMatch = String(task.id).toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  });

  // Sorted tasks computation
  readonly sortedTasks = computed(() => {
    const tasks = [...this.filteredTasks()];
    const field = this.sortBy();
    const order = this.sortOrder();
    const multiplier = order === 'asc' ? 1 : -1;

    const priorityRank: Record<TaskPriority, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    return tasks.sort((a, b) => {
      if (field === 'storyPoints') {
        return (a.storyPoints - b.storyPoints) * multiplier;
      }
      if (field === 'priority') {
        const rankA = priorityRank[a.priority] || 0;
        const rankB = priorityRank[b.priority] || 0;
        return (rankA - rankB) * multiplier;
      }
      if (field === 'title') {
        return a.title.localeCompare(b.title) * multiplier;
      }
      if (field === 'dueDate') {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return (timeA - timeB) * multiplier;
      }
      // Default: createdAt or id
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id) || 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id) || 0;
      return (timeA - timeB) * multiplier;
    });
  });

  // Total filtered and sorted tasks count
  readonly totalFilteredTasks = computed(() => this.sortedTasks().length);

  // Total pages based on current page size
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalFilteredTasks() / this.pageSize()))
  );

  // Paginated tasks slice for grid display
  readonly paginatedTasks = computed(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    return this.sortedTasks().slice(startIndex, startIndex + size);
  });

  // Pagination display range text (e.g. "Showing 1-6 of 18 tasks")
  readonly paginationRangeText = computed(() => {
    const total = this.totalFilteredTasks();
    if (total === 0) return '0 of 0';
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(this.currentPage() * this.pageSize(), total);
    return `${start} - ${end} of ${total}`;
  });

  // Array of page numbers for pagination buttons
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  });

  // Whether any filter, search, or non-default sort is active
  readonly hasActiveFilters = computed(() => {
    return (
      this.searchQuery().trim() !== '' ||
      this.selectedPriority() !== 'all' ||
      this.selectedStoryPoints() !== 'all' ||
      this.selectedFilter() !== 'all' ||
      this.sortBy() !== 'createdAt' ||
      this.sortOrder() !== 'desc'
    );
  });

  // Fibonacci options for story points estimation
  readonly storyPointOptions = [1, 2, 3, 5, 8, 13, 21];

  // Task Form (used for both Create and Update)
  taskForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    status: ['planned' as TaskStatus, Validators.required],
    storyPoints: [3, [Validators.required, Validators.min(1)]],
    priority: ['medium' as TaskPriority, Validators.required],
    dueDate: [new Date().toISOString().split('T')[0], Validators.required]
  });

  // Capacity Settings Form
  capacityForm: FormGroup = this.fb.group({
    dailyLimit: [
      this.taskService.capacityConfig().dailyLimitStoryPoints,
      [Validators.required, Validators.min(1), Validators.max(50)]
    ],
    weeklyLimit: [
      this.taskService.capacityConfig().weeklyLimitStoryPoints,
      [Validators.required, Validators.min(1), Validators.max(200)]
    ]
  });

  /**
   * Computed assessment of capacity impact for the current task form state:
   * 1. Story Points already planned for the selected day
   * 2. Story Points already planned for the selected week
   * 3. Remaining Daily Capacity
   * 4. Remaining Weekly Capacity
   * 5. Exceeded status and validation message
   */
  readonly currentCapacityAssessment = computed<CapacityCalculationResult>(() => {
    const formVal = this.formValuesSignal();
    const excludeId = this.editingTaskId();
    const sp = Number(formVal.storyPoints) || 0;
    const date = formVal.dueDate;

    if (formVal.status === 'completed') {
      const dailyLimit = this.taskService.capacityConfig().dailyLimitStoryPoints;
      const weeklyLimit = this.taskService.capacityConfig().weeklyLimitStoryPoints;
      return {
        selectedDate: date || 'N/A',
        plannedDayStoryPoints: 0,
        plannedWeekStoryPoints: 0,
        remainingDailyCapacity: dailyLimit,
        remainingWeeklyCapacity: weeklyLimit,
        dailyLimit,
        weeklyLimit,
        requestedStoryPoints: sp,
        exceedsDaily: false,
        exceedsWeekly: false,
        isExceeded: false,
        validationMessage: ''
      };
    }

    return this.taskService.calculateCapacityMetrics(date, sp, excludeId);
  });

  /**
   * Computed today's capacity overview for settings panel
   */
  readonly todayCapacityOverview = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.taskService.calculateCapacityMetrics(today, 0, null);
  });

  private popstateListener = (): void => {
    // When browser back button is clicked while logged in, absorb it so it doesn't leave the dashboard
    window.history.pushState(null, '', window.location.href);
  };

  ngOnInit(): void {
    // Prevent browser back button from navigating back to login page
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.popstateListener);

    // Sync form values to reactive signal for real-time calculation
    this.taskForm.valueChanges.subscribe((val) => {
      this.formValuesSignal.set({
        dueDate: val?.dueDate || new Date().toISOString().split('T')[0],
        storyPoints: Number(val?.storyPoints) || 0,
        status: val?.status || 'planned'
      });
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.popstateListener);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((val) => !val);
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((val) => !val);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  setActiveNav(item: string): void {
    this.activeNavItem.set(item);
    if (item === 'kanban') {
      this.currentViewMode.set('kanban');
    } else if (item === 'dashboard') {
      this.currentViewMode.set('kanban');
    } else if (item === 'capacity' || item === 'settings') {
      this.openCapacitySettings();
    }
    this.closeMobileSidebar();
  }

  setViewMode(mode: 'kanban' | 'grid'): void {
    this.currentViewMode.set(mode);
  }

  setFilter(status: 'all' | TaskStatus): void {
    this.selectedFilter.set(status);
    this.currentPage.set(1);
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  onPriorityChange(priority: 'all' | TaskPriority): void {
    this.selectedPriority.set(priority);
    this.currentPage.set(1);
  }

  onStoryPointsChange(range: string): void {
    this.selectedStoryPoints.set(range);
    this.currentPage.set(1);
  }

  setSortField(field: 'createdAt' | 'dueDate' | 'storyPoints' | 'priority' | 'title'): void {
    this.sortBy.set(field);
  }

  toggleSortOrder(): void {
    this.sortOrder.update((curr) => (curr === 'asc' ? 'desc' : 'asc'));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
    }
  }

  changePageSize(newSize: number): void {
    this.pageSize.set(Number(newSize));
    this.currentPage.set(1);
  }

  resetAllFilters(): void {
    this.searchQuery.set('');
    this.selectedPriority.set('all');
    this.selectedStoryPoints.set('all');
    this.selectedFilter.set('all');
    this.sortBy.set('createdAt');
    this.sortOrder.set('desc');
    this.currentPage.set(1);
  }

  openCreateTaskModal(): void {
    this.editingTaskId.set(null);
    const todayStr = new Date().toISOString().split('T')[0];
    this.taskForm.reset({
      title: '',
      description: '',
      status: 'planned',
      storyPoints: 3,
      priority: 'medium',
      dueDate: todayStr
    });
    this.formValuesSignal.set({
      dueDate: todayStr,
      storyPoints: 3,
      status: 'planned'
    });
    this.isCreateTaskOpen.set(true);
  }

  openEditTaskModal(task: Task): void {
    this.editingTaskId.set(task.id);
    const taskDate = task.dueDate
      ? new Date(task.dueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    this.taskForm.reset({
      title: task.title,
      description: task.description || '',
      status: task.status,
      storyPoints: task.storyPoints,
      priority: task.priority,
      dueDate: taskDate
    });
    this.formValuesSignal.set({
      dueDate: taskDate,
      storyPoints: task.storyPoints,
      status: task.status
    });
    this.isCreateTaskOpen.set(true);
  }

  closeCreateTaskModal(): void {
    this.isCreateTaskOpen.set(false);
    this.editingTaskId.set(null);
  }

  /**
   * Save task (handles both Create and Update with capacity limits enforcement)
   */
  async submitTask(): Promise<void> {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      toast.error('Validation Error', {
        description: 'Please provide a valid title and story points.'
      });
      return;
    }

    const assessment = this.currentCapacityAssessment();
    if (assessment.isExceeded) {
      // Prevent the task from being saved!
      toast.error('Capacity Limit Exceeded', {
        description: assessment.validationMessage
      });
      return;
    }

    this.isSubmitting.set(true);
    const formVal = this.taskForm.value;
    const editId = this.editingTaskId();

    try {
      if (editId) {
        await this.taskService.updateTask(editId, {
          title: formVal.title.trim(),
          description: formVal.description?.trim() || '',
          status: formVal.status,
          storyPoints: Number(formVal.storyPoints),
          priority: formVal.priority,
          dueDate: formVal.dueDate || undefined
        });
      } else {
        await this.taskService.addTask({
          title: formVal.title.trim(),
          description: formVal.description?.trim() || '',
          status: formVal.status,
          storyPoints: Number(formVal.storyPoints),
          priority: formVal.priority,
          dueDate: formVal.dueDate || undefined
        });
      }
      this.closeCreateTaskModal();
    } catch {
      // Service toasts error
    } finally {
      this.isSubmitting.set(false);
    }
  }

  openCapacitySettings(): void {
    const current = this.taskService.capacityConfig();
    this.capacityForm.patchValue({
      dailyLimit: current.dailyLimitStoryPoints,
      weeklyLimit: current.weeklyLimitStoryPoints
    });
    this.isCapacitySettingsOpen.set(true);
  }

  closeCapacitySettings(): void {
    this.isCapacitySettingsOpen.set(false);
  }

  async saveCapacitySettings(): Promise<void> {
    if (this.capacityForm.invalid) {
      toast.error('Invalid Limits', {
        description: 'Please specify positive values for daily and weekly limits.'
      });
      return;
    }

    const { dailyLimit, weeklyLimit } = this.capacityForm.value;
    await this.taskService.updateCapacityConfig({
      dailyLimitStoryPoints: Number(dailyLimit),
      weeklyLimitStoryPoints: Number(weeklyLimit)
    });

    this.closeCapacitySettings();
  }

  changeStatus(taskId: string | number, newStatus: TaskStatus): void {
    this.taskService.updateTaskStatus(taskId, newStatus);
  }

  removeTask(taskId: string | number): void {
    this.taskService.deleteTask(taskId);
  }

  logout(): void {
    this.authService.logout();
  }
}
