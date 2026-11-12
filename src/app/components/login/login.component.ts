import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  loginForm: FormGroup;
  hidePassword = signal(true);
  isLoading = signal(false);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((val) => !val);
  }

  getEmailErrorMessage(): string {
    const emailControl = this.loginForm.get('email');
    if (emailControl?.hasError('required')) {
      return 'Email address is required';
    }
    return emailControl?.hasError('email') ? 'Please enter a valid email address' : '';
  }

  getPasswordErrorMessage(): string {
    const passwordControl = this.loginForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Password is required';
    }
    return passwordControl?.hasError('minlength') ? 'Password must be at least 6 characters' : '';
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      const emailError = this.getEmailErrorMessage();
      const passwordError = this.getPasswordErrorMessage();
      const desc = emailError || passwordError || 'Please fill in all required fields correctly.';

      toast.error('Validation Error', {
        description: desc
      });
      return;
    }

    this.isLoading.set(true);
    const { email, password } = this.loginForm.value;

    // Post API call to Express backend
    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        this.isLoading.set(false);

        const user = response?.user || response?.data?.user;
        const userName = user?.name || user?.email || email;

        toast.success('Admin Login Successful', {
          description: `Welcome back, ${userName}!`
        });

        // Navigate to protected admin dashboard with replaceUrl so browser Back button cannot return to /login
        const rawReturnUrl = this.route.snapshot.queryParams['returnUrl'];
        const returnUrl = rawReturnUrl && rawReturnUrl !== '/login' ? rawReturnUrl : '/dashboard';
        this.router.navigateByUrl(returnUrl, { replaceUrl: true });
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMessage =
          err.error?.message ||
          (err.status === 0
            ? 'Cannot connect to backend server on http://localhost:3000. Please ensure Express backend is running.'
            : 'Authentication failed. Please check your credentials.');

        toast.error('Login Failed', {
          description: errorMessage
        });
      }
    });
  }
}
