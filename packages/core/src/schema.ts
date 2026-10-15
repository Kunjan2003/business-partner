import { z } from "zod";
export const roleSchema = z.enum(["customer", "owner"]);
export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export const businessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().max(2000),
  contact: z.string().trim().max(120),
  address: z.string().trim().min(3).max(300),
  hours: z.string().max(500),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  logo_url: z.string().url().or(z.literal("")).default(""),
});
export const postSchema = z.object({
  business_id: z.string().uuid(),
  caption: z.string().trim().min(1).max(2200),
  image_url: z.string().url().or(z.literal("")),
  kind: z.enum(["post", "offer", "product", "video"]).default("post"),
  video_uid: z.string().regex(/^[a-f0-9]{32}$/).nullable().optional(),
});
export const productSchema = z.object({
  business_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000),
  category: z.string().min(2).max(60),
  price: z.coerce.number().min(0).max(100000000),
  image_url: z.string().url().or(z.literal("")),
  available: z.boolean().default(true),
});
export const messageSchema = z
  .object({
    chat_id: z.string().uuid(),
    body: z.string().trim().max(4000),
    image_path: z.string().max(500).nullable().default(null),
  })
  .refine(
    (x) => x.body.length > 0 || !!x.image_path,
    "Write a message or attach an image",
  );
export const searchSchema = z
  .object({
    query: z.string().trim().max(100).default(""),
    category: z.string().max(60).default(""),
    min_price: z.coerce.number().min(0).default(0),
    max_price: z.coerce.number().min(0).default(100000000),
    min_rating: z.coerce.number().min(0).max(5).default(0),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    radius_km: z.number().min(1).max(200).default(25),
  })
  .refine(
    (x) => x.max_price >= x.min_price,
    "Maximum price must be at least the minimum",
  )
  .refine(
    (x) => (x.latitude === null) === (x.longitude === null),
    "Provide both coordinates",
  );
export type BusinessInput = z.infer<typeof businessSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type SearchInput = z.input<typeof searchSchema>;
export const categories = [
  "Food & drinks",
  "Fashion",
  "Home & living",
  "Beauty",
  "Electronics",
  "Services",
  "Other",
];
export function directionsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
