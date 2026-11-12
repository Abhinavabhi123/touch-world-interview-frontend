import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  // Default route: redirects to protected dashboard (which redirects to /login if unauthenticated)
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Authentication route - blocked if already logged in so back button cannot re-enter login
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },

  // Protected Admin Dashboard routes
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin/dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },

  // 404 Page Not Found routes
  { path: '404', component: NotFoundComponent },
  { path: '**', component: NotFoundComponent }
];
