import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaskService } from '../../services/task.service';
import { Task, TaskStatus } from '../../models/task.model';
import { toast } from 'ngx-sonner';

export interface KanbanColumnDef {
  id: TaskStatus;
  title: string;
  icon: string;
  accentClass: string;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.css'
})
export class KanbanBoardComponent {
  readonly taskService = inject(TaskService);

  @Output() editTask = new EventEmitter<Task>();
  @Output() createTask = new EventEmitter<void>();

  @Input() searchQuery = '';
  @Input() selectedPriority = 'all';

  // Column definitions
  readonly columns: KanbanColumnDef[] = [
    { id: 'backlog', title: 'Backlog', icon: 'inventory_2', accentClass: 'accent-backlog' },
    { id: 'planned', title: 'Planned', icon: 'event_note', accentClass: 'accent-planned' },
    { id: 'in-progress', title: 'In Progress', icon: 'pending_actions', accentClass: 'accent-inprogress' },
    { id: 'completed', title: 'Completed', icon: 'task_alt', accentClass: 'accent-completed' }
  ];

  // Connected drop list IDs for cross-column drag and drop
  readonly dropListIds = ['backlog', 'planned', 'in-progress', 'completed'];

  // Categorized tasks signals
  readonly backlogTasks = computed(() =>
    this.taskService.tasks().filter((t) => t.status === 'backlog')
  );

  readonly plannedTasks = computed(() =>
    this.taskService.tasks().filter((t) => t.status === 'planned')
  );

  readonly inProgressTasks = computed(() =>
    this.taskService.tasks().filter((t) => t.status === 'in-progress')
  );

  readonly completedTasks = computed(() =>
    this.taskService.tasks().filter((t) => t.status === 'completed')
  );

  /**
   * Retrieve tasks for a given column with search and priority filtering applied
   */
  getTasksForColumn(colId: TaskStatus): Task[] {
    let list: Task[] = [];
    switch (colId) {
      case 'backlog':
        list = this.backlogTasks();
        break;
      case 'planned':
        list = this.plannedTasks();
        break;
      case 'in-progress':
        list = this.inProgressTasks();
        break;
      case 'completed':
        list = this.completedTasks();
        break;
    }

    if (this.selectedPriority && this.selectedPriority !== 'all') {
      list = list.filter((t) => t.priority === this.selectedPriority);
    }

    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          String(t.id).toLowerCase().includes(q)
      );
    }

    return list;
  }

  /**
   * Retrieve total story points for a given column
   */
  getStoryPointsForColumn(colId: TaskStatus): number {
    return this.getTasksForColumn(colId).reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  }

  /**
   * Title formatter for notifications
   */
  getColumnTitle(colId: TaskStatus): string {
    const col = this.columns.find((c) => c.id === colId);
    return col ? col.title : colId;
  }

  /**
   * Handle Drag & Drop with strict business rules enforcement
   */
  async onDrop(event: CdkDragDrop<Task[], Task[], Task>): Promise<void> {
    const sourceStatus = event.previousContainer.id as TaskStatus;
    const targetStatus = event.container.id as TaskStatus;
    const task = event.item.data as Task;

    // Dropped in the same column - no status change needed
    if (sourceStatus === targetStatus) {
      return;
    }

    // -----------------------------------------------------------------------
    // BUSINESS RULE 1: Completed tasks cannot be moved back to Backlog
    // -----------------------------------------------------------------------
    if (sourceStatus === 'completed' && targetStatus === 'backlog') {
      toast.error('Move Blocked', {
        description: 'Completed tasks cannot be moved back to Backlog.'
      });
      return;
    }

    // -----------------------------------------------------------------------
    // BUSINESS RULE 2: Moving from Backlog to Planned must validate Daily & Weekly limits
    // -----------------------------------------------------------------------
    if (sourceStatus === 'backlog' && targetStatus === 'planned') {
      const targetDate = task.dueDate || new Date().toISOString().split('T')[0];
      const metrics = this.taskService.calculateCapacityMetrics(
        targetDate,
        task.storyPoints,
        task.id
      );

      if (metrics.isExceeded) {
        // Cancel move and display appropriate validation message
        toast.error('Capacity Limit Exceeded - Move Cancelled', {
          description: metrics.validationMessage
        });
        return;
      }
    }

    // -----------------------------------------------------------------------
    // BUSINESS RULE 3: Valid move - Persist changes in the database
    // -----------------------------------------------------------------------
    try {
      const updatedDueDate =
        targetStatus === 'planned' && !task.dueDate
          ? new Date().toISOString().split('T')[0]
          : task.dueDate;

      await this.taskService.updateTask(task.id, {
        status: targetStatus,
        dueDate: updatedDueDate
      });

      toast.success('Task Moved Successfully', {
        description: `"${task.title}" is now ${this.getColumnTitle(targetStatus)}.`
      });
    } catch (err: any) {
      toast.error('Failed to move task', {
        description: err.error?.message || err.message || 'Database error occurred while updating task status.'
      });
    }
  }

  onEdit(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.editTask.emit(task);
  }

  onDelete(task: Task, event: MouseEvent): void {
    event.stopPropagation();
    this.taskService.deleteTask(task.id);
  }
}

