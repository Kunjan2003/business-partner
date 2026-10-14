"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
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
  notify: (text: string) => void;
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
} | null>(null);
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing provider");
  return ctx;
}
function Session({ api, children }: { api: Api; children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null),
    [notice, notify] = useState("");
  const cache = useQueryClient();
  useEffect(() => {
    let alive = true;
    const update = () => {
      api
        .profile()
        .then((p) => {
          if (alive) setUser(p);
        })
        .catch(() => {
          if (alive) setUser(null);
        });
    };
    update();
    const {
      data: { subscription },
    } = api.db.auth.onAuthStateChange(() => {
      setTimeout(() => {
        cache.clear();
        update();
      }, 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [api, cache]);
  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      await cache.invalidateQueries();
      if (success) notify(success);
      return true;
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "Something went wrong. Try again.",
      );
      return false;
    }
  }
  return (
    <Context.Provider value={{ api, user, notify, run }}>
      {children}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => notify("")} aria-label="Dismiss notification">
            ×
          </button>
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
