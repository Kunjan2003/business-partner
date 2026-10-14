import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { explainError } from "@bp/core";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const colors = {
  ink: "#101114",
  muted: "#85858c",
  line: "#ebebef",
  blue: "#3797f0",
  bg: "#ffffff",
  soft: "#f5f5f7",
  pink: "#e1306c",
};
export function Icon({
  name,
  size = 24,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function IconButton({
  name,
  label,
  onPress,
  color,
  disabled,
  badge,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.iconButton, disabled && { opacity: 0.4 }]}
    >
      <Icon name={name} color={color} />
      {!!badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}
export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        height: size,
        width: size,
        borderRadius: size / 2,
        backgroundColor: "#ececf2",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 0.5,
        borderColor: "#dddddf",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Text
          style={{ fontWeight: "700", fontSize: size * 0.35, color: "#5d5d69" }}
        >
          {name.trim().slice(0, 1).toUpperCase() || "B"}
        </Text>
      )}
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy,
  outline = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  outline?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        styles.button,
        outline && styles.outline,
        (busy || disabled) && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? colors.ink : "white"} />
      ) : (
        <Text style={[styles.buttonText, outline && { color: colors.ink }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#a1a1aa"
        autoCorrect={false}
        style={[
          styles.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}
export function Chips({
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
      contentContainerStyle={{
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
    >
      {values.map((v) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === v }}
          onPress={() => onChange(v)}
          key={v}
          style={[
            styles.chip,
            value === v && {
              backgroundColor: colors.ink,
              borderColor: colors.ink,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: value === v ? "white" : colors.ink,
            }}
          >
            {v}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Empty({
  title,
  message,
  icon = "images-outline",
  action,
}: {
  title: string;
  message: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={34} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {action && <Button title={action.label} onPress={action.onPress} />}
    </View>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  return loading ? (
    <ActivityIndicator style={{ margin: 28 }} color={colors.ink} />
  ) : error ? (
    <View style={styles.error}>
      <Text style={styles.errorText}>{explainError(error)}</Text>
      {retry && (
        <Pressable onPress={retry} style={{ paddingTop: 10 }}>
          <Text style={{ color: colors.blue, fontWeight: "600" }}>
            Try again
          </Text>
        </Pressable>
      )}
    </View>
  ) : null;
}
export function Photo({ uri, style }: { uri: string; style?: ViewStyle }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <View
      style={[
        {
          aspectRatio: 1,
          backgroundColor: colors.soft,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon name="image-outline" size={36} color={colors.muted} />
      <Text style={styles.caption}>Photo unavailable</Text>
    </View>
  ) : (
    <Image
      source={{ uri }}
      onError={() => setFailed(true)}
      style={[
        { width: "100%", aspectRatio: 1, backgroundColor: colors.soft },
        style as never,
      ]}
    />
  );
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  brand: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.ink,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: colors.pink,
    borderRadius: 9,
    minWidth: 16,
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: "white",
  },
  badgeText: {
    color: "white",
    fontWeight: "700",
    fontSize: 9,
    textAlign: "center",
  },
  button: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginVertical: 5,
  },
  buttonText: { fontSize: 14, fontWeight: "700", color: "white" },
  outline: { backgroundColor: "#f0f0f3" },
  input: {
    backgroundColor: colors.soft,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
    marginBottom: 7,
  },
  caption: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  bold: { fontWeight: "700", color: colors.ink },
  section: { padding: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  empty: { paddingHorizontal: 36, paddingVertical: 44, alignItems: "center" },
  emptyIcon: {
    height: 68,
    width: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: colors.ink,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  error: {
    margin: 16,
    padding: 16,
    backgroundColor: "#fff1f1",
    borderRadius: 10,
  },
  errorText: { fontSize: 13, color: "#b33838", lineHeight: 19 },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 12, marginTop: 4, color: "#53535b" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 13,
  },
  tabBar: {
    height: 57,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: "white",
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
