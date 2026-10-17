"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  LoginInput,
  RegisterInput,
  SessionUser,
  VendorSignupInput,
} from "@finder/shared";
import { api, ApiError } from "./api";

type AuthState = {
  user: SessionUser | null;
  /** True until the first /auth/me has settled, so guards do not flash. */
  loading: boolean;
  login: (input: LoginInput) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  registerVendor: (input: VendorSignupInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadSession = useCallback(async () => {
    try {
      const { user: me } = await api.get<{ user: SessionUser }>("/auth/me");
      setUser(me);
      return;
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) {
        setUser(null);
        return;
      }
    }

    // A 401 usually just means the short-lived access token expired; the
    // refresh cookie outlives it, so try one rotation before giving up.
    try {
      const { user: rotated } = await api.post<{ user: SessionUser }>(
        "/auth/refresh",
      );
      setUser(rotated);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void loadSession().finally(() => setLoading(false));
  }, [loadSession]);

  const login = useCallback(async (input: LoginInput) => {
    const { user: signedIn } = await api.post<{ user: SessionUser }>(
      "/auth/login",
      input,
    );
    setUser(signedIn);
    return signedIn;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user: created } = await api.post<{ user: SessionUser }>(
      "/auth/register",
      input,
    );
    setUser(created);
    return created;
  }, []);

  const registerVendor = useCallback(async (input: VendorSignupInput) => {
    const { user: created } = await api.post<{ user: SessionUser }>(
      "/auth/register/vendor",
      input,
    );
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      register,
      registerVendor,
      logout,
      refresh: loadSession,
    }),
    [user, loading, login, register, registerVendor, logout, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
