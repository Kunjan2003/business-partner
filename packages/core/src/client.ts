import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import {
  businessSchema,
  credentialsSchema,
  postSchema,
  productSchema,
  messageSchema,
  searchSchema,
  roleSchema,
  type BusinessInput,
  type ProductInput,
  type SearchInput,
} from "./schema";
import type {
  Profile,
  Business,
  Post,
  Product,
  SearchResult,
  Chat,
  Message,
  Notification,
} from "./types";
export function makeClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">,
) {
  return createClient(url, key, options);
}
export function createApi(
  db: SupabaseClient,
  randomId: () => string = () => crypto.randomUUID(),
) {
  async function uid() {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Please sign in first");
    return data.user.id;
  }
  async function result<T>(
    request: PromiseLike<{ data: unknown; error: unknown }>,
  ): Promise<T> {
    const { data, error } = await request;
    if (error) throw error;
    return data as T;
  }
  return {
    db,
    async signUp(
      email: string,
      password: string,
      display_name: string,
      role: "owner" | "customer",
      redirectTo: string,
    ) {
      credentialsSchema.parse({ email, password });
      roleSchema.parse(role);
      if (!display_name.trim()) throw new Error("Name is required");
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: display_name.trim().slice(0, 100), role },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      return data;
    },
    async signIn(email: string, password: string) {
      credentialsSchema.parse({ email, password });
      return result(db.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      const { error } = await db.auth.signOut();
      if (error) throw error;
    },
    async phoneOtp(phone: string) {
      if (!/^\+[1-9]\d{7,14}$/.test(phone))
        throw new Error("Use international format, e.g. +919876543210");
      return result(db.auth.signInWithOtp({ phone }));
    },
    async verifyOtp(phone: string, token: string) {
      return result(db.auth.verifyOtp({ phone, token, type: "sms" }));
    },
    async profile() {
      return result<Profile>(
        db
          .from("profiles")
          .select("*")
          .eq("id", await uid())
          .single(),
      );
    },
    async updateProfile(display_name: string, role: "owner" | "customer") {
      roleSchema.parse(role);
      if (!display_name.trim() || display_name.length > 100)
        throw new Error("Name must be 1–100 characters");
      return result(
        db
          .from("profiles")
          .update({ display_name: display_name.trim(), role })
          .eq("id", await uid()),
      );
    },
    business(id: string) {
      return result<Business>(
        db.from("businesses").select("*").eq("id", id).single(),
      );
    },
    async myBusiness() {
      return result<Business | null>(
        db
          .from("businesses")
          .select("*")
          .eq("owner_id", await uid())
          .maybeSingle(),
      );
    },
    async saveBusiness(input: BusinessInput, id?: string) {
      const value = businessSchema.parse(input);
      return result<Business>(
        id
          ? db.from("businesses").update(value).eq("id", id).select().single()
          : db
              .from("businesses")
              .insert({ ...value, owner_id: await uid() })
              .select()
              .single(),
      );
    },
    async feed(offset = 0, following = false, saved = false) {
      let q = db
        .from("posts")
        .select("*,businesses!inner(*),likes(user_id),comments(id)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + 11);
      if (following) {
        const rows = await result<{ business_id: string }[]>(
          db
            .from("follows")
            .select("business_id")
            .eq("user_id", await uid()),
        );
        q = q.in(
          "business_id",
          rows.map((r) => r.business_id),
        );
      }
      if (saved) {
        const rows = await result<{ post_id: string }[]>(
          db
            .from("saves")
            .select("post_id")
            .eq("user_id", await uid()),
        );
        q = q.in(
          "id",
          rows.map((r) => r.post_id),
        );
      }
      return result<Post[]>(q);
    },
    async createPost(input: unknown) {
      return result(db.from("posts").insert(postSchema.parse(input)));
    },
    deletePost(id: string) {
      return result(db.from("posts").delete().eq("id", id));
    },
    products(id: string) {
      return result<Product[]>(
        db
          .from("products")
          .select("*")
          .eq("business_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
      );
    },
    saveProduct(input: ProductInput, id?: string) {
      const value = productSchema.parse(input);
      const { business_id, ...editable } = value;
      return result(
        id
          ? db.from("products").update(editable).eq("id", id)
          : db.from("products").insert(value),
      );
    },
    deleteProduct(id: string) {
      return result(db.from("products").delete().eq("id", id));
    },
    async search(input: SearchInput, offset = 0) {
      const x = searchSchema.parse(input);
      return result<SearchResult[]>(
        db.rpc("search_market", {
          q: x.query,
          filter_category: x.category,
          price_min: x.min_price,
          price_max: x.max_price,
          rating_min: x.min_rating,
          lat: x.latitude,
          lng: x.longitude,
          radius: x.radius_km,
          page_offset: offset,
        }),
      );
    },
    async toggle(
      table: "likes" | "saves" | "follows",
      target: string,
      active: boolean,
    ) {
      const user_id = await uid();
      const key = table === "follows" ? "business_id" : "post_id";
      return result(
        active
          ? db.from(table).delete().eq("user_id", user_id).eq(key, target)
          : db
              .from(table)
              .upsert(
                { user_id, [key]: target },
                { onConflict: `user_id,${key}`, ignoreDuplicates: true },
              ),
      );
    },
    async following(id: string) {
      return !!(await result(
        db
          .from("follows")
          .select("business_id")
          .eq("business_id", id)
          .eq("user_id", await uid())
          .maybeSingle(),
      ));
    },
    async saved(id: string) {
      return !!(await result(
        db
          .from("saves")
          .select("post_id")
          .eq("post_id", id)
          .eq("user_id", await uid())
          .maybeSingle(),
      ));
    },
    comments(post: string) {
      return result<
        {
          id: string;
          body: string;
          created_at: string;
          profiles: { display_name: string };
        }[]
      >(
        db
          .from("comments")
          .select("id,body,created_at,profiles(display_name)")
          .eq("post_id", post)
          .order("created_at")
          .limit(100),
      );
    },
    async comment(post_id: string, body: string) {
      if (!body.trim() || body.length > 1000)
        throw new Error("Comment must be 1–1000 characters");
      return result(
        db
          .from("comments")
          .insert({ post_id, body: body.trim(), user_id: await uid() }),
      );
    },
    reviews(business: string) {
      return result<
        {
          id: string;
          rating: number;
          body: string;
          profiles: { display_name: string };
        }[]
      >(
        db
          .from("reviews")
          .select("id,rating,body,profiles(display_name)")
          .eq("business_id", business)
          .limit(100),
      );
    },
    async review(business_id: string, rating: number, body: string) {
      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        body.length > 2000
      )
        throw new Error("Invalid review");
      return result(
        db
          .from("reviews")
          .upsert(
            { business_id, rating, body, user_id: await uid() },
            { onConflict: "business_id,user_id" },
          ),
      );
    },
    async startChat(business_id: string) {
      return result<string>(
        db.rpc("start_chat", { target_business: business_id }),
      );
    },
    async chats() {
      const chats = await result<Chat[]>(
        db
          .from("chats")
          .select("*,businesses(*)")
          .order("created_at", { ascending: false })
          .limit(100),
      );
      const counts = await result<{ chat_id: string; unread: number }[]>(
        db.rpc("unread_counts"),
      );
      return chats.map((c) => ({
        ...c,
        unread: counts.find((x) => x.chat_id === c.id)?.unread ?? 0,
      }));
    },
    messages(chat: string, before?: string) {
      let q = db
        .from("messages")
        .select("*")
        .eq("chat_id", chat)
        .order("created_at", { ascending: false })
        .limit(50);
      if (before) q = q.lt("created_at", before);
      return result<Message[]>(q).then((rows) => rows.reverse());
    },
    async send(input: unknown) {
      return result(
        db
          .from("messages")
          .insert({ ...messageSchema.parse(input), sender_id: await uid() }),
      );
    },
    markRead(chat: string) {
      return result(db.rpc("mark_chat_read", { target_chat: chat }));
    },
    subscribeChat(chat: string, onChange: () => void) {
      const channel = db
        .channel(`chat:${chat}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chat}`,
          },
          onChange,
        )
        .subscribe();
      return () => {
        void db.removeChannel(channel);
      };
    },
    async notifications() {
      return result<Notification[]>(
        db
          .from("notifications")
          .select("*")
          .eq("user_id", await uid())
          .order("created_at", { ascending: false })
          .limit(100),
      );
    },
    readNotification(id: string) {
      return result(
        db
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id),
      );
    },
    async uploadImage(bytes: Blob | ArrayBuffer, mime: string, chat?: string) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
        throw new Error("Choose a JPEG, PNG or WebP image");
      const size = bytes instanceof ArrayBuffer ? bytes.byteLength : bytes.size;
      if (size > 6 * 1024 * 1024) throw new Error("Images must be under 6 MB");
      const user = await uid();
      const ext = mime.split("/")[1];
      const path = `${chat ? chat + "/" : ""}${user}/${randomId()}.${ext}`;
      const bucket = chat ? "chat-images" : "business-media";
      await result(
        db.storage
          .from(bucket)
          .upload(path, bytes, { contentType: mime, upsert: false }),
      );
      return chat
        ? path
        : db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
    async chatImage(path: string) {
      const data = await result<{ signedUrl: string }>(
        db.storage.from("chat-images").createSignedUrl(path, 300),
      );
      return data.signedUrl;
    },
    async report(
      target_type: "post" | "business" | "user",
      target_id: string,
      reason: string,
    ) {
      if (reason.trim().length < 5 || reason.length > 1000)
        throw new Error("Provide a reason (5–1000 characters)");
      return result(
        db
          .from("reports")
          .insert({ reporter_id: await uid(), target_type, target_id, reason }),
      );
    },
    async block(blocked_id: string) {
      return result(
        db
          .from("blocks")
          .upsert(
            { blocker_id: await uid(), blocked_id },
            { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
          ),
      );
    },
    async isAdmin() {
      return result<boolean>(db.rpc("is_admin"));
    },
    reports() {
      return result<
        {
          id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status: string;
        }[]
      >(
        db
          .from("reports")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      );
    },
    moderate(report_id: string, remove: boolean) {
      return result(
        db.rpc("moderate_report", { report_id, remove_content: remove }),
      );
    },
    analytics() {
      return result<
        {
          posts: number;
          likes: number;
          followers: number;
          chat_inquiries: number;
        }[]
      >(db.rpc("business_analytics"));
    },
  };
}
export type Api = ReturnType<typeof createApi>;
