import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Button, Field, Icon, colors } from "../ui";
import { useApp, googleSignIn } from "../session";

type Mode = "login" | "signup" | "magic" | "reset" | "sent";
const redirectTo = "businesspartner://auth/callback";
export default function Auth() {
  const { api, run } = useApp();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sentKind, setSentKind] = useState<"signup" | "magic" | "reset">(
    "signup",
  );
  const [visible, setVisible] = useState(false);
  function changeMode(next: Mode) {
    setMode(next);
    setFeedback("");
    setPassword("");
  }
  async function submit() {
    if (busy) return;
    if (
      !email.trim() ||
      (mode !== "magic" && mode !== "reset" && password.length < 1)
    ) {
      setFeedback("Enter your email and password.");
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      if (mode === "signup") {
        await api.register(email, password, redirectTo);
        setSentKind("signup");
        setMode("sent");
      } else if (mode === "magic") {
        await api.magicLink(email, redirectTo);
        setSentKind("magic");
        setMode("sent");
      } else if (mode === "reset") {
        await api.resetPassword(email, redirectTo);
        setSentKind("reset");
        setMode("sent");
      } else {
        await api.signIn(email, password);
      }
    } catch (e) {
      setFeedback(
        e instanceof Error ? e.message : "Unable to continue. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      if (sentKind === "reset") await api.resetPassword(email, redirectTo);
      else if (sentKind === "magic") await api.magicLink(email, redirectTo);
      else await api.resendVerification(email, redirectTo);
      setFeedback(
        "Another email was requested. Check your inbox and spam folder.",
      );
    } catch (e) {
      setFeedback(
        e instanceof Error ? e.message : "Could not resend the email.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
      >
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandMark}>bp.</Text>
          </View>
          <Text style={styles.brandName}>Business Partner</Text>
          <Text style={styles.tagline}>
            Connect with the businesses around you.
          </Text>
        </View>
        <View style={styles.card}>
          {mode === "sent" ? (
            <>
              <View style={styles.sent}>
                <Icon name="mail-open-outline" size={38} color={colors.ink} />
              </View>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                If the address is eligible, a secure link will arrive at {email}
                . Open it on this device to continue.
              </Text>
              <Button
                title="Back to log in"
                onPress={() => changeMode("login")}
              />
              <Pressable
                style={styles.textButton}
                onPress={() => void resend()}
                disabled={busy}
              >
                <Text style={styles.link}>Resend email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {mode === "signup"
                  ? "Create your account"
                  : mode === "magic"
                    ? "Get a sign-in link"
                    : mode === "reset"
                      ? "Trouble logging in?"
                      : "Log into Business Partner"}
              </Text>
              <Text style={styles.subtitle}>
                {mode === "signup"
                  ? "Join your local community. Verify your email before setting up your profile."
                  : mode === "magic"
                    ? "We'll email you a one-time link to your existing account."
                    : "Log in to follow businesses, explore, and connect."}
              </Text>
              <Field
                label="Email address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {mode !== "magic" && mode !== "reset" && (
                <View>
                  <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Enter your password"
                    }
                    secureTextEntry={!visible}
                    autoCapitalize="none"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                  />
                  <Pressable
                    onPress={() => setVisible(!visible)}
                    style={styles.eye}
                    accessibilityLabel={
                      visible ? "Hide password" : "Show password"
                    }
                  >
                    <Icon
                      name={visible ? "eye-off-outline" : "eye-outline"}
                      color={colors.muted}
                      size={20}
                    />
                  </Pressable>
                </View>
              )}
              <Button
                busy={busy}
                title={
                  mode === "login"
                    ? "Log in"
                    : mode === "signup"
                      ? "Send verification email"
                      : mode === "reset"
                        ? "Send reset link"
                        : "Email me a magic link"
                }
                onPress={() => void submit()}
              />
              {mode === "login" && (
                <Pressable
                  style={styles.textButton}
                  onPress={() => changeMode("reset")}
                >
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>
              )}
              {mode === "reset" && (
                <Pressable
                  style={styles.textButton}
                  onPress={() => changeMode("login")}
                >
                  <Text style={styles.link}>Back to log in</Text>
                </Pressable>
              )}
              {mode === "login" && (
                <Pressable
                  style={styles.textButton}
                  onPress={() => changeMode("magic")}
                >
                  <Text style={styles.link}>
                    Log in with an email link instead
                  </Text>
                </Pressable>
              )}
              {mode === "magic" && (
                <Pressable
                  style={styles.textButton}
                  onPress={() => changeMode("login")}
                >
                  <Text style={styles.link}>Use my password instead</Text>
                </Pressable>
              )}
              {mode === "login" && (
                <>
                  <View style={styles.orRow}>
                    <View style={styles.line} />
                    <Text style={styles.or}>OR</Text>
                    <View style={styles.line} />
                  </View>
                  <Button
                    title="Continue with Google"
                    outline
                    disabled={busy}
                    onPress={() => void run(googleSignIn, ["profile"])}
                  />
                </>
              )}
            </>
          )}
          {!!feedback && (
            <Text accessibilityRole="alert" style={styles.feedback}>
              {feedback}
            </Text>
          )}
        </View>
        <View style={styles.switchCard}>
          <Text style={styles.switchText}>
            {mode === "signup"
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
          </Text>
          <Pressable
            onPress={() => changeMode(mode === "signup" ? "login" : "signup")}
          >
            <Text style={styles.link}>
              {mode === "signup" ? "Log in" : "Sign up"}
            </Text>
          </Pressable>
        </View>
        <View style={styles.footer}>
          <Icon name="lock-closed-outline" color={colors.muted} size={13} />
          <Text style={styles.footerText}>
            A safer space for your local community.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 23,
    paddingVertical: 28,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  brand: { alignItems: "center", marginTop: 10, marginBottom: 35 },
  brandIcon: {
    width: 73,
    height: 73,
    backgroundColor: "#171717",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  brandMark: {
    color: "white",
    fontWeight: "900",
    fontSize: 36,
    letterSpacing: -3,
  },
  brandName: {
    color: "#171717",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -1,
  },
  tagline: { color: colors.muted, fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: "white",
    borderColor: "#e8e8e8",
    borderWidth: 1,
    borderRadius: 17,
    padding: 24,
    gap: 2,
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    color: "#797979",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 24,
  },
  sent: {
    borderColor: "#e6e6e6",
    borderWidth: 1.5,
    height: 82,
    width: 82,
    borderRadius: 41,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  textButton: { paddingVertical: 14, alignItems: "center" },
  link: { color: "#2966b8", fontSize: 13, fontWeight: "700" },
  eye: { position: "absolute", right: 10, bottom: 31, padding: 4 },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    gap: 13,
  },
  line: { height: 1, flex: 1, backgroundColor: "#e8e8e8" },
  or: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  feedback: {
    backgroundColor: "#fff1f1",
    color: "#a12433",
    padding: 12,
    marginTop: 13,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 19,
  },
  switchCard: {
    backgroundColor: "white",
    marginTop: 13,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  switchText: { color: "#555", fontSize: 13 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 25,
    gap: 6,
  },
  footerText: { fontSize: 11, color: colors.muted },
});

export function ResetPassword({ done }: { done?: () => void }) {
  const { api, finishRecovery } = useApp();
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24 }}
      >
        <Text style={styles.title}>Reset your password</Text>
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          maxLength={128}
        />
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          maxLength={128}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={styles.feedback}>
            {error}
          </Text>
        )}
        <Button
          title="Update password"
          busy={busy}
          onPress={() => {
            if (busy) return;
            if (password !== confirm) {
              setError("Passwords don’t match.");
              return;
            }
            setBusy(true);
            void api
              .changePassword(password)
              .then(() => {
                Alert.alert("Password updated");
                finishRecovery();
                done?.();
              })
              .catch((e) =>
                setError(
                  e instanceof Error ? e.message : "Unable to update password.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
