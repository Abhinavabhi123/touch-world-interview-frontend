import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { toast } from 'ngx-sonner';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id?: string | number;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
  data?: {
    token?: string;
    user?: AuthUser;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // Backend API URL configured from environment file
  private readonly apiUrl = environment.authUrl || `${environment.apiUrl}/admin/login`;

  private readonly TOKEN_KEY = 'touchworld_auth_token';
  private readonly USER_KEY = 'touchworld_auth_user';

  // Reactive state signals
  readonly currentUser = signal<AuthUser | null>(this.getUserFromStorage());
  readonly isAuthenticated = signal<boolean>(this.hasValidToken());

  /**
   * Make POST request to Express backend to authenticate admin
   */
  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(this.apiUrl, credentials).pipe(
      tap((response) => {
        // Extract token and user whether returned directly on response or inside data object
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user;

        if (token) {
          this.saveToken(token);
        }
        if (user) {
          this.saveUser(user);
        }
      })
    );
  }

  /**
   * Save JWT token to localStorage
   */
  saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isAuthenticated.set(true);
  }

  /**
   * Retrieve JWT token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Save user details to localStorage
   */
  saveUser(user: AuthUser): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /**
   * Retrieve user details from localStorage
   */
  getUser(): AuthUser | null {
    return this.currentUser();
  }

  private getUserFromStorage(): AuthUser | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  /**
   * Check if user is currently authenticated with a token
   */
  isLoggedIn(): boolean {
    return this.hasValidToken();
  }

  private hasValidToken(): boolean {
    const token = this.getToken();
    return !!token && token.trim().length > 0;
  }

  /**
   * Clear session and logout
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    toast.info('Logged Out', {
      description: 'You have been signed out successfully.'
    });

    this.router.navigate(['/login']);
  }
}
