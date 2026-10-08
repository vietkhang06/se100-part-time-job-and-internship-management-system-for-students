'use client';

import * as React from 'react';
import type {
  AuthUserDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  UserRole,
} from '@campusjob/contracts';
import { apiClient, ApiClientError, refreshSession, setAccessToken } from '@/lib/api-client';

interface AuthContextValue {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequestDto) => Promise<AuthUserDto>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUserDto | null>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUserDto | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
  try {
    const response = await refreshSession();
    setUser(response.user);
    return response.user;
  } catch {
    setAccessToken(null);
    setUser(null);
    return null;
  }
}, []);

  React.useEffect(() => {
    let cancelled = false;

    void refresh().finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = React.useCallback(async (credentials: LoginRequestDto) => {
    const response = await apiClient<LoginResponseDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    setAccessToken(response.accessToken);
    setUser(response.user);
    return response.user;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await apiClient<LogoutResponseDto>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refresh,
    }),
    [user, isLoading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return 'Email hoặc mật khẩu không chính xác.';
    if (error.status === 403) return error.message || 'Tài khoản chưa được phép đăng nhập.';
    if (error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
    return error.message || fallback;
  }

  return fallback;
}

export function getDashboardPath(role: UserRole) {
  switch (role) {
    case 'STUDENT':
      return '/candidate';
    case 'EMPLOYER':
      return '/employer';
    case 'MODERATOR':
      return '/moderator';
    case 'ADMIN':
      return '/admin';
    default:
      return '/';
  }
}
