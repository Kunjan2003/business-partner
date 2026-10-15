import {logOutWithPush} from "../push";
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Button, Field, Icon, colors } from "../ui";
import { useApp, pickPhoto, type Photo } from "../session";

export default function Onboarding() {
  const { api, run } = useApp();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"customer" | "owner">("customer");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function choosePhoto() {
    try {
      const picked = await pickPhoto();
      if (picked) setPhoto(picked);
    } catch (e) {
      Alert.alert(
        "Photo",
        e instanceof Error ? e.message : "Could not open the photo picker",
      );
    }
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const avatar_url = photo
        ? await api.uploadImage(photo.bytes, photo.mime)
        : undefined;
      const success = await run(
        () =>
          api.finishOnboarding({
            display_name: name,
            username,
            role,
            bio,
            avatar_url,
          }),
        ["profile"],
      );
      if (!success) setFeedback("Please check your details and try again.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save your profile";
      setFeedback(
        message.toLowerCase().includes("duplicate")
          ? "Username already taken. Please choose another."
          : message,
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
        <View style={styles.header}>
          <Text style={styles.logo}>bp.</Text>
          <View style={styles.verified}>
            <Icon name="checkmark-circle" size={16} color="#378151" />
            <Text style={styles.verifiedText}>Email verified</Text>
          </View>
        </View>
        <View style={styles.progress}>
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
        <Text style={styles.eyebrow}>ONE LAST STEP</Text>
        <Text style={styles.title}>Make it yours.</Text>
        <Text style={styles.subtitle}>
          Set up a profile to follow neighborhood favorites and connect with
          local businesses.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add profile photo"
          style={styles.photoRow}
          onPress={() => void choosePhoto()}
        >
          <View style={styles.avatar}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.avatarImage} />
            ) : (
              <Icon name="person-outline" size={32} color="#777" />
            )}
            <View style={styles.camera}>
              <Icon name="camera" size={14} color="white" />
            </View>
          </View>
          <View>
            <Text style={styles.photoTitle}>Add a profile photo</Text>
            <Text style={styles.photoSubtitle}>
              Optional · choose from your gallery
            </Text>
          </View>
        </Pressable>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholder="Your name"
        />
        <Field
          label="Username"
          value={username}
          onChangeText={(v) =>
            setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ""))
          }
          autoCapitalize="none"
          placeholder="your.username"
          maxLength={30}
        />
        <Field
          label="Short bio (optional)"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell your community about yourself"
          maxLength={160}
          multiline
        />
        <Text style={styles.roleTitle}>How will you use Business Partner?</Text>
        <View style={styles.roles}>
          {(["customer", "owner"] as const).map((item) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: role === item }}
              key={item}
              onPress={() => setRole(item)}
              style={[styles.role, role === item && styles.selected]}
            >
              <Icon
                name={
                  item === "owner" ? "storefront-outline" : "compass-outline"
                }
                size={25}
              />
              <Text style={styles.roleName}>
                {item === "owner" ? "Business owner" : "Explore"}
              </Text>
              <Text style={styles.roleHint}>
                {item === "owner"
                  ? "Grow your business"
                  : "Find local favorites"}
              </Text>
            </Pressable>
          ))}
        </View>
        {!!feedback && (
          <Text accessibilityRole="alert" style={styles.error}>
            {feedback}
          </Text>
        )}
        <Button
          title={busy ? "Saving…" : "Complete profile"}
          busy={busy}
          onPress={() => void submit()}
        />
        <Pressable
          onPress={() => void run(() => logOutWithPush(api), ["profile"])}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  page: {
    padding: 26,
    paddingBottom: 35,
    maxWidth: 550,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -2,
    color: "#151515",
  },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 12, color: "#378151", fontWeight: "600" },
  progress: { flexDirection: "row", gap: 5, marginTop: 30, marginBottom: 25 },
  bar: { height: 4, backgroundColor: "#161616", flex: 1, borderRadius: 2 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    color: "#777",
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.6,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 25,
    fontSize: 13,
    lineHeight: 21,
    color: "#777",
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 25,
  },
  avatar: {
    width: 77,
    height: 77,
    borderRadius: 39,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 77, height: 77, borderRadius: 39 },
  camera: {
    backgroundColor: "#151515",
    position: "absolute",
    bottom: 0,
    right: 0,
    padding: 5,
    borderRadius: 15,
  },
  photoTitle: { fontSize: 14, fontWeight: "700", color: "#222" },
  photoSubtitle: { fontSize: 11, color: "#888", marginTop: 6 },
  roleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    marginTop: 2,
    marginBottom: 13,
  },
  roles: { flexDirection: "row", gap: 11, marginBottom: 24 },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 12,
    padding: 14,
    gap: 7,
    backgroundColor: "#fafafa",
  },
  selected: {
    borderWidth: 2,
    borderColor: "#151515",
    backgroundColor: "#f4f4f4",
    padding: 13,
  },
  roleName: { fontWeight: "700", color: "#222", fontSize: 13 },
  roleHint: { fontSize: 11, color: "#777" },
  error: {
    padding: 13,
    backgroundColor: "#fff0f0",
    color: "#ac2c3e",
    borderRadius: 9,
    marginBottom: 15,
    fontSize: 12,
  },
  signOut: { padding: 18, alignItems: "center" },
  signOutText: { color: "#737373", fontSize: 13, fontWeight: "600" },
});
