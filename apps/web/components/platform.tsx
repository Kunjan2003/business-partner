"use client";
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Home,
  Search,
  MessageCircle,
  Bookmark,
  Store,
  Bell,
  LogOut,
  Plus,
  Heart,
  Send,
  MapPin,
  ArrowUpRight,
  Shield,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import {
  categories,
  directionsUrl,
  type Business,
  type BusinessInput,
  type Post,
  type Product,
  type SearchInput,
  type Message,
} from "@bp/core";
import Provider, { useApp } from "./provider";
import AuthGate from "./auth-gate";
type View =
  | "feed"
  | "search"
  | "messages"
  | "saved"
  | "business"
  | "dashboard"
  | "notifications"
  | "account"
  | "admin";
const nav = [
  ["feed", "Your feed", Home],
  ["search", "Explore nearby", Search],
  ["messages", "Messages", MessageCircle],
  ["saved", "Saved finds", Bookmark],
  ["business", "My business", Store],
  ["dashboard", "Dashboard", LayoutDashboard],
  ["notifications", "Notifications", Bell],
] as const;
function Loading({
  error,
  loading,
}: {
  error?: Error | null;
  loading?: boolean;
}) {
  return error ? (
    <p className="error" role="alert">
      {error.message}
    </p>
  ) : loading ? (
    <p className="muted" role="status">
      Loading…
    </p>
  ) : null;
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Store size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button className="primary" disabled={busy}>
      {busy ? "Please wait…" : children}
    </button>
  );
}
export default function Platform() {
  return (
    <Provider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </Provider>
  );
}
function Shell() {
  const { api, user, run } = useApp();
  const [view, setView] = useState<View>("feed"),
    [business, setBusiness] = useState<string | null>(null),
    [chat, setChat] = useState<string | null>(null),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("business");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setBusiness(id);
  }, []);
  const admin = useQuery({
    queryKey: ["admin", user?.id],
    queryFn: () => api.isAdmin(),
    enabled: !!user,
  });
  function navigate(v: View) {
    setView(v);
    setBusiness(null);
    setMenu(false);
  }
  function openBusiness(id: string) {
    setBusiness(id);
    setMenu(false);
  }
  function openChat(id: string) {
    setChat(id);
    setBusiness(null);
    setView("messages");
  }
  return (
    <div className="shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/">
          {" "}
          <span className="brand-mark">bp</span> Business Partner
          <span className="brand-dot">.</span>
        </a>
        <p className="eyebrow">YOUR LOCAL WORLD</p>
        <nav>
          {nav
            .filter(
              ([id]) =>
                !["business", "dashboard"].includes(id) ||
                user?.role === "owner",
            )
            .map(([id, label, Icon]) => (
              <button
                key={id}
                className={view === id && !business ? "nav active" : "nav"}
                onClick={() => navigate(id)}
              >
                <Icon size={21} />
                {label}
              </button>
            ))}
          {admin.data && (
            <button className="nav" onClick={() => navigate("admin")}>
              <Shield size={21} />
              Moderation
            </button>
          )}
        </nav>
        <div className="sidebar-card">
          <span>
            Made for the places
            <br />
            that make your day.
          </span>
          <p>Shop small. Connect local.</p>
        </div>
        <button className="account" onClick={() => navigate("account")}>
          <span className="avatar">
            {user?.display_name[0]?.toUpperCase() ?? "↗"}
          </span>
          <span>
            <b>{user?.display_name ?? "Join your neighborhood"}</b>
            <small>{user?.role ?? "Sign in or create an account"}</small>
          </span>
        </button>
        {user && (
          <button
            className="nav"
            onClick={() => void run(() => api.signOut(), "Signed out")}
          >
            <LogOut size={18} />
            Log out
          </button>
        )}
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <span>
            <MapPin size={16} /> Discover something local
          </span>
          <button
            className="outline"
            onClick={() =>
              navigate(user?.role === "owner" ? "business" : "account")
            }
          >
            <Plus size={16} />
            {user?.role === "owner" ? "Create a post" : "Join the community"}
          </button>
        </header>
        <div className="content">
          {business ? (
            <BusinessPage id={business} openChat={openChat} />
          ) : view === "account" ? (
            <Account />
          ) : view === "feed" || view === "saved" ? (
            <Feed saved={view === "saved"} openBusiness={openBusiness} />
          ) : view === "search" ? (
            <Explore openBusiness={openBusiness} />
          ) : view === "messages" ? (
            <ChatPanel initial={chat} />
          ) : view === "business" ? (
            <ManageBusiness />
          ) : view === "dashboard" ? (
            <Dashboard />
          ) : view === "notifications" ? (
            <Notifications />
          ) : view === "admin" ? (
            <Admin />
          ) : null}
        </div>
        <footer>
          Business Partner <span>Good things happen close to home.</span>
        </footer>
      </main>
      <aside className="rightbar">
        <div className="local-card">
          <p className="eyebrow">A LITTLE CLOSER</p>
          <h2>
            Big discoveries.
            <br />
            Small businesses.
          </h2>
          <p>
            Find your next favorite coffee, a handmade gift, or the shop just
            around the corner.
          </p>
          <button onClick={() => navigate("search")}>
            Explore your neighborhood <ArrowUpRight size={17} />
          </button>
          <div className="shop-art">
            ☕ <span>✿</span> ▧
          </div>
        </div>
        <p className="eyebrow">EXPLORE BY CATEGORY</p>
        {categories.slice(0, 6).map((c, i) => (
          <button
            className="category-link"
            key={c}
            onClick={() => navigate("search")}
          >
            <span>{["☕", "✂", "⌂", "✿", "▧", "✧"][i]}</span>
            {c}
            <ArrowUpRight size={16} />
          </button>
        ))}
        <div className="note">
          <b>More than a marketplace.</b>
          <p>Meet the people behind the products you love.</p>
        </div>
      </aside>
    </div>
  );
}
function Account() {
  const { api, user, run } = useApp();
  const [mode, setMode] = useState<"login" | "signup" | "phone">("login"),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [phone, setPhone] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    await run(
      async () => {
        if (user) {
          await api.updateProfile(
            String(d.get("name")),
            d.get("role") as "owner" | "customer",
          );
          window.location.reload();
        } else if (mode === "signup") {
          const data = await api.signUp(
            String(d.get("email")),
            String(d.get("password")),
            String(d.get("name")),
            d.get("role") as "owner" | "customer",
            `${location.origin}/auth/callback`,
          );
          if (!data.session)
            throw new Error(
              "Check your email to confirm your account, then sign in.",
            );
        } else if (mode === "phone") {
          if (sent) await api.verifyOtp(phone, String(d.get("otp")));
          else {
            await api.phoneOtp(phone);
            setSent(true);
          }
        } else
          await api.signIn(String(d.get("email")), String(d.get("password")));
      },
      mode === "phone" && !sent ? "Verification code sent" : "Account updated",
    );
    setBusy(false);
  }
  return (
    <section className="auth">
      <p className="eyebrow">YOUR LOCAL COMMUNITY</p>
      <h1>
        {user
          ? "Your account"
          : mode === "signup"
            ? "Come on in."
            : "Welcome back."}
      </h1>
      <p className="subtitle">
        Discover the businesses and people that make your neighborhood yours.
      </p>
      {!user && (
        <div className="tabs">
          {(["login", "signup", "phone"] as const).map((m) => (
            <button
              className={m === mode ? "selected" : ""}
              key={m}
              onClick={() => setMode(m)}
            >
              {m === "login"
                ? "Sign in"
                : m === "signup"
                  ? "Create account"
                  : "Phone"}
            </button>
          ))}
        </div>
      )}
      <form className="panel form" onSubmit={submit}>
        {(user || mode === "signup") && (
          <>
            <label>
              Your name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={user?.display_name}
              />
            </label>
            <label>
              I’m here as
              <select name="role" defaultValue={user?.role ?? "customer"}>
                <option value="customer">
                  Customer — discover local businesses
                </option>
                <option value="owner">Business owner — grow my business</option>
              </select>
            </label>
          </>
        )}
        {!user &&
          (mode === "phone" ? (
            <>
              <label>
                Phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  required
                  disabled={sent}
                />
              </label>
              {sent && (
                <label>
                  Verification code
                  <input
                    name="otp"
                    inputMode="numeric"
                    required
                    autoComplete="one-time-code"
                  />
                </label>
              )}
            </>
          ) : (
            <>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                />
              </label>
            </>
          ))}
        <Submit busy={busy}>
          {user
            ? "Save profile"
            : mode === "signup"
              ? "Create account"
              : mode === "phone"
                ? sent
                  ? "Verify code"
                  : "Send code"
                : "Sign in"}
        </Submit>
        {!user && (
          <button
            className="outline"
            type="button"
            onClick={() =>
              void run(async () => {
                const { error } = await api.db.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${location.origin}/auth/callback` },
                });
                if (error) throw error;
              })
            }
          >
            Continue with Google
          </button>
        )}
      </form>
    </section>
  );
}
function Feed({
  saved,
  openBusiness,
}: {
  saved: boolean;
  openBusiness: (id: string) => void;
}) {
  const { api, user } = useApp();
  const [following, setFollowing] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["feed", saved, following, user?.id],
    queryFn: ({ pageParam }) => api.feed(pageParam, following, saved),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
    enabled: !saved || !!user,
  });
  return (
    <>
      <p className="eyebrow">THE NEIGHBORHOOD EDIT</p>
      <h1>{saved ? "Your saved finds." : "A little local inspiration."}</h1>
      <p className="subtitle">
        Fresh finds, familiar faces, and something new around every corner.
      </p>
      {!saved && (
        <div className="tabs">
          <button
            className={!following ? "selected" : ""}
            onClick={() => setFollowing(false)}
          >
            For you
          </button>
          <button
            className={following ? "selected" : ""}
            onClick={() => setFollowing(true)}
            disabled={!user}
          >
            Following
          </button>
        </div>
      )}
      <Loading error={query.error} loading={query.isLoading} />
      {saved && !user ? (
        <Empty title="Keep your favorites close">
          Sign in to save the things you love.
        </Empty>
      ) : (
        query.data?.pages
          .flat()
          .map((post) => (
            <PostCard key={post.id} post={post} openBusiness={openBusiness} />
          ))
      )}
      {query.data?.pages[0]?.length === 0 && (
        <Empty
          title={
            following
              ? "Your feed starts with a follow"
              : "Your neighborhood is just getting started"
          }
        >
          Explore local businesses or share your first business post.
        </Empty>
      )}
      {query.hasNextPage && (
        <button
          className="outline more"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </>
  );
}
function PostCard({
  post,
  openBusiness,
}: {
  post: Post;
  openBusiness: (id: string) => void;
}) {
  const { api, user, run, notify } = useApp();
  const [comments, setComments] = useState(false);
  const saved = useQuery({
    queryKey: ["saved", post.id, user?.id],
    queryFn: () => api.saved(post.id),
    enabled: !!user,
  });
  const replies = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => api.comments(post.id),
    enabled: comments,
  });
  const liked = post.likes.some((l) => l.user_id === user?.id);
  return (
    <article className="post panel">
      <div className="post-head">
        <button
          onClick={() => openBusiness(post.business_id)}
          className="business-link"
        >
          <span className="avatar">
            {post.businesses.logo_url ? (
              <img src={post.businesses.logo_url} alt="" />
            ) : (
              post.businesses.name[0]
            )}
          </span>
          <span>
            <b>{post.businesses.name}</b>
            <small>
              {post.businesses.category} ·{" "}
              {new Date(post.created_at).toLocaleDateString()}
            </small>
          </span>
        </button>
        <span className="tag">
          {post.kind === "offer" ? "Local offer" : post.businesses.category}
        </span>
      </div>
      {!!post.video_uid && <div className="post-video">
        <iframe title={`Video from ${post.businesses.name}`}
          loading="lazy" allowFullScreen
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          src={`https://iframe.videodelivery.net/${post.video_uid}`}/>
        <small>New videos may take a moment to finish processing.</small>
      </div>}
      {post.image_url && (
        <img
          className="post-image"
          src={post.image_url}
          alt={post.caption.slice(0, 120)}
          loading="lazy"
        />
      )}
      <div className="post-body">
        <div className="actions">
          <button
            className={liked ? "liked" : ""}
            aria-label={liked ? "Unlike" : "Like"}
            onClick={() => void run(() => api.toggle("likes", post.id, liked))}
          >
            <Heart fill={liked ? "currentColor" : "none"} />
            <span>{post.likes.length}</span>
          </button>
          <button aria-label="Comments" onClick={() => setComments(!comments)}>
            <MessageCircle />
            <span>{post.comments.length}</span>
          </button>
          <button
            aria-label="Share post"
            onClick={() =>
              void run(async () => {
                const url = `${location.origin}/?business=${post.business_id}`;
                if (navigator.share)
                  await navigator.share({
                    title: post.businesses.name,
                    text: post.caption,
                    url,
                  });
                else {
                  await navigator.clipboard.writeText(url);
                  notify("Link copied");
                }
              })
            }
          >
            <Send />
          </button>
          <button
            className="save"
            aria-label="Save post"
            onClick={() =>
              void run(() => api.toggle("saves", post.id, !!saved.data))
            }
          >
            <Bookmark fill={saved.data ? "currentColor" : "none"} />
          </button>
        </div>
        <p>
          <b>{post.businesses.name}</b> {post.caption}
        </p>
        <button
          className="text-link"
          onClick={() => openBusiness(post.business_id)}
        >
          Visit business <ArrowUpRight size={14} />
        </button>
        {user && (
          <button
            className="report"
            onClick={() => {
              const reason = prompt("Why are you reporting this post?");
              if (reason)
                void run(
                  () => api.report("post", post.id, reason),
                  "Report submitted",
                );
            }}
          >
            Report
          </button>
        )}
        {comments && (
          <div className="comments">
            <Loading error={replies.error} />
            {replies.data?.map((c) => (
              <p key={c.id}>
                <b>{c.profiles.display_name}</b> {c.body}
              </p>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const body = String(new FormData(f).get("body"));
                if (await run(() => api.comment(post.id, body))) f.reset();
              }}
            >
              <input
                name="body"
                placeholder="Add a comment…"
                aria-label="Comment"
                required
                maxLength={1000}
              />
              <button className="icon" aria-label="Send comment">
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
function Explore({ openBusiness }: { openBusiness: (id: string) => void }) {
  const { api, notify } = useApp();
  const [filters, setFilters] = useState<SearchInput>({}),
    [near, setNear] = useState<{ latitude: number; longitude: number } | null>(
      null,
    );
  const query = useInfiniteQuery({
    queryKey: ["search", filters, near],
    queryFn: ({ pageParam }) => api.search({ ...filters, ...near }, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
  });
  return (
    <>
      <p className="eyebrow">GOOD THINGS, CLOSE BY</p>
      <h1>Find your next favorite.</h1>
      <p className="subtitle">
        One search for shops, products, and a whole lot of local.
      </p>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setFilters({
            query: String(d.get("q")),
            category: String(d.get("category")),
            min_price: Number(d.get("min")),
            max_price: Number(d.get("max") || 100000000),
            min_rating: Number(d.get("rating")),
          });
        }}
      >
        <label>
          Search your neighborhood
          <input
            name="q"
            placeholder="Coffee, handmade gifts, your favorite shop…"
          />
        </label>
        <div className="grid">
          <label>
            Category
            <select name="category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Minimum rating
            <select name="rating">
              <option value="0">Any rating</option>
              <option value="3">3+ stars</option>
              <option value="4">4+ stars</option>
            </select>
          </label>
          <label>
            Min price (₹)
            <input name="min" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Max price (₹)
            <input name="max" type="number" min="0" placeholder="Any price" />
          </label>
        </div>
        <div className="row">
          <button className="primary">
            <Search size={18} /> Search
          </button>
          <button
            className="outline"
            type="button"
            onClick={() => {
              if (near) {
                setNear(null);
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (p) =>
                  setNear({
                    latitude: p.coords.latitude,
                    longitude: p.coords.longitude,
                  }),
                () =>
                  notify(
                    "Location unavailable. Allow location access or browse without it.",
                  ),
              );
            }}
          >
            <MapPin size={16} />
            {near ? "Nearby: 25 km ×" : "Near me"}
          </button>
        </div>
      </form>
      <Loading error={query.error} loading={query.isLoading} />
      <div className="results">
        {query.data?.pages.flat().map((r) => (
          <button
            className="result panel"
            key={r.kind + r.id}
            onClick={() => openBusiness(r.business_id)}
          >
            {r.image_url ? (
              <img loading="lazy" src={r.image_url} alt={r.name} />
            ) : (
              <div className="result-placeholder">
                <Store size={35} />
              </div>
            )}
            <div>
              <span className="eyebrow">
                {r.kind} · {r.category}
              </span>
              <h3>{r.name}</h3>
              <p>{r.description.slice(0, 100)}</p>
              <b>
                {r.price !== null
                  ? `₹${Number(r.price).toLocaleString("en-IN")}`
                  : "Visit shop"}
              </b>
              <small>
                ★ {Number(r.rating).toFixed(1)}
                {r.distance_km !== null
                  ? ` · ${r.distance_km.toFixed(1)} km away`
                  : ""}
              </small>
            </div>
          </button>
        ))}
      </div>
      {query.data?.pages[0]?.length === 0 && (
        <Empty title="No matches yet">
          Try a different keyword, category, or wider location.
        </Empty>
      )}
      {query.hasNextPage && (
        <button
          className="outline more"
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </>
  );
}
function BusinessPage({
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
    reviews = useQuery({
      queryKey: ["reviews", id],
      queryFn: () => api.reviews(id),
    }),
    following = useQuery({
      queryKey: ["following", id, user?.id],
      queryFn: () => api.following(id),
      enabled: !!user,
    });
  if (!shop.data)
    return <Loading loading={shop.isLoading} error={shop.error} />;
  const b = shop.data;
  return (
    <>
      <div className="business-hero panel">
        <span className="avatar large">
          {b.logo_url ? <img src={b.logo_url} alt="" /> : b.name[0]}
        </span>
        <p className="eyebrow">{b.category}</p>
        <h1>{b.name}</h1>
        <p>{b.description}</p>
        <div className="row">
          <button
            className="primary"
            onClick={() =>
              void run(() => api.toggle("follows", id, !!following.data))
            }
          >
            {following.data ? "Following ✓" : "Follow business"}
          </button>
          {b.owner_id !== user?.id && (
            <button
              className="outline"
              onClick={() =>
                void run(async () => openChat(await api.startChat(id)))
              }
            >
              <MessageCircle size={18} />
              Message
            </button>
          )}
        </div>
      </div>
      <div className="panel details">
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY && (
          <iframe
            title="Shop location"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{
              width: "100%",
              height: 240,
              border: 0,
              borderRadius: 10,
              marginBottom: 15,
            }}
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY}&q=${b.latitude},${b.longitude}`}
          />
        )}
        <p>
          <MapPin size={17} />
          {b.address}
        </p>
        <p>Opening hours: {b.hours || "Contact business for hours"}</p>
        <p>Contact: {b.contact || "Use chat to get in touch"}</p>
        <a
          className="text-link"
          href={directionsUrl(b.latitude, b.longitude)}
          target="_blank"
          rel="noreferrer"
        >
          Get directions on Google Maps <ArrowUpRight size={16} />
        </a>
        {user && user.id !== b.owner_id && (
          <button
            className="report"
            onClick={() => {
              if (
                confirm(
                  "Block this business owner? This also disables your conversation.",
                )
              )
                void run(() => api.block(b.owner_id), "Business owner blocked");
            }}
          >
            Block owner
          </button>
        )}
      </div>
      <h2>The local collection</h2>
      <Loading error={products.error} />
      <div className="results">
        {products.data?.map((p) => (
          <div className="panel result" key={p.id}>
            {p.image_url && (
              <img src={p.image_url} alt={p.name} loading="lazy" />
            )}
            <div>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <b>₹{Number(p.price).toLocaleString("en-IN")}</b>
              <small>
                {p.available ? "Available" : "Currently unavailable"}
              </small>
            </div>
          </div>
        ))}
      </div>
      {products.data?.length === 0 && (
        <Empty title="New products coming soon">
          Message the business to ask what’s available.
        </Empty>
      )}
      <h2>From the neighborhood</h2>
      {reviews.data?.map((r) => (
        <div className="panel review" key={r.id}>
          <b>{r.profiles.display_name}</b>
          <span> {"★".repeat(r.rating)}</span>
          <p>{r.body}</p>
        </div>
      ))}
      {user && user.id !== b.owner_id && (
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            void run(
              () =>
                api.review(id, Number(d.get("rating")), String(d.get("body"))),
              "Review saved",
            );
          }}
        >
          <label>
            Your rating
            <select name="rating">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} stars
                </option>
              ))}
            </select>
          </label>
          <label>
            Your review
            <textarea name="body" maxLength={2000} />
          </label>
          <button className="primary">Save review</button>
        </form>
      )}
    </>
  );
}
async function optimizeImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose JPEG, PNG or WebP");
  if (file.size > 6 * 1024 * 1024)
    throw new Error("Choose an image under 6 MB");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process image"))),
      "image/webp",
      0.85,
    ),
  );
}
function ImageField({
  onChange,
  chat,
}: {
  onChange: (url: string) => void;
  chat?: string;
}) {
  const { api, run } = useApp();
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <label>
      Photo (JPEG, PNG, WebP · max 6 MB)
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          await run(async () => {
            const blob = await optimizeImage(file);
            onChange(await api.uploadImage(blob, "image/webp", chat));
            setDone(true);
          });
          setBusy(false);
        }}
      />
      {busy && <small>Uploading…</small>}
      {done && <small>Photo ready ✓</small>}
    </label>
  );
}
function ManageBusiness() {
  const { api, user, run } = useApp();
  const query = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
    enabled: !!user,
  });
  if (user?.role !== "owner")
    return (
      <Empty title="Make room for your business">
        Choose Business owner in your account to create your business profile.
      </Empty>
    );
  if (query.isLoading || query.error)
    return <Loading loading={query.isLoading} error={query.error} />;
  return (
    <>
      <p className="eyebrow">GROW SOMETHING LOCAL</p>
      <h1>Your business, your story.</h1>
      <BusinessForm
        key={query.data?.id ?? "new"}
        business={query.data ?? undefined}
      />
      {query.data && (
        <>
          <h2>Share something new</h2>
          <PostForm business={query.data} />
          <h2>Your products</h2>
          <ProductManager business={query.data} />
        </>
      )}
    </>
  );
}
function BusinessForm({ business }: { business?: Business }) {
  const { api, run } = useApp();
  const [busy, setBusy] = useState(false),
    [logo, setLogo] = useState(business?.logo_url ?? "");
  return (
    <form
      className="panel form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setBusy(true);
        await run(
          () =>
            api.saveBusiness(
              {
                ...data,
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                logo_url: logo,
              } as BusinessInput,
              business?.id,
            ),
          "Business profile saved",
        );
        setBusy(false);
      }}
    >
      <div className="grid">
        <label>
          Business name
          <input
            name="name"
            defaultValue={business?.name}
            required
            maxLength={100}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={business?.category}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={business?.description}
          maxLength={2000}
        />
      </label>
      <label>
        Shop address
        <input
          name="address"
          defaultValue={business?.address}
          required
          maxLength={300}
        />
      </label>
      <div className="grid">
        <label>
          Contact
          <input
            name="contact"
            defaultValue={business?.contact}
            maxLength={120}
          />
        </label>
        <label>
          Working hours
          <input
            name="hours"
            defaultValue={business?.hours}
            placeholder="Mon–Sat, 9 am–7 pm"
            maxLength={500}
          />
        </label>
        <label>
          Map pin latitude
          <input
            name="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            defaultValue={business?.latitude}
            required
          />
        </label>
        <label>
          Map pin longitude
          <input
            name="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            defaultValue={business?.longitude}
            required
          />
        </label>
      </div>
      <small>
        Copy your shop’s coordinates from Google Maps. Nearby search uses this
        pin.
      </small>
      <ImageField onChange={setLogo} />
      <Submit busy={busy}>Save business profile</Submit>
    </form>
  );
}
function PostForm({ business }: { business: Business }) {
  const { api, run } = useApp();
  const [image, setImage] = useState(""),
    [video, setVideo] = useState<File | null>(null),
    [videoError, setVideoError] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  return (
    <form
      className="panel form"
      key={version}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget,
          d = new FormData(f);
        setBusy(true);
        if (
          await run(
            async () => {
              if (video && (video.size>200*1024*1024 || !video.type.startsWith("video/"))) {
                throw new Error("Choose a supported video under 200 MB.");
              }
              const video_uid=video ? await api.uploadVideo(business.id,video):undefined;
              await api.createPost({
                business_id:business.id,
                caption:d.get("caption"),
                kind:video_uid ? "video" : d.get("kind"),
                image_url:video_uid ? "" : image,
                video_uid,
              });
            },
            "Post published",
          )
        ) {
          setImage("");
          setVideo(null);
          setVersion(version + 1);
        }
        setBusy(false);
      }}
    >
      <label>
        What’s new?
        <textarea
          name="caption"
          required
          maxLength={2200}
          placeholder="A new arrival, a special offer, or a little behind the scenes…"
        />
      </label>
      <label>
        Post type
        <select name="kind">
          <option value="post">Photo / update</option>
          <option value="offer">Offer</option>
          <option value="product">Product highlight</option>
        </select>
      </label>
      <ImageField onChange={value => {setImage(value); if(value) setVideo(null);}} />
      <label>
        Or upload a short video / Reel (up to 90 seconds, 200 MB)
        <input type="file" accept="video/mp4,video/quicktime,video/webm"
          onChange={e => {
            const picked=e.target.files?.[0]??null;
            if(picked && picked.size>200*1024*1024){
              setVideoError("Choose a video smaller than 200 MB.");
              setVideo(null);return;
            }
            setVideoError("");
            setVideo(picked);
            if(picked) setImage("");
          }}/>
      </label>
      {!!video && <small>Video selected: {video.name}. Upload starts when you publish.</small>}
      {!!videoError && <p role="alert" className="error">{videoError}</p>}
      <Submit busy={busy}>Publish post</Submit>
    </form>
  );
}
function ProductManager({ business }: { business: Business }) {
  const { api, run } = useApp();
  const products = useQuery({
    queryKey: ["products", business.id],
    queryFn: () => api.products(business.id),
  });
  const [editing, setEditing] = useState<Product | null>(null),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  return (
    <>
      <form
        className="panel form"
        key={version}
        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setBusy(true);
          if (
            await run(
              () =>
                api.saveProduct(
                  {
                    business_id: business.id,
                    name: String(d.get("name")),
                    description: String(d.get("description")),
                    category: String(d.get("category")),
                    price: Number(d.get("price")),
                    available: d.get("available") === "on",
                    image_url: image,
                  },
                  editing?.id,
                ),
              "Product saved",
            )
          ) {
            setEditing(null);
            setImage("");
            setVersion((v) => v + 1);
          }
          setBusy(false);
        }}
      >
        <h3>{editing ? "Edit product" : "Add a product"}</h3>
        <div className="grid">
          <label>
            Product name
            <input
              name="name"
              defaultValue={editing?.name}
              required
              maxLength={120}
            />
          </label>
          <label>
            Price (₹)
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={editing?.price}
              required
            />
          </label>
        </div>
        <label>
          Category
          <select
            name="category"
            defaultValue={editing?.category ?? business.category}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={editing?.description}
            maxLength={2000}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="available"
            defaultChecked={editing?.available ?? true}
          />{" "}
          Available
        </label>
        <ImageField onChange={setImage} />
        <Submit busy={busy}>Save product</Submit>
      </form>
      <Loading error={products.error} />
      {products.data?.map((p) => (
        <div className="panel product-row" key={p.id}>
          <span>
            <b>{p.name}</b>
            <small>
              ₹{p.price} · {p.available ? "Available" : "Unavailable"}
            </small>
          </span>
          <button
            className="outline"
            onClick={() => {
              setEditing(p);
              setImage(p.image_url);
              setVersion((v) => v + 1);
            }}
          >
            Edit
          </button>
          <button
            className="report"
            onClick={() => {
              if (confirm(`Delete ${p.name}?`))
                void run(() => api.deleteProduct(p.id), "Product deleted");
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </>
  );
}
function ChatImage({ path }: { path: string }) {
  const { api } = useApp();
  const image = useQuery({
    queryKey: ["chat-image", path],
    queryFn: () => api.chatImage(path),
    staleTime: 240000,
    refetchInterval: 240000,
  });
  return image.data ? (
    <img className="chat-image" src={image.data} alt="Shared photo" />
  ) : (
    <Loading loading={image.isLoading} error={image.error} />
  );
}
function ChatPanel({ initial }: { initial: string | null }) {
  const { api, user, run } = useApp();
  const cache = useQueryClient();
  const [selected, setSelected] = useState(initial),
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
    const changed = () => {
      void cache.invalidateQueries({ queryKey: ["messages", selected] });
      void run(() => api.markRead(selected));
    };
    void run(() => api.markRead(selected));
    return api.subscribeChat(selected, changed);
  }, [api, selected, user?.id, cache]);
  const all = messages.data?.pages.slice().reverse().flat() ?? [];
  const unique = [...new Map(all.map((m) => [m.id, m])).values()];
  return (
    <>
      <p className="eyebrow">START A CONVERSATION</p>
      <h1>Local connections.</h1>
      {!user ? (
        <Empty title="Say hello">Sign in to message a business.</Empty>
      ) : (
        <>
          <Loading error={chats.error} loading={chats.isLoading} />
          <div className="chat-layout panel">
            <div className="chat-list">
              {chats.data?.map((c) => (
                <button
                  key={c.id}
                  className={selected === c.id ? "selected" : ""}
                  onClick={() => {
                    setSelected(c.id);
                    setImage(null);
                  }}
                >
                  <b>{c.businesses.name}</b>
                  <small>
                    {c.customer_id === user.id
                      ? "Business conversation"
                      : `Customer ${c.customer_id.slice(0, 8)}`}
                  </small>
                  {!!c.unread && <span className="badge">{c.unread}</span>}
                </button>
              ))}
              {chats.data?.length === 0 && (
                <p>No conversations yet. Visit a business and tap Message.</p>
              )}
            </div>
            <div className="conversation">
              {selected ? (
                <>
                  <div className="messages">
                    <Loading
                      error={messages.error}
                      loading={messages.isLoading}
                    />
                    {messages.hasNextPage && (
                      <button
                        className="outline"
                        onClick={() => void messages.fetchNextPage()}
                      >
                        Older messages
                      </button>
                    )}
                    {unique.map((m) => (
                      <div
                        key={m.id}
                        className={
                          m.sender_id === user.id ? "bubble own" : "bubble"
                        }
                      >
                        {m.image_path && <ChatImage path={m.image_path} />}
                        <p>{m.body}</p>
                        <small>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                    ))}
                    {unique.length === 0 && (
                      <p className="muted">A friendly hello goes a long way.</p>
                    )}
                  </div>
                  <form
                    className="form composer"
                    key={selected}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = e.currentTarget,
                        body = String(new FormData(f).get("body"));
                      setBusy(true);
                      if (
                        await run(() =>
                          api.send({
                            chat_id: selected,
                            body,
                            image_path: image,
                          }),
                        )
                      ) {
                        f.reset();
                        setImage(null);
                      }
                      setBusy(false);
                    }}
                  >
                    <label>
                      Message
                      <input
                        name="body"
                        placeholder="Write a message…"
                        maxLength={4000}
                      />
                    </label>
                    <ImageField chat={selected} onChange={setImage} />
                    {image && (
                      <small>
                        Image attached{" "}
                        <button type="button" onClick={() => setImage(null)}>
                          Remove
                        </button>
                      </small>
                    )}
                    <Submit busy={busy}>Send message</Submit>
                  </form>
                </>
              ) : (
                <Empty title="Your inbox, closer to home">
                  Select a conversation to get started.
                </Empty>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
function Dashboard() {
  const { api, user } = useApp();
  const stats = useQuery({
    queryKey: ["analytics", user?.id],
    queryFn: () => api.analytics(),
    enabled: !!user,
  });
  return (
    <>
      <p className="eyebrow">YOUR BUSINESS AT A GLANCE</p>
      <h1>Small steps. Real connections.</h1>
      <Loading error={stats.error} loading={stats.isLoading} />
      {stats.data?.[0] ? (
        <div className="stats">
          {Object.entries(stats.data[0]).map(([k, v]) => (
            <div className="panel stat" key={k}>
              <span>{k.replace("_", " ")}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Your story starts here">
          Create a business profile to see your activity.
        </Empty>
      )}
      <p className="muted">
        Live totals for your business. View and profile-visit tracking is
        planned for the analytics phase.
      </p>
    </>
  );
}
function Notifications() {
  const { api, user, run } = useApp();
  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.notifications(),
    enabled: !!user,
    refetchInterval: 30000,
  });
  return (
    <>
      <p className="eyebrow">IN THE LOOP</p>
      <h1>Your neighborhood news.</h1>
      <Loading error={query.error} loading={query.isLoading} />
      {query.data?.map((n) => (
        <button
          className="panel notification"
          key={n.id}
          onClick={() => void run(() => api.readNotification(n.id))}
        >
          <Bell size={20} />
          <span>
            <b>{n.body}</b>
            <small>{new Date(n.created_at).toLocaleString()}</small>
          </span>
          {!n.read_at && <span className="dot" />}
        </button>
      ))}
      {(!user || query.data?.length === 0) && (
        <Empty title="All caught up">
          Likes, follows, comments, and messages will appear here.
        </Empty>
      )}
    </>
  );
}
function Admin() {
  const { api, run } = useApp();
  const admin = useQuery({ queryKey: ["admin"], queryFn: () => api.isAdmin() });
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.reports(),
    enabled: admin.data === true,
  });
  if (!admin.data)
    return (
      <Empty title="Admin access required">
        Moderation is restricted to approved administrators.
      </Empty>
    );
  return (
    <>
      <h1>Community moderation</h1>
      <Loading error={reports.error} />
      {reports.data?.map((r) => (
        <div className="panel review" key={r.id}>
          <b>
            {r.target_type} · {r.status}
          </b>
          <p>{r.reason}</p>
          <small>{r.target_id}</small>
          <div className="row">
            <button
              className="outline"
              onClick={() =>
                void run(() => api.moderate(r.id, false), "Report resolved")
              }
            >
              Resolve
            </button>
            {r.target_type !== "user" && (
              <button
                className="primary"
                onClick={() =>
                  void run(() => api.moderate(r.id, true), "Content hidden")
                }
              >
                Hide content
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
