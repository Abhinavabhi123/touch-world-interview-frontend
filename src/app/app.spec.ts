import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { App } from './app';
import { TaskService } from './services/task.service';
import { AuthService } from './services/auth.service';
import { LoadingService } from './services/loading.service';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { KanbanBoardComponent } from './components/kanban-board/kanban-board.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

describe('App & Task Management Dashboard', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, DashboardComponent, SidebarComponent, KanbanBoardComponent, NotFoundComponent],
      providers: [
        provideAnimationsAsync(),
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create the app shell with router outlet', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  }, 15000);

  it('should accurately compute the 6 dashboard summary metrics', () => {
    const taskService = TestBed.inject(TaskService);

    // Populate with test tasks for metric verification
    taskService.tasks.set([
      { id: 1, title: 'Task 1', status: 'backlog', storyPoints: 2, priority: 'low', createdAt: new Date() },
      { id: 2, title: 'Task 2', status: 'planned', storyPoints: 3, priority: 'medium', createdAt: new Date() },
      { id: 3, title: 'Task 3', status: 'in-progress', storyPoints: 5, priority: 'high', createdAt: new Date() },
      { id: 4, title: 'Task 4', status: 'completed', storyPoints: 8, priority: 'urgent', createdAt: new Date() }
    ]);

    expect(taskService.totalTasks()).toBe(4);
    expect(taskService.backlogTasks()).toBe(1);
    expect(taskService.plannedTasks()).toBe(1);
    expect(taskService.inProgressTasks()).toBe(1);
    expect(taskService.completedTasks()).toBe(1);
    expect(taskService.totalStoryPoints()).toBe(18);
  }, 15000);

  it('should store and retrieve JWT token in localStorage via AuthService', () => {
    const authService = TestBed.inject(AuthService);
    expect(authService.isLoggedIn()).toBe(false);

    const mockToken = 'mock_jwt_token_header.payload.signature';
    authService.saveToken(mockToken);

    expect(authService.getToken()).toBe(mockToken);
    expect(authService.isLoggedIn()).toBe(true);

    authService.logout();
    expect(authService.getToken()).toBeNull();
    expect(authService.isLoggedIn()).toBe(false);
  }, 15000);

  it('should guard protected dashboard route when unauthenticated and allow when authenticated', () => {
    const authService = TestBed.inject(AuthService);
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/dashboard' } as RouterStateSnapshot;

    // Test unauthenticated
    const resultUnauth = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(resultUnauth).not.toBe(true); // Returns UrlTree to /login

    // Test authenticated
    authService.saveToken('valid_jwt_token');
    const resultAuth = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(resultAuth).toBe(true);
  }, 15000);

  it('should guard login route when already logged in and redirect to dashboard', () => {
    const authService = TestBed.inject(AuthService);
    const mockRoute = {} as ActivatedRouteSnapshot;
    const mockState = { url: '/login' } as RouterStateSnapshot;

    // When unauthenticated, allows visiting /login
    const resultGuest = TestBed.runInInjectionContext(() => guestGuard(mockRoute, mockState));
    expect(resultGuest).toBe(true);

    // When authenticated, blocks /login and returns UrlTree to /dashboard
    authService.saveToken('valid_jwt_token');
    const resultAuth = TestBed.runInInjectionContext(() => guestGuard(mockRoute, mockState));
    expect(resultAuth).not.toBe(true);
  }, 15000);

  it('should render the 6 summary metric cards on the dashboard', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const metricLabels = Array.from(compiled.querySelectorAll('.metric-label')).map(
      (el) => el.textContent?.trim()
    );

    expect(metricLabels).toContain('Total Tasks');
    expect(metricLabels).toContain('Backlog Tasks');
    expect(metricLabels).toContain('Planned Tasks');
    expect(metricLabels).toContain('In Progress Tasks');
    expect(metricLabels).toContain('Completed Tasks');
    expect(metricLabels).toContain('Total Story Points');
  }, 15000);

  it('should create and render the reusable SidebarComponent', async () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    const component = fixture.componentInstance;
    component.isCollapsed = false;
    component.isMobileOpen = false;
    fixture.detectChanges();

    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('TaskFlow');

    // Test navigation selection event emission
    let selectedNav = '';
    component.navSelect.subscribe((nav: string) => {
      selectedNav = nav;
    });

    component.onSelectNav('dashboard');
    expect(selectedNav).toBe('dashboard');
  }, 15000);

  it('should calculate planned day/week story points and enforce capacity limits', () => {
    const taskService = TestBed.inject(TaskService);
    const today = new Date().toISOString().split('T')[0];

    // Calculate metrics with 3 requested SP on today
    const metrics = taskService.calculateCapacityMetrics(today, 3, null);

    expect(metrics.selectedDate).toBe(today);
    expect(metrics.plannedDayStoryPoints).toBeGreaterThanOrEqual(0);
    expect(metrics.plannedWeekStoryPoints).toBeGreaterThanOrEqual(0);
    expect(metrics.remainingDailyCapacity).toBeLessThanOrEqual(taskService.capacityConfig().dailyLimitStoryPoints);
    expect(metrics.remainingWeeklyCapacity).toBeLessThanOrEqual(taskService.capacityConfig().weeklyLimitStoryPoints);

    // Test exceeding daily capacity limit (e.g., requesting 99 story points when limit is 8)
    const excessMetrics = taskService.calculateCapacityMetrics(today, 99, null);
    expect(excessMetrics.isExceeded).toBe(true);
    expect(excessMetrics.exceedsDaily).toBe(true);
    expect(excessMetrics.validationMessage).toContain('capacity limit exceeded');
  }, 15000);

  it('should render KanbanBoardComponent with 4 columns and enforce drag-and-drop business rules', async () => {
    const fixture = TestBed.createComponent(KanbanBoardComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;

    // Verify all 4 required columns are rendered
    const columnTitles = Array.from(compiled.querySelectorAll('.col-title')).map((el) =>
      el.textContent?.trim()
    );
    expect(columnTitles).toContain('Backlog');
    expect(columnTitles).toContain('Planned');
    expect(columnTitles).toContain('In Progress');
    expect(columnTitles).toContain('Completed');

    // Test Business Rule 1: Completed task cannot be moved to Backlog
    const completedTask = component.completedTasks()[0] || {
      id: 999,
      title: 'Completed Test Task',
      status: 'completed',
      storyPoints: 3,
      priority: 'low',
      createdAt: new Date()
    };

    const mockDropCompletedToBacklog = {
      previousContainer: { id: 'completed' },
      container: { id: 'backlog' },
      item: { data: completedTask }
    } as any;

    await component.onDrop(mockDropCompletedToBacklog);
    // Task status remains completed (move cancelled)
    expect(completedTask.status).toBe('completed');
  }, 15000);

  it('should toggle full-page loader state via LoadingService', () => {
    const loadingService = TestBed.inject(LoadingService);

    loadingService.show('Navigating to dashboard...');
    expect(loadingService.isLoading()).toBe(true);
    expect(loadingService.loadingMessage()).toBe('Navigating to dashboard...');

    loadingService.hide(0);
    expect(loadingService.isLoading()).toBe(false);
  }, 15000);

  it('should support search, filtering, sorting, and pagination in DashboardComponent', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    const taskService = TestBed.inject(TaskService);

    // Seed mock tasks into taskService
    taskService.tasks.set([
      { id: 1, title: 'Alpha Feature', description: 'Backend service', status: 'backlog', storyPoints: 2, priority: 'low', createdAt: new Date('2026-01-01') },
      { id: 2, title: 'Beta UI', description: 'Design implementation', status: 'planned', storyPoints: 5, priority: 'urgent', createdAt: new Date('2026-01-02') },
      { id: 3, title: 'Gamma Testing', description: 'E2E test suite', status: 'in-progress', storyPoints: 8, priority: 'high', createdAt: new Date('2026-01-03') },
      { id: 4, title: 'Delta Deployment', description: 'Deploy pipeline', status: 'completed', storyPoints: 13, priority: 'medium', createdAt: new Date('2026-01-04') },
      { id: 5, title: 'Epsilon Docs', description: 'API documentation', status: 'planned', storyPoints: 1, priority: 'low', createdAt: new Date('2026-01-05') },
      { id: 6, title: 'Zeta Security', description: 'Auth review', status: 'in-progress', storyPoints: 3, priority: 'urgent', createdAt: new Date('2026-01-06') },
      { id: 7, title: 'Eta Monitoring', description: 'Log monitoring', status: 'backlog', storyPoints: 5, priority: 'high', createdAt: new Date('2026-01-07') }
    ]);

    component.pageSize.set(3);
    fixture.detectChanges();

    // 1. Initial State: 7 total tasks, 3 per page -> 3 pages
    expect(component.totalFilteredTasks()).toBe(7);
    expect(component.totalPages()).toBe(3);
    expect(component.paginatedTasks().length).toBe(3);

    // 2. Search Query Test
    component.onSearchInput('gamma');
    expect(component.totalFilteredTasks()).toBe(1);
    expect(component.filteredTasks()[0].title).toBe('Gamma Testing');
    component.clearSearch();
    expect(component.totalFilteredTasks()).toBe(7);

    // 3. Priority Filter Test
    component.onPriorityChange('urgent');
    expect(component.totalFilteredTasks()).toBe(2);
    expect(component.filteredTasks().every((t) => t.priority === 'urgent')).toBe(true);
    component.onPriorityChange('all');
    expect(component.totalFilteredTasks()).toBe(7);

    // 4. Story Points Range Filter Test
    component.onStoryPointsChange('5-8');
    expect(component.totalFilteredTasks()).toBe(3); // id 2 (5), id 3 (8), id 7 (5)
    component.onStoryPointsChange('all');

    // 5. Sorting Test (Story Points Ascending)
    component.setSortField('storyPoints');
    component.sortOrder.set('asc');
    const sortedPoints = component.sortedTasks().map((t) => t.storyPoints);
    expect(sortedPoints).toEqual([1, 2, 3, 5, 5, 8, 13]);

    // 6. Pagination Navigation Test
    component.changePageSize(3);
    expect(component.currentPage()).toBe(1);
    component.nextPage();
    expect(component.currentPage()).toBe(2);
    expect(component.paginatedTasks().length).toBe(3);
    component.nextPage();
    expect(component.currentPage()).toBe(3);
    expect(component.paginatedTasks().length).toBe(1);
    component.prevPage();
    expect(component.currentPage()).toBe(2);

    // 7. Reset All Filters
    component.resetAllFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.selectedPriority()).toBe('all');
    expect(component.selectedStoryPoints()).toBe('all');
    expect(component.sortBy()).toBe('createdAt');
    expect(component.sortOrder()).toBe('desc');
    expect(component.currentPage()).toBe(1);
  }, 15000);
});
