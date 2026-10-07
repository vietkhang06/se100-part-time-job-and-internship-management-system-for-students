'use client';

import * as React from 'react';
import { AuthProvider } from '@/lib/auth-context';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
