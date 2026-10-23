"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Store,
  UserRound,
  Sparkles,
  Camera,
} from "lucide-react";
import { useApp } from "./provider";
import { PasswordEditor } from "./account-profile";

type Mode = "login" | "signup" | "link" | "reset" | "sent";
const callbackUrl = () => `${window.location.origin}/auth/callback`;

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, error, refreshProfile } = useApp();
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    setRecovery(new URLSearchParams(location.search).get("recovery") === "1");
  }, []);
  if (loading)
    return (
      <main className="ig-loading">
        <div className="ig-logo">bp.</div>
        <p>Getting your world ready…</p>
      </main>
    );
  if (!user) return <Authentication error={error} />;
  if (recovery)
    return (
      <main className="ig-onboard-wrap">
        <section className="ig-onboard-card">
          <h1>Reset your password</h1>
          <PasswordEditor
            done={() => {
              history.replaceState(null, "", "/");
              setRecovery(false);
            }}
          />
        </section>
      </main>
    );
  if (!user.onboarding_completed)
    return <Onboarding onComplete={refreshProfile} />;
  return <>{children}</>;
}

function Authentication({ error: sessionError }: { error: string }) {
  const { api } = useApp();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sentKind, setSentKind] = useState<"signup" | "link" | "reset">(
    "signup",
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        await api.register(email, password, callbackUrl());
        setSentKind("signup");
        setMode("sent");
      } else if (mode === "link") {
        await api.magicLink(email, callbackUrl());
        setSentKind("link");
        setMode("sent");
      } else if (mode === "reset") {
        await api.resetPassword(email, `${callbackUrl()}?recovery=1`);
        setSentKind("reset");
        setMode("sent");
      } else {
        await api.signIn(email, password);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not continue. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (sentKind === "reset")
        await api.resetPassword(email, `${callbackUrl()}?recovery=1`);
      else if (sentKind === "link") await api.magicLink(email, callbackUrl());
      else await api.resendVerification(email, callbackUrl());
      setMessage(
        "A new email has been requested. Check your inbox and spam folder.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send email.");
    } finally {
      setBusy(false);
    }
  }
  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
  }
  return (
    <main className="ig-auth-layout">
      <section className="ig-auth-story" aria-label="Explore Business Partner">
        <div className="ig-story-mark">
          <span className="ig-mini-logo">bp.</span> Business Partner
        </div>
        <div className="ig-story-content">
          <div className="ig-story-label">
            <Sparkles size={17} /> REAL PEOPLE. LOCAL PLACES.
          </div>
          <h1>
            See what’s happening with <em>local businesses.</em>
          </h1>
          <p>
            Discover neighborhood favorites, follow local stores, and find what
            you love in one connected community.
          </p>
          <div className="ig-story-showcase">
            <div className="ig-story-photo">
              <span className="ig-photo-icon">✦</span>
              <span>
                Discover something
                <br />
                worth sharing.
              </span>
            </div>
            <div className="ig-story-float">
              <span className="ig-story-bubble">♥</span>
              <div>
                <b>Made for your neighborhood</b>
                <small>Stories, shops & real connections</small>
              </div>
            </div>
          </div>
        </div>
        <span className="ig-story-bottom">YOUR NEIGHBORHOOD, CONNECTED.</span>
      </section>
      <section className="ig-auth-column">
        <div className="ig-auth-card">
          <div className="ig-auth-heading">
            <div className="ig-auth-symbol">bp.</div>
            {mode === "sent" ? (
              <>
                <h2>Check your inbox</h2>
                <p>
                  If the address is eligible, a secure link will arrive at{" "}
                  <strong>{email}</strong>.
                </p>
              </>
            ) : (
              <>
                <h2>
                  {mode === "login"
                    ? "Log into Business Partner"
                    : mode === "signup"
                      ? "Join Business Partner"
                      : mode === "reset"
                        ? "Trouble logging in?"
                        : "Log in with a link"}
                </h2>
                <p>
                  {mode === "signup"
                    ? "Create an account to explore the places around you."
                    : mode === "link"
                      ? "We'll email you a secure one-time sign-in link."
                      : "Sign in to discover your local world."}
                </p>
              </>
            )}
          </div>
          {mode === "sent" ? (
            <>
              <div className="ig-sent-icon">
                <Mail size={36} />
              </div>
              <p className="ig-helper">
                Open the link on this device to continue securely. Check your
                spam folder if it doesn’t arrive.
              </p>
              <button
                className="ig-button"
                type="button"
                onClick={() => switchTo("login")}
              >
                Back to log in <ArrowRight size={17} />
              </button>
              <button
                className="ig-text-button"
                disabled={busy}
                onClick={() => void resend()}
              >
                Resend email
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="ig-auth-form">
              <label>
                Email address
                <input
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {mode !== "link" && mode !== "reset" && (
                <label>
                  Password
                  <div className="ig-password">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      minLength={mode === "signup" ? 8 : undefined}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {mode === "signup" && (
                <p className="ig-helper">
                  Use at least 8 characters. You'll verify your email, then
                  create your profile.
                </p>
              )}
              <button type="submit" className="ig-button" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Log in"
                    : mode === "signup"
                      ? "Send verification email"
                      : mode === "reset"
                        ? "Send reset link"
                        : "Send magic link"}{" "}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {(error || (!error && sessionError)) && (
            <p className="ig-alert" role="alert">
              {error || sessionError}
            </p>
          )}
          {message && (
            <p className="ig-success" role="status">
              <CheckCircle2 size={17} />
              {message}
            </p>
          )}
          {mode === "login" && (
            <button
              className="ig-text-button"
              onClick={() => switchTo("reset")}
            >
              Forgot password?
            </button>
          )}
          {mode === "reset" && (
            <button
              className="ig-text-button"
              onClick={() => switchTo("login")}
            >
              Back to log in
            </button>
          )}
          {mode === "login" && (
            <button className="ig-text-button" onClick={() => switchTo("link")}>
              Log in with an email link instead
            </button>
          )}
          {mode === "link" && (
            <button
              className="ig-text-button"
              onClick={() => switchTo("login")}
            >
              Use my password
            </button>
          )}
          {mode === "login" && (
            <button
              className="ig-oauth-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const { error } = await api.db.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: callbackUrl() },
                  });
                  if (error) throw error;
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Could not start Google sign-in.",
                  );
                  setBusy(false);
                }
              }}
            >
              Continue with Google
            </button>
          )}
          <div className="ig-switch">
            {mode === "signup"
              ? "Already have an account?"
              : "New to Business Partner?"}{" "}
            <button
              onClick={() => switchTo(mode === "signup" ? "login" : "signup")}
            >
              {mode === "signup" ? "Log in" : "Sign up"}
            </button>
          </div>
        </div>
        <p className="ig-terms">
          By continuing, you agree to use the community respectfully.
        </p>
        <p className="ig-auth-footer">
          Business Partner · Built for local connections
        </p>
      </section>
    </main>
  );
}

function Onboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const { api, run } = useApp();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const avatar_url = photo
        ? await api.uploadImage(photo, photo.type)
        : undefined;
      await api.finishOnboarding({
        display_name: name,
        username,
        role,
        bio,
        avatar_url,
      });
      await onComplete();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save your profile";
      setError(
        message.includes("23505") ||
          message.toLowerCase().includes("duplicate key")
          ? "That username is taken. Try another one."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ig-onboard-wrap">
      <section className="ig-onboard-card">
        <div className="ig-onboard-top">
          <span className="ig-mini-logo">bp.</span>
          <span>
            <CheckCircle2 size={16} /> Email verified
          </span>
        </div>
        <div className="ig-onboard-progress">
          <i />
          <i />
          <i />
        </div>
        <div className="ig-onboard-title">
          <span className="ig-story-label">ONE LAST STEP</span>
          <h1>Make it yours.</h1>
          <p>
            Set up your profile so people can find you and the businesses you
            love.
          </p>
        </div>
        <form onSubmit={finish} className="ig-auth-form">
          <label className="ig-photo-choice">
            <span className="ig-photo-circle">
              {photo ? (
                <img
                  src={URL.createObjectURL(photo)}
                  alt="Selected profile photo"
                />
              ) : (
                <UserRound size={32} />
              )}
              <Camera size={17} className="ig-photo-camera" />
            </span>
            <span>
              <b>Add a profile photo</b>
              <small>Optional · JPG, PNG or WebP (max 6 MB)</small>
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Full name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="your.username"
              pattern="[a-z0-9._]{3,30}"
              title="3–30 lowercase letters, numbers, dots or underscores"
              maxLength={30}
              required
            />
          </label>
          <label>
            Short bio (optional)
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder="Tell your neighborhood a little about yourself"
            />
          </label>
          <div className="ig-role-heading">
            How will you use Business Partner?
          </div>
          <div className="ig-role-grid">
            <button
              type="button"
              className={role === "customer" ? "ig-role selected" : "ig-role"}
              onClick={() => setRole("customer")}
            >
              <UserRound size={22} />
              <b>Explore</b>
              <small>Follow local favorites</small>
            </button>
            <button
              type="button"
              className={role === "owner" ? "ig-role selected" : "ig-role"}
              onClick={() => setRole("owner")}
            >
              <Store size={22} />
              <b>Business owner</b>
              <small>Grow your business</small>
            </button>
          </div>
          {error && (
            <p className="ig-alert" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="ig-button">
            {busy ? "Setting up…" : "Complete profile"} <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="ig-text-button"
          onClick={() => void run(() => api.signOut())}
        >
          <ArrowLeft size={14} /> Sign out
        </button>
      </section>
    </main>
  );
}
