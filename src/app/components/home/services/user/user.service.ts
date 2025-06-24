import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoggedInUser, LoginToken, User } from '../../types/user.type';
import { toObservable } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private isAuthenticated = signal<boolean>(false);
  private loggedInUserInfo = signal<LoggedInUser>({} as LoggedInUser);
  private sessionRestored = signal<boolean>(false);
  private autoLogoutTimer: any;
  private authToken: string = '';

  constructor(private http: HttpClient) {
    if (typeof window !== 'undefined') {
      this.loadToken();
    }
  }

  get isUserAuthenticated(): boolean {
    return this.isAuthenticated();
  }

  get isUserAuthenticated$(): Observable<boolean> {
    return toObservable(this.isAuthenticated);
  }

  get loggedInUser$(): Observable<LoggedInUser> {
    return toObservable(this.loggedInUserInfo);
  }

  get loggedInUser(): LoggedInUser {
    return this.loggedInUserInfo();
  }

  get token(): string {
    return this.authToken;
  }

  get sessionRestored$(): Observable<boolean> {
    return toObservable(this.sessionRestored);
  }

  createUser(user: User): Observable<any> {
    return this.http.post('http://localhost:5001/users/signup', user);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post('http://localhost:5001/users/login', { email, password });
  }

  activateToken(token: LoginToken): void {
    if (!token || !token.token) return;

    const expiresInMs = (token.expiresInSeconds ?? 3600) * 1000;
    const expiry = new Date(Date.now() + expiresInMs).toISOString();

    const user = token.user || {
      firstName: '',
      lastName: '',
      address: '',
      city: '',
      state: '',
      pin: '',
      email: '',
    };

    localStorage.setItem('token', token.token);
    localStorage.setItem('expiry', expiry);
    Object.entries(user).forEach(([key, value]) => {
      localStorage.setItem(key, value ?? '');
    });

    this.authToken = token.token;
    this.isAuthenticated.set(true);
    this.loggedInUserInfo.set(user);
    this.setAutoLogoutTimer(expiresInMs);
  }

  logout(): void {
    localStorage.clear();
    this.authToken = '';
    clearTimeout(this.autoLogoutTimer);
    this.isAuthenticated.set(false);
    this.loggedInUserInfo.set({} as LoggedInUser);
    this.sessionRestored.set(true); // ensure header loads even after logout
  }

  private setAutoLogoutTimer(duration: number): void {
    this.autoLogoutTimer = setTimeout(() => this.logout(), duration);
  }

  private loadToken(): void {
    const token = localStorage.getItem('token');
    const expiry = localStorage.getItem('expiry');

    if (!token || !expiry) {
      this.sessionRestored.set(true);
      return;
    }

    const expiresIn = new Date(expiry).getTime() - Date.now();
    if (expiresIn <= 0) {
      this.logout();
      this.sessionRestored.set(true);
      return;
    }

    const user: LoggedInUser = {
      firstName: localStorage.getItem('firstName') || '',
      lastName: localStorage.getItem('lastName') || '',
      address: localStorage.getItem('address') || '',
      city: localStorage.getItem('city') || '',
      state: localStorage.getItem('state') || '',
      pin: localStorage.getItem('pin') || '',
      email: localStorage.getItem('email') || '',
    };

    this.authToken = token;
    this.isAuthenticated.set(true);
    this.loggedInUserInfo.set(user);
    this.setAutoLogoutTimer(expiresIn);

    this.sessionRestored.set(true);
  }
}
