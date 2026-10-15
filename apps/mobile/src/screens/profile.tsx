import { logOutWithPush } from "../push";
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  Switch,
  FlatList,
  Linking,
} from "react-native";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  categories,
  directionsUrl,
  type Business,
  type BusinessInput,
  type Product,
} from "@bp/core";
import {
  styles as s,
  Avatar,
  Button,
  Icon,
  IconButton,
  Photo,
  Field,
  Chips,
  Empty,
  QueryState,
  colors,
} from "../ui";
import { useApp, pickPhoto, type Photo as PickedPhoto } from "../session";
import type { Navigate } from "../navigation";
export function Profile({
  navigate,
  businessId,
}: {
  navigate: Navigate;
  businessId?: string;
}) {
  const { api, user, run } = useApp();
  const mine = !businessId;
  const [tab, setTab] = useState("Posts"),
    [menu, setMenu] = useState(false),
    [reviewing, setReviewing] = useState(false),
    [rating, setRating] = useState("5"),
    [review, setReview] = useState(""),
    [busy, setBusy] = useState(false);
  const business = useQuery({
    queryKey: mine ? ["my-business", user?.id] : ["business", businessId],
    queryFn: () => (businessId ? api.business(businessId) : api.myBusiness()),
  });
  const b = business.data;
  const own = b?.owner_id === user?.id;
  const stats = useQuery({
    queryKey: ["stats", b?.id],
    queryFn: () => api.businessStats(b!.id),
    enabled: !!b,
  });
  const following = useQuery({
    queryKey: ["following", b?.id, user?.id],
    queryFn: () => api.following(b!.id),
    enabled: !!b && !own,
  });
  const posts = useInfiniteQuery({
    queryKey: ["posts", b?.id],
    queryFn: ({ pageParam }) => api.businessPosts(b!.id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === 12 ? pages.length * 12 : undefined,
    enabled: !!b,
  });
  const products = useQuery({
    queryKey: ["products", b?.id],
    queryFn: () => api.products(b!.id),
    enabled: !!b,
  });
  const reviews = useQuery({
    queryKey: ["reviews", b?.id],
    queryFn: () => api.reviews(b!.id),
    enabled: !!b,
  });
  async function follow() {
    if (busy || !b) return;
    setBusy(true);
    await run(
      () => api.toggle("follows", b.id, !!following.data),
      ["following", "following-shops", "stats", "feed"],
    );
    setBusy(false);
  }
  return (
    <ScrollView>
      <QueryState
        loading={business.isLoading}
        error={business.error}
        retry={() => void business.refetch()}
      />
      {!business.error && !business.isLoading && (
        <>
          <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Avatar
                uri={b?.logo_url || user?.avatar_url}
                name={b?.name || user?.display_name || "Business"}
                size={84}
              />
              {b ? (
                <View style={{ flex: 1, flexDirection: "row", marginLeft: 18 }}>
                  {[
                    ["posts", "Posts"],
                    ["followers", "Followers"],
                    ["products", "Products"],
                  ].map(([key, label]) => (
                    <View key={key} style={s.stat}>
                      <Text style={s.statNumber}>
                        {stats.data?.[
                          key as "posts" | "followers" | "products"
                        ] ?? "—"}
                      </Text>
                      <Text style={s.statLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ flex: 1, marginLeft: 20 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700" }}>
                    {user?.display_name}
                  </Text>
                  <Text style={s.caption}>
                    {user?.role === "owner"
                      ? "Business owner"
                      : "Customer account"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[s.bold, { marginTop: 16, fontSize: 14 }]}>
              {b?.name || user?.display_name}
            </Text>
            {b && (
              <>
                <Text style={[s.caption, { marginTop: 4 }]}>
                  {b.category} · ★ {Number(stats.data?.rating ?? 0).toFixed(1)}
                </Text>
                <Text style={[s.body, { marginTop: 6 }]}>{b.description}</Text>
                <Pressable
                  onPress={() =>
                    void run(
                      () =>
                        Linking.openURL(directionsUrl(b.latitude, b.longitude)),
                      [],
                    )
                  }
                >
                  <Text
                    style={{ color: colors.blue, fontSize: 13, marginTop: 7 }}
                  >
                    {b.address}
                  </Text>
                </Pressable>
                {!!b.hours && (
                  <Text style={[s.caption, { marginTop: 4 }]}>{b.hours}</Text>
                )}
                {!!b.contact && <Text style={s.caption}>{b.contact}</Text>}
              </>
            )}
            <QueryState
              error={stats.error}
              retry={() => void stats.refetch()}
            />
            <View style={[s.row, { gap: 8, marginTop: 16 }]}>
              {mine || own ? (
                <>
                  <Button
                    title="Edit profile"
                    outline
                    style={{ flex: 1 }}
                    onPress={() => navigate({ name: "edit-profile" })}
                  />
                  <Button
                    title={
                      b
                        ? "Edit business"
                        : user?.role === "owner"
                          ? "Add business"
                          : "Saved posts"
                    }
                    outline
                    style={{ flex: 1 }}
                    onPress={() =>
                      navigate({
                        name:
                          b || user?.role === "owner"
                            ? "edit-business"
                            : "saved",
                      })
                    }
                  />
                  <IconButton
                    name="menu-outline"
                    label="Profile menu"
                    onPress={() => setMenu(true)}
                  />
                </>
              ) : (
                <>
                  <Button
                    title={following.data ? "Following" : "Follow"}
                    outline={!!following.data}
                    busy={busy}
                    style={{ flex: 1 }}
                    onPress={() => void follow()}
                  />
                  <Button
                    title="Message"
                    outline
                    style={{ flex: 1 }}
                    onPress={() =>
                      void run(
                        async () =>
                          navigate({
                            name: "chat",
                            id: await api.startChat(b!.id),
                            title: b!.name,
                          }),
                        ["chats"],
                      )
                    }
                  />
                  <IconButton
                    name="ellipsis-horizontal"
                    label="Business options"
                    onPress={() =>
                      Alert.alert(
                        b?.name ?? "Business",
                        "Manage this business",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Report",
                            onPress: () =>
                              void run(
                                () =>
                                  api.report(
                                    "business",
                                    b!.id,
                                    "Business information or content appears inappropriate",
                                  ),
                                [],
                              ),
                          },
                          {
                            text: "Block owner",
                            style: "destructive",
                            onPress: () =>
                              Alert.alert(
                                "Block owner?",
                                "This hides their business and disables messaging.",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Block",
                                    style: "destructive",
                                    onPress: () =>
                                      void run(() => api.block(b!.owner_id)),
                                  },
                                ],
                              ),
                          },
                        ],
                      )
                    }
                  />
                </>
              )}
            </View>
            {own && (
              <Button
                title="Manage products"
                outline
                onPress={() => navigate({ name: "products" })}
              />
            )}
          </View>
          {b ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  marginTop: 20,
                  borderTopWidth: 0.5,
                  borderBottomWidth: 0.5,
                  borderColor: colors.line,
                }}
              >
                {["Posts", "Products", "Reviews"].map((t, i) => (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      padding: 13,
                      borderBottomWidth: tab === t ? 1.5 : 0,
                    }}
                  >
                    <Icon
                      name={
                        ["grid-outline", "bag-outline", "star-outline"][
                          i
                        ] as "grid-outline"
                      }
                      color={tab === t ? colors.ink : colors.muted}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.muted,
                        marginTop: 3,
                      }}
                    >
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {tab === "Posts" ? (
                <>
                  <QueryState
                    loading={posts.isLoading}
                    error={posts.error}
                    retry={() => void posts.refetch()}
                  />
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}
                  >
                    {posts.data?.pages.flat().map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => navigate({ name: "post", id: p.id })}
                        style={{
                          width: "33%",
                          aspectRatio: 1,
                          backgroundColor: colors.soft,
                        }}
                      >
                        {p.image_url ? (
                          <Photo uri={p.image_url} />
                        ) : (
                          <View
                            style={{
                              padding: 10,
                              justifyContent: "center",
                              flex: 1,
                            }}
                          >
                            <Text numberOfLines={4} style={{ fontSize: 11 }}>
                              {p.caption}
                            </Text>
                          </View>
                        )}
                        {p.kind === "offer" && (
                          <View
                            style={{ position: "absolute", right: 4, top: 4 }}
                          >
                            <Icon name="pricetag" size={16} color="white" />
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                  {posts.data?.pages[0]?.length === 0 && (
                    <Empty
                      title="No posts yet"
                      message="Photos, updates and offers will appear here."
                    />
                  )}
                  {posts.hasNextPage && (
                    <Button
                      title="Load more posts"
                      outline
                      busy={posts.isFetchingNextPage}
                      onPress={() => void posts.fetchNextPage()}
                    />
                  )}
                </>
              ) : tab === "Products" ? (
                <>
                  <QueryState
                    loading={products.isLoading}
                    error={products.error}
                    retry={() => void products.refetch()}
                  />
                  {products.data?.map((p) => (
                    <View style={s.listRow} key={p.id}>
                      {p.image_url ? (
                        <Photo
                          uri={p.image_url}
                          style={{ height: 84, width: 84, borderRadius: 9 }}
                        />
                      ) : (
                        <View
                          style={{
                            height: 84,
                            width: 84,
                            backgroundColor: colors.soft,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 9,
                          }}
                        >
                          <Icon name="bag-outline" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.bold}>{p.name}</Text>
                        <Text numberOfLines={2} style={s.caption}>
                          {p.description}
                        </Text>
                        <Text style={[s.bold, { marginTop: 6 }]}>
                          ₹{Number(p.price).toLocaleString("en-IN")}
                        </Text>
                        <Text
                          style={[
                            s.caption,
                            { color: p.available ? colors.muted : "#b84a4a" },
                          ]}
                        >
                          {p.available ? "Available" : "Out of stock"}
                        </Text>
                        {!own && (
                          <Pressable
                            onPress={() =>
                              void run(
                                async () =>
                                  navigate({
                                    name: "chat",
                                    id: await api.startChat(b.id),
                                    title: b.name,
                                  }),
                                ["chats"],
                              )
                            }
                          >
                            <Text
                              style={{
                                color: colors.blue,
                                fontSize: 12,
                                fontWeight: "600",
                                marginTop: 8,
                              }}
                            >
                              Ask about this product
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                  {products.data?.length === 0 && (
                    <Empty
                      title="Catalog coming soon"
                      message="Message the business to ask what’s available."
                      icon="bag-outline"
                    />
                  )}
                </>
              ) : (
                <View style={{ padding: 18 }}>
                  <QueryState
                    loading={reviews.isLoading}
                    error={reviews.error}
                    retry={() => void reviews.refetch()}
                  />
                  {!own && (
                    <Button
                      title="Write a review"
                      outline
                      onPress={() => setReviewing(true)}
                    />
                  )}{" "}
                  {reviews.data?.map((r) => (
                    <View
                      key={r.id}
                      style={{
                        paddingVertical: 16,
                        borderBottomWidth: 0.5,
                        borderColor: colors.line,
                      }}
                    >
                      <Text style={s.bold}>{r.profiles.display_name}</Text>
                      <Text style={{ color: "#e7a42c", marginTop: 6 }}>
                        {"★".repeat(r.rating)}
                      </Text>
                      <Text style={[s.body, { marginTop: 5 }]}>{r.body}</Text>
                    </View>
                  ))}
                  {reviews.data?.length === 0 && (
                    <Empty
                      title="Be the first to review"
                      message="Help your neighbors discover this business."
                      icon="star-outline"
                    />
                  )}
                </View>
              )}
            </>
          ) : (
            <Empty
              title={
                user?.role === "owner"
                  ? "Set up your business"
                  : "Your local world"
              }
              message={
                user?.role === "owner"
                  ? "Add your business profile to publish posts, list products and receive messages."
                  : "Follow shops, save posts and chat with local businesses. Your favorites are in Saved posts."
              }
              icon={
                user?.role === "owner" ? "storefront-outline" : "person-outline"
              }
              action={
                user?.role === "owner"
                  ? {
                      label: "Create business profile",
                      onPress: () => navigate({ name: "edit-business" }),
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
      <Modal
        visible={menu}
        transparent
        animationType="slide"
        onRequestClose={() => setMenu(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "#0005",
            justifyContent: "flex-end",
          }}
          onPress={() => setMenu(false)}
        >
          <View
            style={{
              backgroundColor: "white",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 25,
            }}
          >
            {[
              ["bookmark-outline", "Saved posts", "saved"],
              ["notifications-outline", "Activity", "notifications"],
              ...(user?.role === "owner"
                ? [
                    ["bag-outline", "Manage products", "products"],
                    ["bar-chart-outline", "Business dashboard", "analytics"],
                  ]
                : []),
            ].map(([icon, label, route]) => (
              <Pressable
                key={route}
                style={s.menuRow}
                onPress={() => {
                  setMenu(false);
                  navigate({ name: route } as Parameters<Navigate>[0]);
                }}
              >
                <Icon name={icon as "bookmark-outline"} />
                <Text style={s.body}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={s.menuRow}
              onPress={() =>
                Alert.alert("Log out?", "You can log in again at any time.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Log out",
                    onPress: () => void run(() => logOutWithPush(api), []),
                  },
                ])
              }
            >
              <Icon name="log-out-outline" />
              <Text style={s.body}>Log out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={reviewing}
        animationType="slide"
        onRequestClose={() => setReviewing(false)}
      >
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 50 }}>
          <Text style={{ fontWeight: "700", fontSize: 22, marginBottom: 20 }}>
            Your review
          </Text>
          <Chips
            values={["1", "2", "3", "4", "5"]}
            value={rating}
            onChange={setRating}
          />
          <Field
            label="Tell others about your experience"
            multiline
            value={review}
            onChangeText={setReview}
            maxLength={2000}
          />
          <Button
            title="Save review"
            busy={busy}
            onPress={() => {
              if (busy) return;
              setBusy(true);
              void run(async () => {
                await api.review(b!.id, Number(rating), review);
                setReviewing(false);
              }, ["reviews", "stats", "search"]).finally(() => setBusy(false));
            }}
          />
          <Button title="Cancel" outline onPress={() => setReviewing(false)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}
export function EditProfile({ done }: { done: () => void }) {
  const { api, user, run } = useApp();
  const [name, setName] = useState(user?.display_name ?? ""),
    [role, setRole] = useState(user?.role ?? "customer"),
    [photo, setPhoto] = useState<PickedPhoto | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 22 }}
    >
      <Pressable
        onPress={() => void run(async () => setPhoto(await pickPhoto()), [])}
        style={{ alignItems: "center", marginBottom: 26 }}
      >
        <Avatar name={name} uri={photo?.uri ?? user?.avatar_url} size={88} />
        <Text style={{ color: colors.blue, fontWeight: "600", marginTop: 13 }}>
          Change profile photo
        </Text>
      </Pressable>
      <Field label="Name" value={name} onChangeText={setName} maxLength={100} />
      <Text style={s.label}>Account type</Text>
      <Chips
        values={["customer", "owner"]}
        value={role}
        onChange={(v) => setRole(v as typeof role)}
      />
      <Text style={[s.caption, { marginVertical: 15 }]}>
        Business owners can add a shop, publish updates and manage products.
      </Text>
      <Button
        title="Save changes"
        busy={busy}
        onPress={() => {
          if (busy) return;
          setBusy(true);
          void run(async () => {
            const url = photo
              ? await api.uploadImage(photo.bytes, photo.mime)
              : undefined;
            await api.updateProfile(name, role, url);
          }, ["profile"]).then((ok) => {
            setBusy(false);
            if (ok) done();
          });
        }}
      />
    </ScrollView>
  );
}
export function EditBusiness({ done }: { done: () => void }) {
  const { api, user } = useApp();
  const business = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
  });
  if (business.isLoading || business.error)
    return (
      <QueryState
        loading={business.isLoading}
        error={business.error}
        retry={() => void business.refetch()}
      />
    );
  if (user?.role !== "owner")
    return (
      <Empty
        title="Switch to a business account"
        message="Choose Business owner in Edit profile first."
        icon="storefront-outline"
      />
    );
  return (
    <BusinessForm
      key={business.data?.id ?? "new"}
      business={business.data ?? undefined}
      done={done}
    />
  );
}
function BusinessForm({
  business,
  done,
}: {
  business?: Business;
  done: () => void;
}) {
  const { api, run } = useApp();
  const [data, setData] = useState({
      name: business?.name ?? "",
      category: business?.category ?? categories[0],
      description: business?.description ?? "",
      address: business?.address ?? "",
      contact: business?.contact ?? "",
      hours: business?.hours ?? "",
      latitude: business?.latitude.toString() ?? "",
      longitude: business?.longitude.toString() ?? "",
    }),
    [photo, setPhoto] = useState<PickedPhoto | null>(null),
    [busy, setBusy] = useState(false);
  const field = (key: keyof typeof data, label: string, numeric = false) => (
    <Field
      label={label}
      value={data[key]}
      onChangeText={(v) => setData({ ...data, [key]: v })}
      keyboardType={numeric ? "numbers-and-punctuation" : "default"}
      maxLength={key === "description" ? 2000 : 300}
    />
  );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 22 }}
    >
      <Pressable
        style={{ alignItems: "center", marginBottom: 25 }}
        onPress={() => void run(async () => setPhoto(await pickPhoto()), [])}
      >
        <Avatar
          name={data.name}
          uri={photo?.uri ?? business?.logo_url}
          size={84}
        />
        <Text style={{ color: colors.blue, fontWeight: "600", marginTop: 12 }}>
          Change business logo
        </Text>
      </Pressable>
      {field("name", "Business name")}
      <Text style={s.label}>Category</Text>
      <Chips
        values={categories}
        value={data.category}
        onChange={(category) => setData({ ...data, category })}
      />
      {field("description", "About your business")}
      {field("address", "Shop address")}
      {field("contact", "Contact number or email")}
      {field("hours", "Opening hours")}
      <Text style={[s.bold, { marginVertical: 15 }]}>Shop location</Text>
      <Button
        title="Use my current location"
        outline
        onPress={() =>
          void run(async () => {
            const Location = await import("expo-location");
            const permission =
              await Location.requestForegroundPermissionsAsync();
            if (permission.status !== "granted")
              throw new Error(
                "Allow location access or enter coordinates below.",
              );
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            setData({
              ...data,
              latitude: String(loc.coords.latitude),
              longitude: String(loc.coords.longitude),
            });
          }, [])
        }
      />
      <Text style={[s.caption, { marginVertical: 10 }]}>
        Use this while at your shop, or enter its Google Maps coordinates.
      </Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}>{field("latitude", "Latitude", true)}</View>
        <View style={{ flex: 1 }}>{field("longitude", "Longitude", true)}</View>
      </View>
      <Button
        title="Save business"
        busy={busy}
        onPress={() => {
          if (busy) return;
          setBusy(true);
          void run(async () => {
            if (!data.latitude.trim() || !data.longitude.trim())
              throw new Error("Set your shop location before saving.");
            const logo_url = photo
              ? await api.uploadImage(photo.bytes, photo.mime)
              : (business?.logo_url ?? "");
            await api.saveBusiness(
              {
                ...data,
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                logo_url,
              } as BusinessInput,
              business?.id,
            );
          }, [
            "my-business",
            "business",
            "stats",
            "following-shops",
            "search",
          ]).then((ok) => {
            setBusy(false);
            if (ok) done();
          });
        }}
      />
    </ScrollView>
  );
}
export function Products() {
  const { api, user } = useApp();
  const business = useQuery({
    queryKey: ["my-business", user?.id],
    queryFn: () => api.myBusiness(),
  });
  if (business.isLoading || business.error)
    return (
      <QueryState
        loading={business.isLoading}
        error={business.error}
        retry={() => void business.refetch()}
      />
    );
  if (!business.data)
    return (
      <Empty
        title="Create your business first"
        message="Add your shop profile before listing products."
        icon="storefront-outline"
      />
    );
  return <ProductManager business={business.data} />;
}
function ProductManager({ business }: { business: Business }) {
  const { api, run } = useApp();
  const products = useQuery({
    queryKey: ["products", business.id],
    queryFn: () => api.products(business.id),
  });
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  return (
    <View style={s.screen}>
      <View style={{ padding: 16 }}>
        <Button title="Add product" onPress={() => setEditing(null)} />
      </View>
      <FlatList
        data={products.data ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item: p }) => (
          <View style={s.listRow}>
            {p.image_url && (
              <Photo
                uri={p.image_url}
                style={{ width: 65, height: 65, borderRadius: 8 }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.bold}>{p.name}</Text>
              <Text style={s.caption}>
                ₹{p.price} · {p.available ? "Available" : "Out of stock"}
              </Text>
            </View>
            <IconButton
              name="create-outline"
              label="Edit product"
              onPress={() => setEditing(p)}
            />
            <IconButton
              name="trash-outline"
              label="Delete product"
              onPress={() =>
                Alert.alert("Delete product?", p.name, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      void run(
                        () => api.deleteProduct(p.id),
                        ["products", "search", "stats"],
                      ),
                  },
                ])
              }
            />
          </View>
        )}
        ListHeaderComponent={
          <QueryState
            loading={products.isLoading}
            error={products.error}
            retry={() => void products.refetch()}
          />
        }
        ListEmptyComponent={
          !products.isLoading && !products.error ? (
            <Empty
              title="Build your catalog"
              message="Add a photo, price and details for each product."
              icon="bag-outline"
            />
          ) : null
        }
      />
      <Modal
        visible={editing !== undefined}
        animationType="slide"
        onRequestClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <ProductForm
            key={editing?.id ?? "new"}
            business={business}
            product={editing ?? undefined}
            done={() => setEditing(undefined)}
          />
        )}
      </Modal>
    </View>
  );
}
function ProductForm({
  business,
  product,
  done,
}: {
  business: Business;
  product?: Product;
  done: () => void;
}) {
  const { api, run } = useApp();
  const [name, setName] = useState(product?.name ?? ""),
    [description, setDescription] = useState(product?.description ?? ""),
    [price, setPrice] = useState(product?.price.toString() ?? ""),
    [category, setCategory] = useState(product?.category ?? business.category),
    [available, setAvailable] = useState(product?.available ?? true),
    [photo, setPhoto] = useState<PickedPhoto | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <ScrollView
      contentContainerStyle={{ padding: 22, paddingTop: 50 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[s.row, { justifyContent: "space-between", marginBottom: 20 }]}
      >
        <Text style={{ fontSize: 22, fontWeight: "700" }}>
          {product ? "Edit product" : "New product"}
        </Text>
        <IconButton name="close" label="Cancel" onPress={done} />
      </View>
      <Pressable
        onPress={() => void run(async () => setPhoto(await pickPhoto()), [])}
      >
        {photo || product?.image_url ? (
          <Photo
            uri={photo?.uri ?? product!.image_url}
            style={{
              height: 200,
              width: 200,
              alignSelf: "center",
              borderRadius: 12,
              marginBottom: 20,
            }}
          />
        ) : (
          <View
            style={{
              height: 150,
              backgroundColor: colors.soft,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Icon name="image-outline" size={35} />
            <Text style={s.caption}>Add product photo</Text>
          </View>
        )}
      </Pressable>
      <Field
        label="Product name"
        value={name}
        onChangeText={setName}
        maxLength={120}
      />
      <Field
        label="Price (₹)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Text style={s.label}>Category</Text>
      <Chips values={categories} value={category} onChange={setCategory} />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />
      <View
        style={[s.row, { justifyContent: "space-between", marginVertical: 15 }]}
      >
        <Text style={s.body}>Available for purchase</Text>
        <Switch value={available} onValueChange={setAvailable} />
      </View>
      <Button
        title="Save product"
        busy={busy}
        onPress={() => {
          if (busy) return;
          setBusy(true);
          void run(async () => {
            if (!price.trim()) throw new Error("Enter a price.");
            const image_url = photo
              ? await api.uploadImage(photo.bytes, photo.mime)
              : (product?.image_url ?? "");
            await api.saveProduct(
              {
                business_id: business.id,
                name,
                description,
                price: Number(price),
                category,
                available,
                image_url,
              },
              product?.id,
            );
          }, ["products", "stats", "search"]).then((ok) => {
            setBusy(false);
            if (ok) done();
          });
        }}
      />
    </ScrollView>
  );
}
export function Analytics() {
  const { api, user } = useApp();
  const query = useQuery({
    queryKey: ["analytics", user?.id],
    queryFn: () => api.analytics(),
  });
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 10 }}>
        Your business activity
      </Text>
      <Text style={s.caption}>
        See the connections your business is making.
      </Text>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        retry={() => void query.refetch()}
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 25,
        }}
      >
        {Object.entries(query.data?.[0] ?? {}).map(([key, value]) => (
          <View
            key={key}
            style={{
              width: "47%",
              padding: 22,
              borderRadius: 14,
              backgroundColor: colors.soft,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 32 }}>{value}</Text>
            <Text style={[s.caption, { textTransform: "capitalize" }]}>
              {key.replace("_", " ")}
            </Text>
          </View>
        ))}
      </View>
      {query.data?.length === 0 && (
        <Empty
          title="No business yet"
          message="Create a business profile to start tracking activity."
          icon="bar-chart-outline"
        />
      )}
    </ScrollView>
  );
}
