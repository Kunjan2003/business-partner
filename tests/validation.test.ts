import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessSchema,
  credentialsSchema,
  messageSchema,
  productSchema,
  searchSchema,
  roleSchema,
  directionsUrl,
} from "../packages/core/src/schema";
import { createApi } from "../packages/core/src/client";
const business = {
  name: "Local Coffee",
  category: "Food & drinks",
  description: "Coffee",
  contact: "",
  address: "12 Main Road",
  hours: "9–5",
  latitude: 23.1,
  longitude: 72.5,
  logo_url: "",
};
test("business validation rejects impossible map pins and blank names", () => {
  assert.equal(businessSchema.parse(business).name, "Local Coffee");
  assert.throws(() => businessSchema.parse({ ...business, latitude: 91 }));
  assert.throws(() => businessSchema.parse({ ...business, name: " " }));
});
test("signup cannot select an admin role and rejects weak credentials", () => {
  assert.throws(() => roleSchema.parse("admin"));
  assert.throws(() =>
    credentialsSchema.parse({ email: "bad", password: "123" }),
  );
});
test("message requires text or an attachment and enforces size", () => {
  const chat_id = "11111111-1111-4111-8111-111111111111";
  assert.throws(() => messageSchema.parse({ chat_id, body: "  " }));
  assert.throws(() => messageSchema.parse({ chat_id, body: "a".repeat(4001) }));
  assert.equal(
    messageSchema.parse({ chat_id, body: "", image_path: "private/image.jpg" })
      .body,
    "",
  );
});
test("search rejects reversed prices and partial coordinates", () => {
  assert.throws(() => searchSchema.parse({ min_price: 100, max_price: 10 }));
  assert.throws(() => searchSchema.parse({ latitude: 23 }));
  assert.equal(searchSchema.parse({}).radius_km, 25);
});
test("negative prices fail validation", () => {
  assert.throws(() =>
    productSchema.parse({
      business_id: "11111111-1111-4111-8111-111111111111",
      name: "Coffee",
      description: "",
      category: "Food",
      price: -1,
      image_url: "",
      available: true,
    }),
  );
});
test("directions preserve exact map coordinates", () => {
  assert.equal(
    directionsUrl(23.1, 72.5),
    "https://www.google.com/maps/dir/?api=1&destination=23.1,72.5",
  );
});
test("product edits never submit immutable business ownership", async () => {
  let update: Record<string, unknown> | undefined;
  const fake = {
    from: () => ({
      update: (value: Record<string, unknown>) => {
        update = value;
        return {
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: { id: "product" }, error: null }),
            }),
          }),
        };
      },
    }),
  };
  const api = createApi(fake as never);
  await api.saveProduct(
    {
      business_id: "11111111-1111-4111-8111-111111111111",
      name: "Coffee",
      description: "",
      category: "Food",
      price: 20,
      image_url: "",
      available: true,
    },
    "product",
  );
  assert.ok(update);
  assert.ok(!("business_id" in update));
  assert.equal(update.price, 20);
});
test("uploads reject executable formats before contacting storage", async () => {
  const api = createApi({} as never);
  await assert.rejects(
    api.uploadImage(new ArrayBuffer(1), "image/svg+xml"),
    /JPEG/,
  );
  await assert.rejects(
    api.uploadImage(new ArrayBuffer(7 * 1024 * 1024), "image/png"),
    /under 6 MB/,
  );
});
