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
    // Creates a pending Auth identity. A public profile is created only after verification.
    async register(email: string, password: string, redirectTo: string) {
      credentialsSchema.parse({ email: email.trim(), password });
      const { data, error } = await db.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { signup_flow: "verified_onboarding" },
        },
      });
      if (error) throw error;
      if (data.session) {
        await db.auth.signOut();
        throw new Error(
          "Enable Confirm email in Supabase Authentication settings before accepting registrations.",
        );
      }
      return data;
    },
    async resendVerification(email: string, redirectTo: string) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email");
      return result(
        db.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: redirectTo },
        }),
      );
    },
    async magicLink(email: string, redirectTo: string) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error("Enter a valid email");
      return result(
        db.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        }),
      );
    },
    async finishOnboarding(input: {
      display_name: string;
      username: string;
      role: "customer" | "owner";
      bio?: string;
      avatar_url?: string;
    }) {
      const display_name = input.display_name.trim();
      const username = input.username.trim().toLowerCase();
      const bio = (input.bio ?? "").trim();
      roleSchema.parse(input.role);
      if (display_name.length < 2 || display_name.length > 100)
        throw new Error("Enter your name (2–100 characters)");
      if (!/^[a-z0-9._]{3,30}$/.test(username))
        throw new Error(
          "Username must be 3–30 letters, numbers, dots or underscores",
        );
      if (bio.length > 160)
        throw new Error("Bio must be 160 characters or less");
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (
        !auth.user ||
        (!auth.user.email_confirmed_at && !auth.user.phone_confirmed_at)
      )
        throw new Error("Verify your email before completing your profile");
      return result<Profile>(
        db
          .from("profiles")
          .update({
            display_name,
            username,
            role: input.role,
            bio,
            onboarding_completed: true,
            ...(input.avatar_url !== undefined
              ? { avatar_url: input.avatar_url }
              : {}),
          })
          .eq("id", auth.user.id)
          .select("*")
          .single(),
      );
    },
    async signIn(email: string, password: string) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password)
        throw new Error("Enter your email and password");
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
    async updateProfile(
      display_name: string,
      role: "owner" | "customer",
      avatar_url?: string,
    ) {
      roleSchema.parse(role);
      if (!display_name.trim() || display_name.length > 100)
        throw new Error("Name must be 1–100 characters");
      return result(
        db
          .from("profiles")
          .update({
            display_name: display_name.trim(),
            role,
            ...(avatar_url !== undefined ? { avatar_url } : {}),
          })
          .eq("id", await uid())
          .select("id")
          .single(),
      );
    },
    ensureProfile() {
      return result<Profile>(db.rpc("ensure_profile").single());
    },
    businessStats(id: string) {
      return result<{
        posts: number;
        followers: number;
        products: number;
        rating: number;
      }>(db.rpc("business_stats", { target_business: id }));
    },
    businessPosts(id: string, offset = 0) {
      return result<Post[]>(
        db
          .from("posts")
          .select("*,businesses!inner(*),likes(user_id),comments(id)")
          .eq("business_id", id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 11),
      );
    },
    followedBusinesses: async () =>
      result<{ businesses: Business }[]>(
        db
          .from("follows")
          .select("businesses!inner(*)")
          .eq("user_id", await uid())
          .limit(30),
      ),
    post(id: string) {
      return result<Post>(
        db
          .from("posts")
          .select("*,businesses!inner(*),likes(user_id),comments(id)")
          .eq("id", id)
          .single(),
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
    // Registration is restricted by push_devices RLS to the signed-in user.
    async registerPushToken(expo_token: string, platform: "android" | "ios") {
      if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(expo_token))
        throw new Error("Invalid Expo push token");
      return result(db.from("push_devices").upsert({
        expo_token, platform, user_id: await uid(), updated_at: new Date().toISOString(),
      }, { onConflict: "expo_token" }));
    },
    async removePushToken(expo_token: string) {
      return result(db.from("push_devices").delete().eq("expo_token",expo_token).eq("user_id",await uid()));
    },
    async startVideoUpload(business_id: string): Promise<{uid:string;uploadURL:string}> {
      if (!/^[a-f0-9-]{36}$/i.test(business_id)) throw new Error("Invalid business");
      const {data,error} = await db.functions.invoke("stream-upload",{body:{business_id}});
      if(error) throw error;
      if(!data || typeof data.uid !== "string" || typeof data.uploadURL !== "string"
        || !/^https:\/\//.test(data.uploadURL)) throw new Error("Invalid video upload response");
      return {uid:data.uid,uploadURL:data.uploadURL};
    },
    async uploadVideo(business_id:string, file: Blob | {uri:string;name:string;type:string}) {
      const upload=await this.startVideoUpload(business_id);
      const form=new FormData();
      form.append("file",file as Blob);
      const response=await fetch(upload.uploadURL,{method:"POST",body:form});
      if(!response.ok) throw new Error("Video upload failed. Please try again.");
      return upload.uid;
    },
    async videoStatus(uid:string):Promise<"ready"|"processing"|"error"> {
      if(!/^[a-f0-9]{32}$/.test(uid))throw new Error("Invalid video");
      const {data,error}=await db.functions.invoke("stream-status",{body:{uid}});
      if(error)throw error;
      return data?.state === "ready" ? "ready" : data?.state === "error" ? "error" : "processing";
    },
    async createPost(input: unknown) {
      return result(db.from("posts").insert(postSchema.parse(input)));
    },
    deletePost(id: string) {
      return result(
        db.from("posts").delete().eq("id", id).select("id").single(),
      );
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
          ? db
              .from("products")
              .update(editable)
              .eq("id", id)
              .select("id")
              .single()
          : db.from("products").insert(value).select("id").single(),
      );
    },
    deleteProduct(id: string) {
      return result(
        db.from("products").delete().eq("id", id).select("id").single(),
      );
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
          profiles: { display_name: string; avatar_url?: string | null };
        }[]
      >(
        db
          .from("comments")
          .select("id,body,created_at,profiles(display_name,avatar_url)")
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
          profiles: { display_name: string; avatar_url?: string | null };
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
          .select(
            "*,businesses(*,owner:profiles!businesses_owner_id_fkey(display_name,avatar_url)),customer:profiles!chats_customer_id_fkey(display_name,avatar_url)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
      );
      const counts = await result<{ chat_id: string; unread: number }[]>(
        db.rpc("unread_counts"),
      );
      return chats.map((c) => ({
        ...c,
        unread: Number(counts.find((x) => x.chat_id === c.id)?.unread ?? 0),
      }));
    },
    messages(
      chat: string,
      before?: string | { created_at: string; id: string },
    ) {
      let q = db
        .from("messages")
        .select("*")
        .eq("chat_id", chat)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (typeof before === "string") q = q.lt("created_at", before);
      else if (before) {
        if (
          !/^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/.test(before.created_at) ||
          !/^[a-f0-9-]{36}$/i.test(before.id)
        )
          throw new Error("Invalid message cursor");
        q = q.or(
          `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`,
        );
      }
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
      if (!size) throw new Error("This image is empty. Choose another photo.");
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
