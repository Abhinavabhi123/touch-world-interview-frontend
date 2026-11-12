import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { TaskStatus } from '../../models/task.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  readonly taskService = inject(TaskService);
  readonly authService = inject(AuthService);

  /** Whether the sidebar is collapsed to icon-only mode (desktop) */
  @Input() isCollapsed = false;

  /** Whether the mobile slide-out drawer is open */
  @Input() isMobileOpen = false;

  /** Active navigation item identifier */
  @Input() activeItem = 'dashboard';

  /** Brand title display */
  @Input() brandTitle = 'TaskFlow';

  /** Brand subtitle display */
  @Input() brandSubtitle = 'Admin Portal';

  /** Emitted when sidebar collapse state is toggled */
  @Output() collapsedChange = new EventEmitter<boolean>();

  /** Emitted when mobile sidebar close is requested */
  @Output() closeMobile = new EventEmitter<void>();

  /** Emitted when a navigation item is selected */
  @Output() navSelect = new EventEmitter<string>();

  /** Emitted when a task filter is selected (e.g., 'all' or 'backlog') */
  @Output() filterSelect = new EventEmitter<'all' | TaskStatus>();

  /** Emitted when capacity configuration action is clicked */
  @Output() openCapacity = new EventEmitter<void>();

  /** Emitted when user clicks logout */
  @Output() logout = new EventEmitter<void>();

  onCloseMobile(): void {
    this.closeMobile.emit();
  }

  onSelectNav(itemId: string): void {
    if (itemId === 'capacity' || itemId === 'settings') {
      this.openCapacity.emit();
    } else {
      if (itemId === 'dashboard') {
        this.filterSelect.emit('all');
      }
      this.navSelect.emit(itemId);
    }
    this.closeMobile.emit();
  }

  onLogout(): void {
    if (this.logout.observed) {
      this.logout.emit();
    } else {
      this.authService.logout();
    }
  }
}

