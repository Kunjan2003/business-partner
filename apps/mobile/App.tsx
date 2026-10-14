import "react-native-url-polyfill/auto";
import React, { useEffect, useState, createContext, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  AppState,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { randomUUID } from "expo-crypto";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  makeClient,
  createApi,
  categories,
  directionsUrl,
  type Api,
  type Profile,
  type Business,
  type Post,
  type SearchInput,
  type BusinessInput,
} from "@bp/core";
WebBrowser.maybeCompleteAuthSession();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const api =
  url && key
    ? createApi(
        makeClient(url, key, {
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
const cache = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
const Context = createContext<{
  api: Api;
  user: Profile | null;
  run: (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;
} | null>(null);
function useApp() {
  return useContext(Context)!;
}
function Button({
  title,
  onPress,
  quiet = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, quiet && s.quiet, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, quiet && { color: "#285b45" }]}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  secure = false,
  multiline = false,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  multiline?: boolean;
  numeric?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          s.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize={
          secure || label.toLowerCase().includes("email") ? "none" : "sentences"
        }
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
    </View>
  );
}
function Choices({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 46, marginBottom: 14 }}
    >
      {values.map((v) => (
        <Pressable
          accessibilityRole="button"
          key={v}
          onPress={() => onChange(v)}
          style={[s.chip, value === v && s.chipActive]}
        >
          <Text
            style={{ color: value === v ? "white" : "#53624e", fontSize: 12 }}
          >
            {v}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function Status({
  loading,
  error,
}: {
  loading?: boolean;
  error?: Error | null;
}) {
  return loading ? (
    <ActivityIndicator style={{ margin: 24 }} color="#285b45" />
  ) : error ? (
    <Text accessibilityRole="alert" style={s.error}>
      {error.message}
    </Text>
  ) : null;
}
function Empty({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}
function Title({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title}>{title}</Text>
    </View>
  );
}
function Upload({
  onChange,
  chat,
}: {
  onChange: (path: string) => void;
  chat?: string;
}) {
  const { api, run } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={busy ? "Uploading…" : "＋ Choose a photo"}
      disabled={busy}
      quiet
      onPress={() => {
        void (async () => {
          setBusy(true);
          await run(async () => {
            const permission =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted)
              throw new Error("Photo library permission is required");
            const picked = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.8,
            });
            if (picked.canceled) return;
            const asset = picked.assets[0];
            const bytes = await (await fetch(asset.uri)).arrayBuffer();
            onChange(
              await api.uploadImage(
                bytes,
                asset.mimeType ?? "image/jpeg",
                chat,
              ),
            );
          });
          setBusy(false);
        })();
      }}
    />
  );
}
export default function App() {
  if (!api)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.safe}>
          <View style={{ padding: 28 }}>
            <Title
              eyebrow="BUSINESS PARTNER"
              title="Your neighborhood. A little closer."
            />
            <Text style={s.muted}>
              Copy apps/mobile/.env.example to .env and add your Supabase URL
              and public anon key, then restart Expo. Apply the database
              migration first.
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={cache}>
        <Session client={api} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
function Session({ client }: { client: Api }) {
  const [user, setUser] = useState<Profile | null>(null),
    [tab, setTab] = useState("Feed"),
    [business, setBusiness] = useState<string | null>(null),
    [chat, setChat] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const update = () => {
      client
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
    } = client.db.auth.onAuthStateChange(() => {
      setTimeout(() => {
        cache.clear();
        update();
      }, 0);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") client.db.auth.startAutoRefresh();
      else client.db.auth.stopAutoRefresh();
    });
    client.db.auth.startAutoRefresh();
    return () => {
      alive = false;
      subscription.unsubscribe();
      app.remove();
      client.db.auth.stopAutoRefresh();
    };
  }, [client]);
  async function run(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn();
      await cache.invalidateQueries();
      if (success) Alert.alert("Business Partner", success);
      return true;
    } catch (e) {
      Alert.alert(
        "Please try again",
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "Something went wrong",
      );
      return false;
    }
  }
  return (
    <Context.Provider value={{ api: client, user, run }}>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.header}>
            <Text style={s.logo}>
              bp
              <Text style={{ fontSize: 16, letterSpacing: 0 }}>
                {" "}
                Business Partner.
              </Text>
            </Text>
            <Pressable
              accessibilityLabel="Open account"
              onPress={() => {
                setBusiness(null);
                setTab("Account");
              }}
            >
              <View style={s.avatar}>
                <Text style={{ color: "#285b45" }}>
                  {user?.display_name[0] ?? "↗"}
                </Text>
              </View>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
          >
            {business ? (
              <>
                <Button
                  title="← Back"
                  quiet
                  onPress={() => setBusiness(null)}
                />
                <Shop
                  id={business}
                  openChat={(id) => {
                    setChat(id);
                    setBusiness(null);
                    setTab("Inbox");
                  }}
                />
              </>
            ) : tab === "Feed" ? (
              <Feed open={setBusiness} />
            ) : tab === "Explore" ? (
              <Explore open={setBusiness} />
            ) : tab === "Inbox" ? (
              <Inbox initial={chat} />
            ) : tab === "Business" ? (
              <BusinessEditor />
            ) : tab === "Saved" ? (
              <Feed open={setBusiness} saved />
            ) : (
              <Account refresh={(p) => setUser(p)} />
            )}
          </ScrollView>
          <View style={s.bottom}>
            {[
              "Feed",
              "Explore",
              "Inbox",
              user?.role === "owner" ? "Business" : "Saved",
              "Account",
            ].map((name, i) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === name }}
                key={name}
                onPress={() => {
                  setBusiness(null);
                  setTab(name);
                }}
                style={s.bottomItem}
              >
                <Text
                  style={{
                    fontSize: 20,
                    color: tab === name ? "#285b45" : "#9a9f95",
                  }}
                >
                  {["⌂", "⌕", "✉", "▧", "○"][i]}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: tab === name ? "#285b45" : "#9a9f95",
                    fontWeight: tab === name ? "700" : "400",
                  }}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Context.Provider>
  );
}
function Account({ refresh }: { refresh: (p: Profile) => void }) {
  const { api, user, run } = useApp();
  const [mode, setMode] = useState("Sign in"),
    [name, setName] = useState(user?.display_name ?? ""),
    [role, setRole] = useState<string>(user?.role ?? "customer"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [phone, setPhone] = useState(""),
    [otp, setOtp] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(user?.display_name ?? "");
    setRole(user?.role ?? "customer");
  }, [user?.id]);
  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.notifications(),
    enabled: !!user,
  });
  async function submit() {
    setBusy(true);
    await run(async () => {
      if (user) {
        await api.updateProfile(name, role as "owner" | "customer");
        refresh(await api.profile());
      } else if (mode === "Create account") {
        const data = await api.signUp(
          email,
          password,
          name,
          role as "owner" | "customer",
          "businesspartner://auth/callback",
        );
        if (!data.session)
          Alert.alert(
            "Check your email",
            "Confirm your account and then sign in.",
          );
      } else if (mode === "Phone") {
        if (sent) await api.verifyOtp(phone, otp);
        else {
          await api.phoneOtp(phone);
          setSent(true);
        }
      } else await api.signIn(email, password);
    });
    setBusy(false);
  }
  return (
    <>
      <Title
        eyebrow="YOUR LOCAL COMMUNITY"
        title={user ? "Your account." : "Come on in."}
      />
      {!user && (
        <Choices
          values={["Sign in", "Create account", "Phone"]}
          value={mode}
          onChange={setMode}
        />
      )}
      <View style={s.card}>
        {(user || mode === "Create account") && (
          <>
            <Field label="Your name" value={name} onChange={setName} />
            <Choices
              values={["customer", "owner"]}
              value={role}
              onChange={setRole}
            />
          </>
        )}
        {!user &&
          (mode === "Phone" ? (
            <>
              <Field
                label="Phone (+country code)"
                value={phone}
                onChange={setPhone}
              />
              {sent && (
                <Field
                  label="Verification code"
                  value={otp}
                  onChange={setOtp}
                />
              )}
            </>
          ) : (
            <>
              <Field label="Email" value={email} onChange={setEmail} />
              <Field
                label="Password (8+ characters)"
                value={password}
                onChange={setPassword}
                secure
              />
            </>
          ))}
        <Button
          title={
            user
              ? "Save profile"
              : mode === "Phone"
                ? sent
                  ? "Verify code"
                  : "Send code"
                : mode
          }
          onPress={() => void submit()}
          disabled={busy}
        />
        {!user && (
          <Button
            title="Continue with Google"
            quiet
            onPress={() =>
              void run(async () => {
                const redirectTo = "businesspartner://auth/callback";
                const { data, error } = await api.db.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo, skipBrowserRedirect: true },
                });
                if (error) throw error;
                const response = await WebBrowser.openAuthSessionAsync(
                  data.url,
                  redirectTo,
                );
                if (response.type === "success") {
                  const callback = new URL(response.url);
                  const code = callback.searchParams.get("code");
                  if (!code)
                    throw new Error(
                      callback.searchParams.get("error_description") ??
                        "No authorization code received",
                    );
                  const { error } =
                    await api.db.auth.exchangeCodeForSession(code);
                  if (error) throw error;
                }
              })
            }
          />
        )}{" "}
        {user && (
          <Button
            title="Log out"
            quiet
            onPress={() => void run(() => api.signOut())}
          />
        )}
      </View>
      {user && (
        <>
          <Text style={s.sectionTitle}>Notifications</Text>
          <Status error={notifications.error} />
          {notifications.data?.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => void run(() => api.readNotification(n.id))}
              style={s.card}
            >
              <Text
                style={{
                  fontWeight: n.read_at ? "400" : "700",
                  color: "#2b3c2e",
                }}
              >
                {n.body}
              </Text>
              <Text style={s.muted}>
                {new Date(n.created_at).toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </>
  );
}
function Feed({
  open,
  saved = false,
}: {
  open: (id: string) => void;
  saved?: boolean;
}) {
  const { api, user } = useApp();
  const [mode, setMode] = useState("For you");
  const query = useInfiniteQuery({
    queryKey: ["feed", mode, saved, user?.id],
    queryFn: ({ pageParam }) =>
      api.feed(pageParam, mode === "Following", saved),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
    enabled: !saved || !!user,
  });
  return (
    <>
      <Title
        eyebrow="THE NEIGHBORHOOD EDIT"
        title={saved ? "Your saved finds." : "A little local inspiration."}
      />
      {!saved && (
        <Choices
          values={["For you", ...(user ? ["Following"] : [])]}
          value={mode}
          onChange={setMode}
        />
      )}
      <Status loading={query.isLoading} error={query.error} />
      {query.data?.pages.flat().map((p) => (
        <PostCard key={p.id} post={p} open={open} />
      ))}
      {(query.data?.pages[0]?.length === 0 || (saved && !user)) && (
        <Empty
          text={
            saved && !user
              ? "Sign in to save your favorites."
              : "Explore local businesses, or share the first update from your business."
          }
        />
      )}{" "}
      {query.hasNextPage && (
        <Button
          title="Load more"
          quiet
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
function PostCard({ post, open }: { post: Post; open: (id: string) => void }) {
  const { api, user, run } = useApp();
  const [show, setShow] = useState(false),
    [body, setBody] = useState("");
  const liked = post.likes.some((l) => l.user_id === user?.id);
  const saved = useQuery({
    queryKey: ["saved", post.id, user?.id],
    queryFn: () => api.saved(post.id),
    enabled: !!user,
  });
  const comments = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => api.comments(post.id),
    enabled: show,
  });
  return (
    <View style={[s.card, { padding: 0 }]}>
      <Pressable onPress={() => open(post.business_id)} style={s.postHead}>
        <View style={s.avatar}>
          <Text>{post.businesses.name[0]}</Text>
        </View>
        <View>
          <Text style={s.bold}>{post.businesses.name}</Text>
          <Text style={s.muted}>{post.businesses.category}</Text>
        </View>
      </Pressable>
      {!!post.image_url && (
        <Image
          source={{ uri: post.image_url }}
          style={s.postImage}
          accessibilityLabel={post.caption}
        />
      )}
      <View style={{ padding: 18 }}>
        <View style={s.row}>
          <Pressable
            accessibilityLabel="Like post"
            onPress={() => void run(() => api.toggle("likes", post.id, liked))}
          >
            <Text
              style={{ fontSize: 23, color: liked ? "#c55d50" : "#285b45" }}
            >
              {liked ? "♥" : "♡"}{" "}
              <Text style={{ fontSize: 12 }}>{post.likes.length}</Text>
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Show comments"
            onPress={() => setShow(!show)}
          >
            <Text style={{ fontSize: 23 }}>
              ♧ <Text style={{ fontSize: 12 }}>{post.comments.length}</Text>
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Save post"
            onPress={() =>
              void run(() => api.toggle("saves", post.id, !!saved.data))
            }
          >
            <Text style={{ fontSize: 22 }}>{saved.data ? "▣" : "▢"}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Share"
            onPress={() =>
              void run(() =>
                Share.share({
                  message: `${post.businesses.name}: ${post.caption}`,
                }),
              )
            }
          >
            <Text style={{ fontSize: 22 }}>↗</Text>
          </Pressable>
        </View>
        <Text style={s.body}>
          <Text style={s.bold}>{post.businesses.name} </Text>
          {post.caption}
        </Text>
        <Button
          title="Visit business ↗"
          quiet
          onPress={() => open(post.business_id)}
        />
        {show && (
          <>
            <Status error={comments.error} />
            {comments.data?.map((c) => (
              <Text key={c.id} style={s.body}>
                <Text style={s.bold}>{c.profiles.display_name} </Text>
                {c.body}
              </Text>
            ))}
            <Field label="Comment" value={body} onChange={setBody} />
            <Button
              title="Send comment"
              onPress={() =>
                void run(async () => {
                  await api.comment(post.id, body);
                  setBody("");
                })
              }
            />
          </>
        )}
      </View>
    </View>
  );
}
function Explore({ open }: { open: (id: string) => void }) {
  const { api, run } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [min, setMin] = useState("0"),
    [max, setMax] = useState(""),
    [rating, setRating] = useState("0"),
    [filters, setFilters] = useState<SearchInput>({}),
    [coords, setCoords] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null);
  const result = useInfiniteQuery({
    queryKey: ["search", filters, coords],
    queryFn: ({ pageParam }) =>
      api.search({ ...filters, ...coords }, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
  });
  return (
    <>
      <Title eyebrow="GOOD THINGS, CLOSE BY" title="Find your next favorite." />
      <View style={s.card}>
        <Field
          label="Search shops, products, categories"
          value={query}
          onChange={setQuery}
        />
        <Choices
          values={["All", ...categories]}
          value={category}
          onChange={setCategory}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Min price (₹)"
              value={min}
              onChange={setMin}
              numeric
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Max price (₹)"
              value={max}
              onChange={setMax}
              numeric
            />
          </View>
        </View>
        <Text style={s.label}>Minimum rating</Text>
        <Choices
          values={["0", "3", "4", "5"]}
          value={rating}
          onChange={setRating}
        />
        <Button
          title="Search"
          onPress={() =>
            setFilters({
              query,
              category: category === "All" ? "" : category,
              min_price: Number(min),
              max_price: Number(max || 100000000),
              min_rating: Number(rating),
            })
          }
        />
        <Button
          title={coords ? "Nearby: 25 km · Clear" : "⌖ Near me"}
          quiet
          onPress={() =>
            void run(async () => {
              if (coords) {
                setCoords(null);
                return;
              }
              const permission =
                await Location.requestForegroundPermissionsAsync();
              if (permission.status !== "granted")
                throw new Error("Allow location access to find nearby shops");
              const p = await Location.getCurrentPositionAsync({});
              setCoords({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
              });
            })
          }
        />
      </View>
      <Status loading={result.isLoading} error={result.error} />
      {result.data?.pages.flat().map((r) => (
        <Pressable
          key={r.kind + r.id}
          style={s.card}
          onPress={() => open(r.business_id)}
        >
          {!!r.image_url && (
            <Image source={{ uri: r.image_url }} style={s.productImage} />
          )}
          <Text style={s.eyebrow}>
            {r.category} · {r.kind}
          </Text>
          <Text style={s.sectionTitle}>{r.name}</Text>
          <Text style={s.body}>{r.description.slice(0, 120)}</Text>
          <Text style={s.bold}>
            {r.price !== null ? `₹${r.price}` : "Visit shop"} · ★{" "}
            {Number(r.rating).toFixed(1)}
          </Text>
          {r.distance_km !== null && (
            <Text style={s.muted}>{r.distance_km.toFixed(1)} km away</Text>
          )}
        </Pressable>
      ))}
      {result.data?.pages[0]?.length === 0 && (
        <Empty text="No matches yet. Try another search or remove a filter." />
      )}
      {result.hasNextPage && (
        <Button
          title="Load more"
          quiet
          onPress={() => void result.fetchNextPage()}
        />
      )}
    </>
  );
}
function Shop({
  id,
  openChat,
}: {
  id: string;
  openChat: (id: string) => void;
}) {
  const { api, user, run } = useApp();
  const shop = useQuery({
      queryKey: ["business", id],
      queryFn: () => api.business(id),
    }),
    products = useQuery({
      queryKey: ["products", id],
      queryFn: () => api.products(id),
    }),
    following = useQuery({
      queryKey: ["following", id, user?.id],
      queryFn: () => api.following(id),
      enabled: !!user,
    });
  if (!shop.data) return <Status loading={shop.isLoading} error={shop.error} />;
  const b = shop.data;
  return (
    <>
      <Title eyebrow={b.category} title={b.name} />
      <View style={s.card}>
        {!!b.logo_url && (
          <Image source={{ uri: b.logo_url }} style={s.shopLogo} />
        )}
        <Text style={s.body}>{b.description}</Text>
        <Text style={s.muted}>⌖ {b.address}</Text>
        <Text style={s.muted}>{b.hours}</Text>
        <Text style={s.muted}>{b.contact}</Text>
        <Button
          title={following.data ? "Following ✓" : "Follow business"}
          onPress={() =>
            void run(() => api.toggle("follows", id, !!following.data))
          }
        />
        {b.owner_id !== user?.id && (
          <Button
            title="Message business"
            quiet
            onPress={() =>
              void run(async () => openChat(await api.startChat(id)))
            }
          />
        )}
        <Button
          title="Directions ↗"
          quiet
          onPress={() =>
            void run(() =>
              Linking.openURL(directionsUrl(b.latitude, b.longitude)),
            )
          }
        />
        {user && user.id !== b.owner_id && (
          <Button
            title="Block business owner"
            quiet
            onPress={() =>
              Alert.alert("Block owner?", "This disables your conversation.", [
                { text: "Cancel" },
                {
                  text: "Block",
                  style: "destructive",
                  onPress: () =>
                    void run(() => api.block(b.owner_id), "Owner blocked"),
                },
              ])
            }
          />
        )}
      </View>
      <Text style={s.sectionTitle}>The local collection</Text>
      <Status error={products.error} />
      {products.data?.map((p) => (
        <View key={p.id} style={s.card}>
          {!!p.image_url && (
            <Image source={{ uri: p.image_url }} style={s.productImage} />
          )}
          <Text style={s.bold}>{p.name}</Text>
          <Text style={s.body}>{p.description}</Text>
          <Text style={s.bold}>₹{p.price}</Text>
          <Text style={s.muted}>
            {p.available ? "Available" : "Currently unavailable"}
          </Text>
        </View>
      ))}
    </>
  );
}
function BusinessEditor() {
  const { api, user } = useApp();
  const shop = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
    enabled: !!user,
  });
  if (user?.role !== "owner")
    return (
      <Empty text="Choose owner in your profile to start your business." />
    );
  if (shop.isLoading || shop.error)
    return <Status loading={shop.isLoading} error={shop.error} />;
  return (
    <>
      <Title
        eyebrow="GROW SOMETHING LOCAL"
        title="Your business, your story."
      />
      <BusinessForm
        key={shop.data?.id ?? "new"}
        business={shop.data ?? undefined}
      />
      {shop.data && <Publish business={shop.data} />}
    </>
  );
}
function BusinessForm({ business }: { business?: Business }) {
  const { api, run } = useApp();
  const [data, setData] = useState({
      name: business?.name ?? "",
      category: business?.category ?? categories[0],
      description: business?.description ?? "",
      contact: business?.contact ?? "",
      address: business?.address ?? "",
      hours: business?.hours ?? "",
      latitude: business?.latitude.toString() ?? "",
      longitude: business?.longitude.toString() ?? "",
      logo_url: business?.logo_url ?? "",
    }),
    [busy, setBusy] = useState(false);
  const field = (key: keyof typeof data, label: string, numeric = false) => (
    <Field
      label={label}
      value={data[key]}
      onChange={(v) => setData({ ...data, [key]: v })}
      numeric={numeric}
    />
  );
  return (
    <View style={s.card}>
      {field("name", "Business name")}
      <Choices
        values={categories}
        value={data.category}
        onChange={(v) => setData({ ...data, category: v })}
      />
      {field("description", "Description")}
      {field("contact", "Contact")}
      {field("address", "Shop address")}
      {field("hours", "Working hours")}
      {field("latitude", "Latitude", true)}
      {field("longitude", "Longitude", true)}
      <Button
        title="Use current location as shop pin"
        quiet
        onPress={() =>
          void run(async () => {
            const p = await Location.requestForegroundPermissionsAsync();
            if (p.status !== "granted")
              throw new Error("Location permission required");
            const loc = await Location.getCurrentPositionAsync({});
            setData({
              ...data,
              latitude: String(loc.coords.latitude),
              longitude: String(loc.coords.longitude),
            });
          })
        }
      />
      <Upload onChange={(logo_url) => setData({ ...data, logo_url })} />
      <Button
        title="Save business profile"
        disabled={busy}
        onPress={() => {
          void (async () => {
            setBusy(true);
            await run(() => {
              if (!data.latitude.trim() || !data.longitude.trim())
                throw new Error("Enter the shop coordinates");
              return api.saveBusiness(
                {
                  ...data,
                  latitude: Number(data.latitude),
                  longitude: Number(data.longitude),
                } as BusinessInput,
                business?.id,
              );
            }, "Business saved");
            setBusy(false);
          })();
        }}
      />
    </View>
  );
}
function Publish({ business }: { business: Business }) {
  const { api, run } = useApp();
  const [caption, setCaption] = useState(""),
    [kind, setKind] = useState("post"),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Text style={s.sectionTitle}>Share something new</Text>
      <View style={s.card}>
        <Field
          label="What’s new?"
          value={caption}
          onChange={setCaption}
          multiline
        />
        <Choices
          values={["post", "offer", "product"]}
          value={kind}
          onChange={setKind}
        />
        <Upload onChange={setImage} />
        {!!image && <Image source={{ uri: image }} style={s.productImage} />}
        <Button
          title="Publish post"
          disabled={busy}
          onPress={() => {
            void (async () => {
              setBusy(true);
              if (
                await run(
                  () =>
                    api.createPost({
                      business_id: business.id,
                      caption,
                      kind,
                      image_url: image,
                    }),
                  "Post published",
                )
              ) {
                setCaption("");
                setImage("");
              }
              setBusy(false);
            })();
          }}
        />
      </View>
      <Text style={s.muted}>
        Use the web dashboard to manage your product catalog and review
        analytics.
      </Text>
    </>
  );
}
function SignedImage({ path }: { path: string }) {
  const { api } = useApp();
  const image = useQuery({
    queryKey: ["chat-image", path],
    queryFn: () => api.chatImage(path),
    staleTime: 240000,
    refetchInterval: 240000,
  });
  return image.data ? (
    <Image
      source={{ uri: image.data }}
      style={{ width: 180, height: 180, borderRadius: 8 }}
    />
  ) : (
    <Status loading={image.isLoading} error={image.error} />
  );
}
function Inbox({ initial }: { initial: string | null }) {
  const { api, user, run } = useApp();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(initial),
    [body, setBody] = useState(""),
    [image, setImage] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const chats = useQuery({
    queryKey: ["chats", user?.id],
    queryFn: () => api.chats(),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const messages = useInfiniteQuery({
    queryKey: ["messages", selected],
    queryFn: ({ pageParam }) => api.messages(selected!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === 50 ? last[0].created_at : undefined,
    enabled: !!selected && !!user,
  });
  useEffect(() => {
    if (!selected || !user) return;
    void run(() => api.markRead(selected));
    return api.subscribeChat(selected, () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", selected] });
      void run(() => api.markRead(selected));
    });
  }, [api, selected, user?.id, queryClient]);
  if (!user) return <Empty text="Sign in to start a conversation." />;
  const all = messages.data?.pages.slice().reverse().flat() ?? [];
  const unique = [...new Map(all.map((m) => [m.id, m])).values()];
  return (
    <>
      <Title eyebrow="START A CONVERSATION" title="Local connections." />
      <Status error={chats.error} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {chats.data?.map((c) => (
          <Button
            key={c.id}
            title={`${c.businesses.name}${c.customer_id !== user.id ? " · " + c.customer_id.slice(0, 6) : ""}${c.unread ? " (" + c.unread + ")" : ""}`}
            quiet={selected !== c.id}
            onPress={() => {
              setSelected(c.id);
              setImage(null);
            }}
          />
        ))}
      </ScrollView>
      {!selected ? (
        <Empty text="Visit a business to say hello, or select a conversation above." />
      ) : (
        <>
          <Status loading={messages.isLoading} error={messages.error} />
          {messages.hasNextPage && (
            <Button
              title="Older messages"
              quiet
              onPress={() => void messages.fetchNextPage()}
            />
          )}
          <View style={s.messageArea}>
            {unique.map((m) => (
              <View
                key={m.id}
                style={[s.bubble, m.sender_id === user.id && s.ownBubble]}
              >
                {m.image_path && <SignedImage path={m.image_path} />}
                <Text style={s.body}>{m.body}</Text>
                <Text style={s.muted}>
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.card}>
            <Field label="Message" value={body} onChange={setBody} />
            <Upload key={selected} chat={selected} onChange={setImage} />
            {image && (
              <Button
                title="Photo attached · Remove"
                quiet
                onPress={() => setImage(null)}
              />
            )}
            <Button
              title="Send message"
              disabled={busy}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  if (
                    await run(() =>
                      api.send({ chat_id: selected, body, image_path: image }),
                    )
                  ) {
                    setBody("");
                    setImage(null);
                  }
                  setBusy(false);
                })();
              }}
            />
          </View>
        </>
      )}
    </>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f4" },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e9df",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 32,
    color: "#285b45",
    letterSpacing: -2,
  },
  content: { padding: 20, paddingBottom: 32 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#8b9482",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 9,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 35,
    lineHeight: 40,
    color: "#293b2e",
  },
  sectionTitle: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 24,
    color: "#293b2e",
    marginBottom: 14,
    marginTop: 12,
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e8df",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    overflow: "hidden",
  },
  body: { color: "#52604c", fontSize: 13, lineHeight: 21, marginVertical: 8 },
  bold: { fontWeight: "700", color: "#293b2e", fontSize: 13 },
  muted: { color: "#87907e", fontSize: 11, lineHeight: 18 },
  field: { marginBottom: 15 },
  label: { color: "#54634d", fontSize: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#fcfcf9",
    borderWidth: 1,
    borderColor: "#dfe4d6",
    borderRadius: 9,
    padding: 12,
    color: "#293b2e",
    fontSize: 14,
  },
  button: {
    backgroundColor: "#285b45",
    padding: 13,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 5,
    marginRight: 5,
  },
  quiet: { backgroundColor: "#edf2e5", borderWidth: 1, borderColor: "#e0e7d6" },
  buttonText: { fontSize: 12, fontWeight: "700", color: "white" },
  chip: {
    backgroundColor: "#edf2e5",
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 7,
    borderRadius: 20,
  },
  chipActive: { backgroundColor: "#285b45" },
  avatar: {
    width: 38,
    height: 38,
    backgroundColor: "#e9efd9",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  postHead: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postImage: { width: "100%", aspectRatio: 1.1 },
  productImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 14,
  },
  shopLogo: { width: 70, height: 70, borderRadius: 35, marginBottom: 16 },
  row: { flexDirection: "row", gap: 25, alignItems: "center" },
  empty: {
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#dce3d1",
    borderRadius: 13,
    marginVertical: 15,
  },
  error: {
    backgroundColor: "#fbeee7",
    color: "#a34e37",
    padding: 16,
    borderRadius: 9,
    marginBottom: 15,
  },
  bottom: {
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e6e9df",
    paddingVertical: 10,
  },
  bottomItem: { flex: 1, alignItems: "center", gap: 2 },
  messageArea: { paddingVertical: 20, gap: 10 },
  bubble: {
    padding: 12,
    borderRadius: 13,
    backgroundColor: "white",
    alignSelf: "flex-start",
    maxWidth: "90%",
  },
  ownBubble: { alignSelf: "flex-end", backgroundColor: "#e5efd9" },
});
