import { Injectable, inject, signal } from '@angular/core';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  Event as RouterEvent
} from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly router = inject(Router);

  // Reactive state signals
  readonly isLoading = signal<boolean>(true);
  readonly loadingMessage = signal<string>('Loading application...');

  private hideTimeout: any = null;
  private readonly minDisplayDuration = 350; // Prevents fast flickering

  constructor() {
    this.initRouterEvents();
  }

  private initRouterEvents(): void {
    this.router.events.subscribe((event: RouterEvent) => {
      if (event instanceof NavigationStart) {
        this.show('Navigating, please wait...');
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.hide(this.minDisplayDuration);
      }
    });

    // Ensure initial page reload settles smoothly
    setTimeout(() => {
      this.hide();
    }, 600);
  }

  /**
   * Display full-page loader with optional message
   */
  show(message = 'Loading, please wait...'): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.loadingMessage.set(message);
    this.isLoading.set(true);
  }

  /**
   * Hide full-page loader with optional debounce delay
   */
  hide(delayMs = 0): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    if (delayMs > 0) {
      this.hideTimeout = setTimeout(() => {
        this.isLoading.set(false);
        this.hideTimeout = null;
      }, delayMs);
    } else {
      this.isLoading.set(false);
    }
  }
}

