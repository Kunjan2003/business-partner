import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { styles as s, Button, Field, Icon, colors } from "../ui";
import { useApp, googleSignIn } from "../session";
export default function Auth() {
  const { api, run } = useApp();
  const [mode, setMode] = useState<"login" | "signup" | "phone">("login"),
    [name, setName] = useState(""),
    [role, setRole] = useState<"customer" | "owner">("customer"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true);
    await run(async () => {
      if (mode === "signup") {
        const result = await api.signUp(
          email.trim(),
          password,
          name,
          role,
          "businesspartner://auth/callback",
        );
        if (!result.session) {
          Alert.alert(
            "Check your email",
            "Confirm your account, then come back and sign in.",
          );
          setMode("login");
        }
      } else if (mode === "phone") {
        if (sent) await api.verifyOtp(phone.trim(), code.trim());
        else {
          await api.phoneOtp(phone.trim());
          setSent(true);
        }
      } else await api.signIn(email.trim(), password);
    }, ["profile"]);
    setBusy(false);
  }
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 30,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 35 }}>
          <View
            style={{
              width: 70,
              height: 70,
              borderRadius: 21,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <Icon name="storefront-outline" color="white" size={34} />
          </View>
          <Text style={{ fontSize: 31, fontWeight: "800", letterSpacing: -1 }}>
            Business Partner
          </Text>
          <Text
            style={[
              s.caption,
              { textAlign: "center", marginTop: 10, maxWidth: 270 },
            ]}
          >
            Discover local businesses. Follow your favorites. Connect with the
            people behind them.
          </Text>
        </View>
        <Text style={{ fontSize: 21, fontWeight: "700", marginBottom: 22 }}>
          {mode === "signup"
            ? "Create your account"
            : mode === "phone"
              ? "Sign in with your phone"
              : "Welcome back"}
        </Text>
        {mode === "signup" && (
          <>
            <Field
              label="Full name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
            <View style={[s.row, { marginBottom: 20 }]}>
              {(["customer", "owner"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={{
                    flex: 1,
                    padding: 13,
                    borderWidth: role === r ? 2 : 1,
                    borderColor: role === r ? colors.ink : colors.line,
                    borderRadius: 10,
                  }}
                >
                  <Icon
                    name={
                      r === "owner" ? "storefront-outline" : "person-outline"
                    }
                    size={20}
                  />
                  <Text style={{ fontWeight: "600", marginTop: 7 }}>
                    {r === "owner" ? "Business owner" : "Customer"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {mode === "phone" ? (
          <>
            <Field
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              editable={!sent}
            />
            {sent && (
              <Field
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="sms-otp"
              />
            )}
          </>
        ) : (
          <>
            <Field
              label="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
            />
          </>
        )}
        <Button
          title={
            mode === "signup"
              ? "Create account"
              : mode === "phone"
                ? sent
                  ? "Verify code"
                  : "Send code"
                : "Log in"
          }
          busy={busy}
          onPress={() => void submit()}
        />
        <Text style={[s.caption, { textAlign: "center", marginVertical: 18 }]}>
          OR
        </Text>
        <Button
          title="Continue with Google"
          outline
          disabled={busy}
          onPress={() => void run(googleSignIn, ["profile"])}
        />
        <Pressable
          onPress={() => {
            setMode(mode === "phone" ? "login" : "phone");
            setSent(false);
          }}
          style={{ padding: 14, alignItems: "center" }}
        >
          <Text style={{ color: colors.blue, fontWeight: "600" }}>
            {mode === "phone" ? "Use email instead" : "Use phone instead"}
          </Text>
        </Pressable>
        <View style={[s.divider, { marginVertical: 20 }]} />
        <Pressable
          onPress={() => setMode(mode === "signup" ? "login" : "signup")}
          style={{ padding: 10, alignItems: "center" }}
        >
          <Text style={s.body}>
            {mode === "signup"
              ? "Already have an account?"
              : "Don’t have an account?"}{" "}
            <Text style={{ color: colors.blue, fontWeight: "700" }}>
              {mode === "signup" ? "Log in" : "Sign up"}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
