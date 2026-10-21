import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMe, loginRequest, type MeResponse } from "../api/adminFetch";

type AuthContextValue = {
  loading: boolean;
  me: MeResponse | null;
  loggedIn: boolean;
  refresh: () => Promise<void>;
  login: (username: string, password: string, twoFa?: string) => Promise<void>;
  logoutLocal: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMe();
      setMe(next);
    } catch {
      setMe({ username: "Guest", logged_in: false });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string, twoFa?: string) => {
      await loginRequest({
        username,
        password,
        ...(twoFa ? { "2fa_code": twoFa } : {}),
      });
      await refresh();
    },
    [refresh],
  );

  const logoutLocal = useCallback(() => {
    setMe({ username: "Guest", logged_in: false });
  }, []);

  const value = useMemo(
    () => ({
      loading,
      me,
      loggedIn: Boolean(me?.logged_in),
      refresh,
      login,
      logoutLocal,
    }),
    [loading, me, refresh, login, logoutLocal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth outside AuthProvider");
  }
  return ctx;
}
