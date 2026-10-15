export type Profile = {
  id: string;
  display_name: string;
  role: "customer" | "owner";
  avatar_url: string | null;
  username?: string | null;
  bio?: string;
  onboarding_completed?: boolean;
};
export type Business = {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  contact: string;
  address: string;
  hours: string;
  latitude: number;
  longitude: number;
  logo_url: string;
  created_at: string;
};
export type Post = {
  id: string;
  business_id: string;
  caption: string;
  image_url: string;
  kind: "post" | "offer" | "product";
  created_at: string;
  businesses: Business;
  likes: { user_id: string }[];
  comments: { id: string }[];
};
export type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  available: boolean;
};
export type SearchResult = {
  id: string;
  business_id: string;
  kind: "business" | "product";
  name: string;
  description: string;
  category: string;
  image_url: string;
  price: number | null;
  rating: number;
  distance_km: number | null;
};
export type Chat = {
  id: string;
  customer_id: string;
  business_id: string;
  created_at: string;
  businesses: Business & {
    owner?: { display_name: string; avatar_url: string | null };
  };
  unread?: number;
  customer?: { display_name: string; avatar_url: string | null };
};
export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
};
export type Notification = {
  id: string;
  user_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
