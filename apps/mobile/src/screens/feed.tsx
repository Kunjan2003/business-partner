import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  Share,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Post } from "@bp/core";
import { useApp } from "../session";
import {
  styles as s,
  Avatar,
  IconButton,
  Photo,
  Button,
  Empty,
  QueryState,
  colors,
} from "../ui";
import type { Navigate } from "../navigation";
export function timeAgo(date: string) {
  const n = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  return n < 60
    ? "Just now"
    : n < 3600
      ? `${Math.floor(n / 60)}m ago`
      : n < 86400
        ? `${Math.floor(n / 3600)}h ago`
        : new Date(date).toLocaleDateString();
}
export function Feed({
  navigate,
  saved = false,
}: {
  navigate: Navigate;
  saved?: boolean;
}) {
  const { api, user } = useApp();
  const [following, setFollowing] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["feed", saved, following, user?.id],
    queryFn: ({ pageParam }) => api.feed(pageParam, following, saved),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
  });
  const shops = useQuery({
    queryKey: ["following-shops", user?.id],
    queryFn: () => api.followedBusinesses(),
  });
  return (
    <FlatList
      data={query.data?.pages.flat() ?? []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} navigate={navigate} />}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage)
          void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <>
          {!saved && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  paddingHorizontal: 16,
                  borderBottomWidth: 0.5,
                  borderColor: colors.line,
                }}
              >
                {["For you", "Following"].map((name, i) => (
                  <Pressable
                    key={name}
                    onPress={() => setFollowing(i === 1)}
                    style={{
                      marginRight: 25,
                      paddingVertical: 12,
                      borderBottomWidth: following === (i === 1) ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: following === (i === 1) ? "700" : "400",
                        color:
                          following === (i === 1) ? colors.ink : colors.muted,
                      }}
                    >
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!!shops.data?.length && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ padding: 16, gap: 20 }}
                >
                  {shops.data.map(({ businesses: b }) => (
                    <Pressable
                      key={b.id}
                      onPress={() => navigate({ name: "business", id: b.id })}
                      style={{ alignItems: "center", width: 65 }}
                    >
                      <Avatar name={b.name} uri={b.logo_url} size={60} />
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 11, marginTop: 7 }}
                      >
                        {b.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </>
          )}
          <QueryState
            loading={query.isLoading}
            error={query.error}
            retry={() => void query.refetch()}
          />
        </>
      }
      ListEmptyComponent={
        !query.isLoading && !query.error ? (
          <Empty
            title={saved ? "Save what inspires you" : "Your feed starts here"}
            message={
              saved
                ? "Tap the bookmark on a post to keep it here."
                : following
                  ? "Follow businesses from Explore to see their latest updates."
                  : "Local business posts will appear here. Find a shop in Explore or share your first post."
            }
            icon={saved ? "bookmark-outline" : "images-outline"}
          />
        ) : null
      }
      ListFooterComponent={<QueryState loading={query.isFetchingNextPage} />}
    />
  );
}
export function PostCard({
  post,
  navigate,
}: {
  post: Post;
  navigate: Navigate;
}) {
  const { api, user, run } = useApp();
  const [busy, setBusy] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState(""),
    [expanded, setExpanded] = useState(false);
  const lastTap = useRef(0);
  const liked = post.likes.some((l) => l.user_id === user?.id);
  const saved = useQuery({
    queryKey: ["saved", post.id, user?.id],
    queryFn: () => api.saved(post.id),
  });
  async function toggle(table: "likes" | "saves", active: boolean) {
    if (busy) return;
    setBusy(true);
    await run(
      () => api.toggle(table, post.id, active),
      ["feed", "posts", "post", "saved", "stats"],
    );
    setBusy(false);
  }
  function menu() {
    const owned = user?.id === post.businesses.owner_id;
    Alert.alert(post.businesses.name, "Post options", [
      { text: "Cancel", style: "cancel" },
      ...(owned
        ? [
            {
              text: "Delete post",
              style: "destructive" as const,
              onPress: () =>
                Alert.alert(
                  "Delete this post?",
                  "This removes the post and its comments.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void run(
                          () => api.deletePost(post.id),
                          ["feed", "posts", "post", "stats"],
                        ),
                    },
                  ],
                ),
            },
          ]
        : [{ text: "Report post", onPress: () => setReport(true) }]),
    ]);
  }
  return (
    <View
      style={{
        borderBottomWidth: 0.5,
        borderColor: colors.line,
        paddingBottom: 14,
      }}
    >
      <View style={[s.listRow, { justifyContent: "space-between" }]}>
        <Pressable
          style={s.row}
          onPress={() => navigate({ name: "business", id: post.business_id })}
        >
          <Avatar
            uri={post.businesses.logo_url}
            name={post.businesses.name}
            size={35}
          />
          <View>
            <Text style={[s.bold, { fontSize: 13 }]}>
              {post.businesses.name}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
              {post.businesses.category}
            </Text>
          </View>
        </Pressable>
        <IconButton
          name="ellipsis-horizontal"
          label="Post options"
          onPress={menu}
        />
      </View>
      {!!post.image_url && (
        <Pressable
          accessibilityLabel="Double tap to like photo"
          onPress={() => {
            const now = Date.now();
            if (now - lastTap.current < 300 && !liked)
              void toggle("likes", false);
            lastTap.current = now;
          }}
        >
          <Photo uri={post.image_url} />
        </Pressable>
      )}
      <View style={{ paddingHorizontal: 12, paddingTop: 7 }}>
        <View style={[s.row, { gap: 4 }]}>
          <IconButton
            name={liked ? "heart" : "heart-outline"}
            color={liked ? "#ed4956" : colors.ink}
            label={liked ? "Unlike post" : "Like post"}
            onPress={() => void toggle("likes", liked)}
            disabled={busy}
          />
          <IconButton
            name="chatbubble-outline"
            label="Comments"
            onPress={() => navigate({ name: "comments", id: post.id })}
          />
          <IconButton
            name="paper-plane-outline"
            label="Share post"
            onPress={() =>
              void run(
                () =>
                  Share.share({
                    message: `${post.businesses.name}: ${post.caption}${process.env.EXPO_PUBLIC_WEB_URL ? "\n" + process.env.EXPO_PUBLIC_WEB_URL + "/?business=" + post.business_id : ""}`,
                  }),
                [],
              )
            }
          />
          <View style={{ flex: 1 }} />
          <IconButton
            name={saved.data ? "bookmark" : "bookmark-outline"}
            label={saved.data ? "Remove saved post" : "Save post"}
            onPress={() => void toggle("saves", !!saved.data)}
            disabled={busy || saved.isLoading}
          />
        </View>
        <Text style={[s.bold, { fontSize: 13, marginTop: 5 }]}>
          {post.likes.length} {post.likes.length === 1 ? "like" : "likes"}
        </Text>
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text
            style={[s.body, { fontSize: 13, marginTop: 5 }]}
            numberOfLines={expanded ? undefined : 3}
          >
            <Text style={s.bold}>{post.businesses.name} </Text>
            {post.caption}
          </Text>
        </Pressable>
        {post.kind !== "post" && (
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: colors.blue,
              marginTop: 6,
            }}
          >
            {post.kind === "offer" ? "Special offer" : "Product highlight"}
          </Text>
        )}
        <Pressable onPress={() => navigate({ name: "comments", id: post.id })}>
          <Text style={[s.caption, { marginTop: 6 }]}>
            {post.comments.length
              ? `View all ${post.comments.length} comments`
              : "Add a comment…"}
          </Text>
        </Pressable>
        <Text style={{ fontSize: 10, color: colors.muted, marginTop: 7 }}>
          {timeAgo(post.created_at)}
        </Text>
      </View>
      <Modal
        visible={report}
        animationType="slide"
        transparent
        onRequestClose={() => setReport(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#0006",
          }}
        >
          <View
            style={{
              padding: 24,
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 15 }}>
              Report this post
            </Text>
            <TextInput
              style={[s.input, { height: 100 }]}
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Tell us what’s wrong"
              maxLength={1000}
            />
            <Button
              title="Send report"
              onPress={() =>
                void run(async () => {
                  await api.report("post", post.id, reason);
                  setReport(false);
                  setReason("");
                }, [])
              }
            />
            <Button title="Cancel" outline onPress={() => setReport(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
export function PostScreen({
  id,
  navigate,
}: {
  id: string;
  navigate: Navigate;
}) {
  const { api } = useApp();
  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => api.post(id),
  });
  return (
    <ScrollView>
      <QueryState
        loading={post.isLoading}
        error={post.error}
        retry={() => void post.refetch()}
      />
      {post.data && <PostCard post={post.data} navigate={navigate} />}
    </ScrollView>
  );
}
