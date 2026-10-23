import "react-native-url-polyfill/auto";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Alert, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createApi,
  makeClient,
  explainError,
  type Api,
  type Profile,
} from "@bp/core";
import type { Session } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { createCallbackHandler } from "./auth-callback";
WebBrowser.maybeCompleteAuthSession();
const projectUrl = process.env.EXPO_PUBLIC_SUPABASE_URL,
  publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured =
  !!projectUrl &&
  !!publicKey &&
  !projectUrl.includes("your-project") &&
  !publicKey.includes("your-public");
export const api = configured
  ? createApi(
      makeClient(projectUrl!, publicKey!, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      }),
      randomUUID,
    )
  : null;
let googleActive = false;
const completeAuthCallback = createCallbackHandler(async (code) => {
  if (!api) throw new Error("Backend not configured");
  const { error } = await api.db.auth.exchangeCodeForSession(code);
  if (error) throw error;
});
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
type AppContext = {
  api: Api;
  user: Profile | null;
  session: Session | null;
  recovery: boolean;
  finishRecovery: () => void;
  loading: boolean;
  profileError: unknown;
  reloadProfile: () => void;
  run: (action: () => Promise<unknown>, keys?: string[]) => Promise<boolean>;
};
const Context = createContext<AppContext | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Session provider missing");
  return value;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
function SessionProvider({ children }: { children: React.ReactNode }) {
  const [recovery, setRecovery] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [initial, setInitial] = useState(true),
    [sessionError, setSessionError] = useState<unknown>(null);
  const active = useRef(true),
    previousId = useRef<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!api) return;
    active.current = true;
    const accept = (next: Session | null) => {
      if (!active.current) return;
      const id = next?.user.id ?? null;
      if (previousId.current !== id) {
        queryClient.clear();
        previousId.current = id;
      }
      setSession(next);
      setInitial(false);
      setSessionError(null);
    };
    api.db.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active.current) {
          setSessionError(error);
          setInitial(false);
        }
      } else accept(data.session);
    });
    const {
      data: { subscription },
    } = api.db.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (!next) setRecovery(false);
      accept(next);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") api!.db.auth.startAutoRefresh();
      else api!.db.auth.stopAutoRefresh();
    });
    api.db.auth.startAutoRefresh();
    const complete = async (url: string) => {
      try {
        if (!googleActive) await completeAuthCallback(url);
      } catch (e) {
        Alert.alert("Sign-in link", explainError(e));
      }
    };
    const links = Linking.addEventListener(
      "url",
      ({ url }) => void complete(url),
    );
    void Linking.getInitialURL().then((url) => {
      if (url) void complete(url);
    });
    return () => {
      active.current = false;
      subscription.unsubscribe();
      app.remove();
      links.remove();
      api!.db.auth.stopAutoRefresh();
    };
  }, [queryClient]);
  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session && !!api,
    queryFn: async () => {
      try {
        return await api!.profile();
      } catch (e) {
        if ((e as { code?: string }).code === "PGRST116")
          return api!.ensureProfile();
        throw e;
      }
    },
  });
  async function run(
    action: () => Promise<unknown>,
    keys = [
      "feed",
      "posts",
      "products",
      "my-business",
      "business",
      "stats",
      "following",
      "saved",
      "notifications",
      "chats",
    ],
  ) {
    try {
      await action();
      await Promise.all(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      return true;
    } catch (e) {
      Alert.alert("Couldn’t complete that", explainError(e));
      return false;
    }
  }
  return (
    <Context.Provider
      value={{
        api: api!,
        recovery,
        finishRecovery: () => setRecovery(false),
        user: profile.data ?? null,
        session,
        loading: initial || (!!session && profile.isLoading),
        profileError: sessionError ?? profile.error,
        reloadProfile: () => {
          setSessionError(null);
          if (session) void profile.refetch();
          else if (api)
            void api.db.auth.getSession().then(({ data, error }) => {
              if (error) setSessionError(error);
              else setSession(data.session);
            });
        },
        run,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export type Photo = { uri: string; bytes: ArrayBuffer; mime: string };
export async function pickPhoto(): Promise<Photo | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error("Allow photo access to choose a picture.");
  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (selection.canceled) return null;
  const asset = selection.assets[0],
    scale = Math.min(1, 1600 / Math.max(asset.width, asset.height));
  const image = ImageManipulator.manipulate(asset.uri);
  if (scale < 1)
    image.resize({
      width: Math.round(asset.width * scale),
      height: Math.round(asset.height * scale),
    });
  const rendered = await image.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
  });
  const bytes = await new File(saved.uri).arrayBuffer();
  if (!bytes.byteLength)
    throw new Error("This photo could not be read. Choose another.");
  if (bytes.byteLength > 6 * 1024 * 1024)
    throw new Error("Choose a smaller photo (under 6 MB).");
  return { uri: saved.uri, bytes, mime: "image/jpeg" };
}
export async function googleSignIn() {
  if (!api) throw new Error("Backend not configured");
  if (Platform.OS === "web")
    throw new Error("Use the web app for browser Google sign-in.");
  const redirectTo = "businesspartner://auth/callback";
  const { data, error } = await api.db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  googleActive = true;
  let response: WebBrowser.WebBrowserAuthSessionResult;
  try {
    response = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  } finally {
    googleActive = false;
  }
  if (response.type === "success") {
    if (!(await completeAuthCallback(response.url)))
      throw new Error("No sign-in code was returned. Try again.");
  }
}
