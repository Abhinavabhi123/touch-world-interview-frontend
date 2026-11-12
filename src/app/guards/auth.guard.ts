import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toast } from 'ngx-sonner';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  toast.error('Access Denied', {
    description: 'Please sign in to access the protected admin dashboard.'
  });

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

