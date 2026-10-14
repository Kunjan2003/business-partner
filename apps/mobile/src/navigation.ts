export type Tab = "home" | "explore" | "create" | "inbox" | "profile";
export type Route =
  | { name: "business"; id: string }
  | { name: "chat"; id: string; title: string }
  | { name: "comments"; id: string }
  | { name: "post"; id: string }
  | { name: "saved" }
  | { name: "notifications" }
  | { name: "edit-profile" }
  | { name: "edit-business" }
  | { name: "products" }
  | { name: "analytics" };
export type Navigate = (route: Route) => void;
