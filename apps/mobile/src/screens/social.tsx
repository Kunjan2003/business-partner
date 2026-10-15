import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  styles as s,
  Avatar,
  IconButton,
  Photo,
  QueryState,
  Empty,
  colors,
} from "../ui";
import { useApp, pickPhoto, type Photo as PickedPhoto } from "../session";
import type { Navigate } from "../navigation";
import type { Chat, Message } from "@bp/core";
import { timeAgo } from "./feed";
import {enablePush} from "../push";
export function Comments({ id }: { id: string }) {
  const { api, user, run } = useApp();
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false);
  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.comments(id),
  });
  async function send() {
    if (busy || !body.trim()) return;
    setBusy(true);
    if (
      await run(
        () => api.comment(id, body),
        ["comments", "feed", "posts", "post"],
      )
    )
      setBody("");
    setBusy(false);
  }
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={105}
    >
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(c) => c.id}
        refreshing={comments.isRefetching}
        onRefresh={() => void comments.refetch()}
        renderItem={({ item: c }) => (
          <View style={[s.listRow, { alignItems: "flex-start" }]}>
            <Avatar
              name={c.profiles.display_name}
              uri={c.profiles.avatar_url}
              size={34}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.body}>
                <Text style={s.bold}>{c.profiles.display_name} </Text>
                {c.body}
              </Text>
              <Text style={[s.caption, { fontSize: 10, marginTop: 5 }]}>
                {timeAgo(c.created_at)}
              </Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <QueryState
            loading={comments.isLoading}
            error={comments.error}
            retry={() => void comments.refetch()}
          />
        }
        ListEmptyComponent={
          !comments.isLoading && !comments.error ? (
            <Empty
              title="Start the conversation"
              message="Leave a comment for the business."
              icon="chatbubble-outline"
            />
          ) : null
        }
      />
      <View
        style={[
          s.row,
          { padding: 13, borderTopWidth: 0.5, borderColor: colors.line },
        ]}
      >
        <Avatar name={user!.display_name} uri={user?.avatar_url} size={33} />
        <TextInput
          accessibilityLabel="Add a comment"
          placeholder="Add a comment…"
          value={body}
          onChangeText={setBody}
          maxLength={1000}
          multiline
          style={{ flex: 1, maxHeight: 110, fontSize: 14 }}
        />
        <IconButton
          name="arrow-up-circle"
          color={colors.blue}
          label="Send comment"
          onPress={() => void send()}
          disabled={busy || !body.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
function other(chat: Chat, userId: string) {
  return chat.customer_id === userId
    ? { name: chat.businesses.name, image: chat.businesses.logo_url }
    : {
        name: chat.customer?.display_name ?? "Customer",
        image: chat.customer?.avatar_url,
      };
}
export function Inbox({ navigate }: { navigate: Navigate }) {
  const { api, user } = useApp();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["chats", user?.id],
    queryFn: () => api.chats(),
    refetchInterval: 10000,
  });
  const rows =
    query.data?.filter((c) =>
      other(c, user!.id).name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <View style={s.screen}>
      <View style={{ padding: 16 }}>
        <TextInput
          accessibilityLabel="Search conversations"
          style={s.input}
          placeholder="Search messages"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        renderItem={({ item: c }) => {
          const person = other(c, user!.id);
          return (
            <Pressable
              style={s.listRow}
              onPress={() =>
                navigate({ name: "chat", id: c.id, title: person.name })
              }
            >
              <Avatar name={person.name} uri={person.image} size={54} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: c.unread ? "700" : "500" }}
                >
                  {person.name}
                </Text>
                <Text style={[s.caption, { marginTop: 4 }]}>
                  {c.unread
                    ? `${c.unread} unread ${c.unread === 1 ? "message" : "messages"}`
                    : c.customer_id === user!.id
                      ? "Business conversation"
                      : `Customer at ${c.businesses.name}`}
                </Text>
              </View>
              {!!c.unread && (
                <View
                  style={{
                    height: 8,
                    width: 8,
                    borderRadius: 4,
                    backgroundColor: colors.blue,
                  }}
                />
              )}
              <IconButton
                name="chevron-forward"
                label="Open conversation"
                onPress={() =>
                  navigate({ name: "chat", id: c.id, title: person.name })
                }
              />
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <QueryState
            loading={query.isLoading}
            error={query.error}
            retry={() => void query.refetch()}
          />
        }
        ListEmptyComponent={
          !query.isLoading && !query.error ? (
            <Empty
              title="Your inbox is ready"
              message="Visit a business and tap Message to ask a question or say hello."
              icon="paper-plane-outline"
            />
          ) : null
        }
      />
    </View>
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
    <Photo
      uri={image.data}
      style={{ height: 200, width: 200, borderRadius: 12 }}
    />
  ) : (
    <QueryState
      loading={image.isLoading}
      error={image.error}
      retry={() => void image.refetch()}
    />
  );
}
export function Conversation({ id }: { id: string }) {
  const { api, user, run } = useApp();
  const cache = useQueryClient();
  const [body, setBody] = useState(""),
    [photo, setPhoto] = useState<PickedPhoto | null>(null),
    [busy, setBusy] = useState(false),
    [picking, setPicking] = useState(false);
  const messages = useInfiniteQuery({
    queryKey: ["messages", id],
    queryFn: ({ pageParam }) => api.messages(id, pageParam),
    initialPageParam: undefined as
      { created_at: string; id: string } | undefined,
    getNextPageParam: (last) =>
      last.length === 50
        ? { created_at: last[0].created_at, id: last[0].id }
        : undefined,
    refetchInterval: 5000,
  });
  useEffect(() => {
    const changes = () => {
      void cache.invalidateQueries({ queryKey: ["messages", id] });
      void cache.invalidateQueries({ queryKey: ["chats"] });
    };
    const unsubscribe = api.subscribeChat(id, changes);
    return unsubscribe;
  }, [api, id, cache]);
  useEffect(() => {
    if (!messages.data || messages.error) return;
    void api
      .markRead(id)
      .then(() => cache.invalidateQueries({ queryKey: ["chats"] }))
      .catch(() => {});
  }, [messages.data?.pages[0]?.at(-1)?.id, api, id, cache]);
  const rows = [
    ...new Map(
      (
        messages.data?.pages.flatMap((page) => page.slice().reverse()) ?? []
      ).map((m) => [m.id, m]),
    ).values(),
  ];
  async function send() {
    if (busy || (!body.trim() && !photo)) return;
    setBusy(true);
    if (
      await run(async () => {
        const image_path = photo
          ? await api.uploadImage(photo.bytes, photo.mime, id)
          : null;
        await api.send({ chat_id: id, body, image_path });
      }, ["messages", "chats", "notifications"])
    ) {
      setBody("");
      setPhoto(null);
    }
    setBusy(false);
  }
  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={105}
    >
      <QueryState
        error={messages.error}
        retry={() => void messages.refetch()}
      />
      <FlatList
        inverted
        data={rows}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 20 }}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage)
            void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.2}
        renderItem={({ item: m }) => {
          const own = m.sender_id === user?.id;
          return (
            <View
              style={{
                alignSelf: own ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: own ? "#3797f0" : "#f0f0f3",
                padding: 12,
                borderRadius: 20,
                marginVertical: 4,
                borderBottomRightRadius: own ? 5 : 20,
                borderBottomLeftRadius: own ? 20 : 5,
              }}
            >
              {m.image_path && <ChatImage path={m.image_path} />}{" "}
              {!!m.body && (
                <Text
                  style={{
                    fontSize: 14,
                    lineHeight: 20,
                    color: own ? "white" : colors.ink,
                  }}
                >
                  {m.body}
                </Text>
              )}
              <Text
                style={{
                  fontSize: 9,
                  color: own ? "#e0eeff" : colors.muted,
                  marginTop: 5,
                  alignSelf: "flex-end",
                }}
              >
                {new Date(m.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          !messages.isLoading && !messages.error ? (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Empty
                title="Say hello"
                message="Your conversation with this business starts here."
                icon="chatbubbles-outline"
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          <QueryState
            loading={messages.isLoading || messages.isFetchingNextPage}
          />
        }
      />
      {photo && (
        <View style={[s.row, { padding: 12 }]}>
          <Photo
            uri={photo.uri}
            style={{ height: 60, width: 60, borderRadius: 8 }}
          />
          <Text style={[s.caption, { flex: 1 }]}>Photo attached</Text>
          <IconButton
            name="close-circle-outline"
            label="Remove attached photo"
            onPress={() => setPhoto(null)}
            disabled={busy}
          />
        </View>
      )}
      <View
        style={[
          s.row,
          {
            padding: 10,
            borderTopWidth: 0.5,
            borderColor: colors.line,
            gap: 7,
          },
        ]}
      >
        <IconButton
          name="image-outline"
          label="Attach photo"
          disabled={busy || picking}
          onPress={() => {
            setPicking(true);
            void run(async () => {
              const selected = await pickPhoto();
              if (selected) setPhoto(selected);
            }, []).finally(() => setPicking(false));
          }}
        />
        <TextInput
          accessibilityLabel="Message"
          editable={!busy}
          placeholder="Message…"
          value={body}
          onChangeText={setBody}
          maxLength={4000}
          multiline
          style={{
            flex: 1,
            backgroundColor: colors.soft,
            borderRadius: 22,
            padding: 12,
            maxHeight: 110,
            fontSize: 14,
          }}
        />
        <IconButton
          name="arrow-up-circle"
          color={colors.blue}
          label={busy ? "Sending message" : "Send message"}
          disabled={busy || (!body.trim() && !photo)}
          onPress={() => void send()}
        />
      </View>
      {busy && (
        <Text
          style={[
            s.caption,
            { textAlign: "right", paddingRight: 15, paddingBottom: 5 },
          ]}
        >
          Sending…
        </Text>
      )}
    </KeyboardAvoidingView>
  );
}
export function Notifications() {
  const { api, user, run } = useApp();
  const [pushMessage,setPushMessage]=useState("");
  const [enabling,setEnabling]=useState(false);
  async function turnOnPush() {
    if (!user || enabling) return;
    setEnabling(true);
    try {
      const ok = await enablePush(api,user.id,true);
      setPushMessage(ok ? "Push notifications enabled on this device." : "Notification permission was not granted.");
    } catch(e) {
      setPushMessage(e instanceof Error ? e.message : "Could not enable push notifications.");
    } finally { setEnabling(false); }
  }
  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.notifications(),
    refetchInterval: 15000,
  });
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(n) => n.id}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      renderItem={({ item: n }) => (
        <Pressable
          style={[
            s.listRow,
            { backgroundColor: n.read_at ? "white" : "#f1f7ff" },
          ]}
          onPress={() =>
            void run(() => api.readNotification(n.id), ["notifications"])
          }
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: colors.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconButton
              name="heart-outline"
              label="Activity"
              onPress={() =>
                void run(() => api.readNotification(n.id), ["notifications"])
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                fontWeight: n.read_at ? "400" : "600",
              }}
            >
              {n.body}
            </Text>
            <Text style={s.caption}>{timeAgo(n.created_at)}</Text>
          </View>
          {!n.read_at && (
            <View
              style={{
                height: 6,
                width: 6,
                borderRadius: 3,
                backgroundColor: colors.blue,
              }}
            />
          )}
        </Pressable>
      )}
      ListHeaderComponent={<>
        <View style={{padding:17,margin:14,borderRadius:13,backgroundColor:"#f6f7f8",gap:9}}>
          <Text style={{fontSize:15,fontWeight:"700",color:colors.ink}}>Never miss an update</Text>
          <Text style={s.caption}>Get alerts for messages, follows, likes, and comments on this phone.</Text>
          <Pressable accessibilityRole="button" onPress={()=>void turnOnPush()} disabled={enabling}
            style={{backgroundColor:colors.ink,borderRadius:9,padding:12,alignItems:"center"}}>
            <Text style={{color:"white",fontWeight:"700"}}>{enabling ? "Setting up…" : "Enable push notifications"}</Text>
          </Pressable>
          {!!pushMessage && <Text accessibilityRole="alert" style={s.caption}>{pushMessage}</Text>}
        </View>
        <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}/>
      </>}
      ListEmptyComponent={
        !query.isLoading && !query.error ? (
          <Empty
            title="You’re all caught up"
            message="New followers, likes, comments and messages will appear here."
            icon="heart-outline"
          />
        ) : null
      }
    />
  );
}
