'use client';

import * as React from 'react';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <>{children}</>;
}
