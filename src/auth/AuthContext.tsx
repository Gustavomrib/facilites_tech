import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/authApi';
import type { LoginPayload, RegisterPayload } from '../api/authApi';
import { setAccessToken, setOnAuthFailure } from './tokenStore';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Session bootstrap: no access token survives a reload (by design — it's in-memory
  // only), so on mount we ask the backend to mint a fresh one from the httpOnly
  // refresh cookie. No cookie / expired cookie simply means "not logged in".
  useEffect(() => {
    let cancelled = false;
    authApi.refresh().then((result) => {
      if (cancelled) return;
      // refresh() already stores the token (it shares the HTTP client's token-refresh
      // path) — this effect only needs to react to whether a session actually exists.
      setStatus(result ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Called by the HTTP client when a 401 survives the refresh-and-retry attempt —
  // e.g. the refresh cookie itself expired while the app was open.
  useEffect(() => {
    setOnAuthFailure(() => setStatus('unauthenticated'));
    return () => setOnAuthFailure(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      login: async (payload) => {
        const session = await authApi.login(payload);
        setAccessToken(session.accessToken);
        setStatus('authenticated');
      },
      register: async (payload) => {
        const session = await authApi.register(payload);
        setAccessToken(session.accessToken);
        setStatus('authenticated');
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setStatus('unauthenticated');
        }
      },
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Context hooks live with their provider.
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
