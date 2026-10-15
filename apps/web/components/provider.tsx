"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { makeClient, createApi, type Api, type Profile } from "@bp/core";
const Context = createContext<{
  api: Api;
  user: Profile | null;
  loading: boolean;
  error: string;
  refreshProfile: () => Promise<void>;
  notify: (text: string) => void;
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
} | null>(null);
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing provider");
  return ctx;
}
function Session({ api, children }: { api: Api; children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, notify] = useState("");
  const cache = useQueryClient();
  const refreshProfile = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionError } = await api.db.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        setUser(null);
        setError("");
        return;
      }
      // getUser checks the Auth server rather than trusting a cached local token.
      const { data: auth, error: authError } = await api.db.auth.getUser();
      if (authError) throw authError;
      if (!auth.user || (!auth.user.email_confirmed_at && !auth.user.phone_confirmed_at)) {
        setUser(null);
        setError("Confirm your email address to continue.");
        return;
      }
      let profile: Profile;
      try {
        profile = await api.profile();
      } catch (e) {
        if ((e as {code?: string}).code !== "PGRST116") throw e;
        profile = await api.ensureProfile();
      }
      setUser(profile);
      setError("");
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    let active = true;
    void refreshProfile();
    const { data: { subscription } } = api.db.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) {
          cache.clear();
          void refreshProfile();
        }
      }, 0);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [api, cache, refreshProfile]);
  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      await cache.invalidateQueries();
      await refreshProfile();
      if (success) notify(success);
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Something went wrong. Try again.");
      return false;
    }
  }
  return (
    <Context.Provider value={{ api, user, loading, error, refreshProfile, notify, run }}>
      {children}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => notify("")} aria-label="Dismiss notification">×</button>
        </div>
      )}
    </Context.Provider>
  );
}
export default function Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
      }),
  );
  const [api] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key
      ? createApi(makeClient(url, key, { auth: { flowType: "pkce" } }))
      : null;
  });
  if (!api)
    return (
      <main className="setup">
        <div className="brand-mark">bp</div>
        <p className="eyebrow">WELCOME TO BUSINESS PARTNER</p>
        <h1>
          Your neighborhood.
          <br />A little closer.
        </h1>
        <p>
          The app is built. Connect your Supabase project to start discovering,
          posting, and chatting.
        </p>
        <ol>
          <li>
            Copy <code>apps/web/.env.example</code> to <code>.env.local</code>.
          </li>
          <li>Add your Supabase URL and public anon key.</li>
          <li>Apply the migration and restart the web app.</li>
        </ol>
        <p>See the repository README for the complete setup.</p>
      </main>
    );
  return (
    <QueryClientProvider client={queryClient}>
      <Session api={api}>{children}</Session>
    </QueryClientProvider>
  );
}
