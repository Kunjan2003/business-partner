"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Grid3X3,
  Settings,
  Store,
  X,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import type { Post } from "@bp/core";
import { useApp } from "./provider";

export default function AccountProfile({
  manage,
  renderPost,
}: {
  manage: () => void;
  renderPost: (post: Post) => ReactNode;
}) {
  const { api, user, run } = useApp();
  const [section, setSection] = useState<"profile" | "edit" | "security">(
    "profile",
  );
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [selected, setSelected] = useState<Post | null>(null);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "Tab") {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".post-overlay button:not(:disabled), .post-overlay a[href], .post-overlay input:not(:disabled), .post-overlay textarea:not(:disabled)",
          ),
        );
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [selected]);
  const business = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
  });
  const stats = useQuery({
    queryKey: ["stats", business.data?.id],
    queryFn: () => api.businessStats(business.data!.id),
    enabled: !!business.data,
  });
  const followed = useQuery({
    queryKey: ["followed-count", user?.id],
    queryFn: () => api.followedCount(),
  });
  const posts = useInfiniteQuery({
    queryKey: ["profile-grid", user?.id, business.data?.id, tab],
    queryFn: ({ pageParam }) =>
      tab === "saved"
        ? api.feed(pageParam, false, true)
        : api.businessPosts(business.data!.id, pageParam),
    enabled: tab === "saved" || !!business.data,
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
  });
  if (!user) return null;
  const name = user.username || user.display_name;
  const avatar = (
    <span className="profile-avatar">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={`${name}'s profile`} />
      ) : (
        user.display_name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
  if (section !== "profile")
    return (
      <div className="profile-settings">
        <aside className="settings-menu">
          <h2>Settings</h2>
          <p>Your account</p>
          <button
            onClick={() => setSection("edit")}
            className={section === "edit" ? "selected" : ""}
          >
            <UserRound size={22} /> Edit profile
          </button>
          <button
            onClick={() => setSection("security")}
            className={section === "security" ? "selected" : ""}
          >
            <LockKeyhole size={22} /> Password and security
          </button>
          <button onClick={manage}>
            <Store size={22} /> Business tools
          </button>
          <button onClick={() => setSection("profile")}>
            <ArrowLeft size={22} /> Back to profile
          </button>
        </aside>
        <section className="settings-content">
          <button
            className="settings-back"
            onClick={() => setSection("profile")}
          >
            <ArrowLeft size={18} /> Profile
          </button>
          <h1>
            {section === "edit" ? "Edit profile" : "Password and security"}
          </h1>
          {section === "edit" ? (
            <ProfileEditor key={user.id} done={() => setSection("profile")} />
          ) : (
            <PasswordEditor />
          )}
        </section>
      </div>
    );
  const error = business.error || stats.error || followed.error || posts.error;
  return (
    <section className="social-profile">
      <header className="profile-header">
        {avatar}
        <div className="profile-info">
          <div className="profile-name">
            <h1>{name}</h1>
            <button aria-label="Settings" onClick={() => setSection("edit")}>
              <Settings size={25} />
            </button>
          </div>
          <p className="profile-display-name">{user.display_name}</p>
          <div className="profile-stats">
            <span>
              <b>{stats.data?.posts ?? 0}</b> posts
            </span>
            <span>
              <b>{stats.data?.followers ?? 0}</b> followers
            </span>
            <span>
              <b>{followed.data ?? 0}</b> following
            </span>
          </div>
          <p className="muted">
            {business.data?.category ||
              (user.role === "owner" ? "Business owner" : "Business community")}
          </p>
          <p className="profile-bio">{user.bio}</p>
          {user.website && (
            <a
              className="profile-website"
              href={user.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {user.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </header>
      <div className="profile-actions">
        <button className="outline" onClick={() => setSection("edit")}>
          Edit profile
        </button>
        <button className="outline" onClick={manage}>
          {business.data ? "Manage business" : "Set up business"}
        </button>
        <button
          className="outline"
          onClick={() => void run(() => api.signOut())}
        >
          Log out
        </button>
      </div>
      <div
        className="profile-grid-tabs"
        role="tablist"
        aria-label="Profile posts"
      >
        <button
          role="tab"
          aria-selected={tab === "posts"}
          onClick={() => setTab("posts")}
        >
          <Grid3X3 size={24} />
          <span>Posts</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "saved"}
          onClick={() => setTab("saved")}
        >
          <Bookmark size={24} />
          <span>Saved</span>
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error.message}
        </p>
      )}
      {(business.isLoading || posts.isLoading) && (
        <p role="status">Loading your profile…</p>
      )}
      <div className="profile-grid">
        {posts.data?.pages.flat().map((post) => (
          <button
            key={post.id}
            aria-label={`Open post: ${post.caption}`}
            onClick={() => setSelected(post)}
          >
            {post.image_url ? (
              <img src={post.image_url} alt={post.caption} />
            ) : (
              <span>{post.caption}</span>
            )}
            <span className="grid-engagement">
              ♥ {post.likes.length} · {post.comments.length} comments
            </span>
          </button>
        ))}
      </div>
      {!business.isLoading &&
        !posts.isLoading &&
        !error &&
        !posts.data?.pages.flat().length && (
          <div className="profile-empty">
            <Camera size={68} />
            <h2>
              {tab === "saved"
                ? "Save what inspires you"
                : "Share your business"}
            </h2>
            <p>
              {tab === "saved"
                ? "Save posts from your feed to find them here."
                : "When you share business photos and updates, they’ll appear on your profile."}
            </p>
            {tab === "posts" && (
              <button className="ig-text-button" onClick={manage}>
                Share your first post
              </button>
            )}
          </div>
        )}
      {posts.hasNextPage && (
        <button
          className="outline more"
          disabled={posts.isFetchingNextPage}
          onClick={() => void posts.fetchNextPage()}
        >
          Load more
        </button>
      )}
      {selected && (
        <div className="post-overlay" onClick={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Business post"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="dialog-close"
              aria-label="Close post"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            {renderPost(selected)}
          </section>
        </div>
      )}
    </section>
  );
}
function ProfileEditor({ done }: { done: () => void }) {
  const { api, user, refreshProfile } = useApp();
  const [name, setName] = useState(user!.display_name),
    [username, setUsername] = useState(user!.username || ""),
    [bio, setBio] = useState(user!.bio || ""),
    [website, setWebsite] = useState(user!.website || ""),
    [role, setRole] = useState(user!.role);
  const [photo, setPhoto] = useState<File | null>(null),
    [removed, setRemoved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const avatar_url = photo
        ? await api.uploadImage(photo, photo.type)
        : removed
          ? ""
          : undefined;
      await api.saveProfile({
        display_name: name,
        username,
        bio,
        website,
        role,
        avatar_url,
      });
      await refreshProfile();
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }
  const uri = preview || (!removed && user!.avatar_url);
  return (
    <form className="profile-editor form" onSubmit={save}>
      <div className="profile-photo-card">
        <span className="avatar">
          {uri ? <img src={uri} alt="Profile preview" /> : name.slice(0, 1)}
        </span>
        <div>
          <b>{username || name}</b>
          <small>{name}</small>
        </div>
        <label className="primary photo-upload">
          Change photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] || null);
              setRemoved(false);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="ig-text-button"
        onClick={() => {
          setPhoto(null);
          setRemoved(true);
        }}
      >
        Remove photo
      </button>
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label>
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          pattern="[a-z0-9._]{3,30}"
          title="3–30 lowercase letters, numbers, dots or underscores"
          maxLength={30}
          required
        />
      </label>
      <label>
        Website
        <input
          type="url"
          placeholder="https://your-business.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          maxLength={300}
        />
      </label>
      <label>
        Bio
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={160}
        />
        <small className="bio-counter" aria-hidden="true">
          {bio.length} / 160
        </small>
      </label>
      <label>
        Account type
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="owner">Business owner</option>
          <option value="customer">Business community member</option>
        </select>
      </label>
      <p className="muted">
        Your name, username, photo, bio and website are public.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}
export function PasswordEditor({ done }: { done?: () => void }) {
  const { api } = useApp();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="form profile-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (password !== confirm) {
          setMessage("Passwords don’t match.");
          return;
        }
        setBusy(true);
        try {
          await api.changePassword(password);
          setPassword("");
          setConfirm("");
          setMessage("Password updated.");
          done?.();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to update password.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Choose a strong password with at least 8 characters.</p>
      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
