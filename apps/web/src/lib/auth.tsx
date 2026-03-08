"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { auth } from "./api";

interface User {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  first_name?: string;
  last_name?: string;
  doctor: { id: string; name: string; specialties: string[] } | null;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await auth.me();
      setUser(me);
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem("cliniqai_access_token");
      localStorage.removeItem("cliniqai_refresh_token");
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("cliniqai_access_token");
    if (stored) {
      setToken(stored);
      fetchMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = useCallback(async (accessToken: string, refreshToken: string) => {
    localStorage.setItem("cliniqai_access_token", accessToken);
    localStorage.setItem("cliniqai_refresh_token", refreshToken);
    setToken(accessToken);
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("cliniqai_refresh_token") ?? undefined;
    await auth.logout(refreshToken).catch(() => null);
    localStorage.removeItem("cliniqai_access_token");
    localStorage.removeItem("cliniqai_refresh_token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
