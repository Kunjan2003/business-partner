import * as Sentry from "@sentry/react-native";
import React, { useEffect, useState } from "react";
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
});

import {
  View,
  Text,
  ActivityIndicator,
  BackHandler,
  Pressable,
  StatusBar,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { AppProvider, configured, useApp } from "./src/session";
import {
  styles as s,
  Icon,
  IconButton,
  Avatar,
  Empty,
  Button,
  QueryState,
  colors,
} from "./src/ui";
import type { Tab, Route, Navigate } from "./src/navigation";
import Auth from "./src/screens/auth";
import { enablePush, logOutWithPush } from "./src/push";
import Onboarding from "./src/screens/onboarding";
import { Feed, PostScreen } from "./src/screens/feed";
import Explore from "./src/screens/explore";
import Create from "./src/screens/create";
import {
  Profile,
  EditProfile,
  EditBusiness,
  Products,
  Analytics,
} from "./src/screens/profile";
import {
  Inbox,
  Conversation,
  Comments,
  Notifications,
} from "./src/screens/social";
export default function App() {
  const [fonts, error] = useFonts(Ionicons.font);
  if (error)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.screen}>
          <Empty
            title="Couldn’t load the app"
            message="Restart the app to reload its resources."
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if (!fonts)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.screen, { justifyContent: "center" }]}>
          <ActivityIndicator />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
        <AppProvider>
          <Root />
        </AppProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Root() {
  const { user, session, loading, profileError, reloadProfile, api, run } =
    useApp();
  if (!configured)
    return (
      <Empty
        title="Connect your business community"
        message="The app’s backend isn’t configured in this build. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env, then restart Expo with --clear."
        icon="cloud-offline-outline"
      />
    );
  if (loading)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.ink} />
        <Text style={[s.caption, { marginTop: 15 }]}>
          Opening your account…
        </Text>
      </View>
    );
  if (profileError)
    return (
      <View style={{ padding: 24, flex: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 23, fontWeight: "700" }}>
          We couldn’t load your account
        </Text>
        <QueryState error={profileError} retry={reloadProfile} />
        {session && (
          <Button
            title="Log out"
            outline
            onPress={() => void run(() => logOutWithPush(api), [])}
          />
        )}
      </View>
    );
  if (!user) return <Auth />;
  if (user.onboarding_completed === false) return <Onboarding />;
  return <Shell key={user.id} />;
}
const titles: Record<Route["name"], string> = {
  business: "Business",
  chat: "Messages",
  comments: "Comments",
  post: "Post",
  saved: "Saved posts",
  notifications: "Activity",
  "edit-profile": "Edit profile",
  "edit-business": "Business details",
  products: "Your products",
  analytics: "Dashboard",
};
function Shell() {
  const { api, user } = useApp();
  useEffect(() => {
    if (user) void enablePush(api, user.id, false).catch(() => {});
  }, [api, user?.id]);

  const [tab, setTab] = useState<Tab>("home"),
    [stack, setStack] = useState<Route[]>([]);
  const route = stack.at(-1);
  const navigate: Navigate = (r) => setStack((current) => [...current, r]);
  const back = () => setStack((current) => current.slice(0, -1));
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (stack.length) {
          back();
          return true;
        }
        if (tab !== "home") {
          setTab("home");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [stack.length, tab]);
  const activity = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.notifications(),
    refetchInterval: 30000,
  });
  const inbox = useQuery({
    queryKey: ["chats", user?.id],
    queryFn: () => api.chats(),
    refetchInterval: 15000,
  });
  const unread = inbox.data?.reduce((n, c) => n + (c.unread ?? 0), 0) ?? 0;
  function content() {
    if (route)
      switch (route.name) {
        case "business":
          return <Profile navigate={navigate} businessId={route.id} />;
        case "chat":
          return <Conversation key={route.id} id={route.id} />;
        case "comments":
          return <Comments id={route.id} />;
        case "post":
          return <PostScreen id={route.id} navigate={navigate} />;
        case "saved":
          return <Feed saved navigate={navigate} />;
        case "notifications":
          return <Notifications />;
        case "edit-profile":
          return <EditProfile done={back} />;
        case "edit-business":
          return <EditBusiness done={back} />;
        case "products":
          return <Products />;
        case "analytics":
          return <Analytics />;
      }
    switch (tab) {
      case "home":
        return <Feed navigate={navigate} />;
      case "explore":
        return <Explore navigate={navigate} />;
      case "create":
        return <Create navigate={navigate} published={() => setTab("home")} />;
      case "inbox":
        return <Inbox navigate={navigate} />;
      case "profile":
        return <Profile navigate={navigate} />;
    }
  }
  return (
    <View style={s.screen}>
      <View style={s.header}>
        {route ? (
          <>
            <View style={[s.row, { flex: 1 }]}>
              <IconButton name="chevron-back" label="Go back" onPress={back} />
              <Text style={s.headerTitle} numberOfLines={1}>
                {route.name === "chat" ? route.title : titles[route.name]}
              </Text>
            </View>
            <View style={{ width: 30 }} />
          </>
        ) : (
          <>
            <Text style={tab === "home" ? s.brand : s.headerTitle}>
              {tab === "home"
                ? "Business Partner"
                : tab === "explore"
                  ? "Explore"
                  : tab === "create"
                    ? "New post"
                    : tab === "inbox"
                      ? "Messages"
                      : user?.display_name}
            </Text>
            <View style={[s.row, { gap: 8 }]}>
              <IconButton
                name="heart-outline"
                label="Activity"
                badge={activity.data?.filter((n) => !n.read_at).length}
                onPress={() => navigate({ name: "notifications" })}
              />
              {tab === "home" && (
                <IconButton
                  name="paper-plane-outline"
                  label="Messages"
                  badge={unread}
                  onPress={() => setTab("inbox")}
                />
              )}
            </View>
          </>
        )}
      </View>
      <View style={{ flex: 1 }}>{content()}</View>
      {!route && (
        <View style={s.tabBar}>
          {(
            [
              {
                name: "home",
                icon: "home-outline",
                active: "home",
                label: "Home",
              },
              {
                name: "explore",
                icon: "search-outline",
                active: "search",
                label: "Explore",
              },
              {
                name: "create",
                icon: "add-circle-outline",
                active: "add-circle",
                label: "Create post",
              },
              {
                name: "inbox",
                icon: "chatbubble-outline",
                active: "chatbubble",
                label: "Messages",
              },
              {
                name: "profile",
                icon: "person-outline",
                active: "person",
                label: "Profile",
              },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: tab === item.name }}
              style={s.tab}
              onPress={() => setTab(item.name)}
            >
              {item.name === "profile" ? (
                <View
                  style={{
                    padding: 2,
                    borderWidth: tab === "profile" ? 1.5 : 0,
                    borderColor: colors.ink,
                    borderRadius: 20,
                  }}
                >
                  <Avatar
                    uri={user?.avatar_url}
                    name={user!.display_name}
                    size={26}
                  />
                </View>
              ) : (
                <View>
                  <Icon
                    name={tab === item.name ? item.active : item.icon}
                    size={27}
                  />
                  {item.name === "inbox" && unread > 0 && (
                    <View style={[s.badge, { right: -6, top: -4 }]}>
                      <Text style={s.badgeText}>
                        {unread > 99 ? "99+" : unread}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
