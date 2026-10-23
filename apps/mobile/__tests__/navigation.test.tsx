import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";
const business = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "owner",
  name: "Coffee House",
  category: "Food & drinks",
  description: "Fresh local coffee",
  contact: "",
  address: "Main Road",
  hours: "9–5",
  latitude: 23,
  longitude: 72,
  logo_url: "",
  created_at: "2026-01-01",
};
let mockClient: QueryClient;
let mockContext: any;
const mockApi: any = {
  feed: jest.fn(),
  followedBusinesses: jest.fn(),
  notifications: jest.fn(),
  chats: jest.fn(),
  saved: jest.fn(),
  toggle: jest.fn(),
  comments: jest.fn(),
  comment: jest.fn(),
  search: jest.fn(),
  myBusiness: jest.fn(),
  businessStats: jest.fn(),
  businessPosts: jest.fn(),
  products: jest.fn(),
  reviews: jest.fn(),
  following: jest.fn(),
  followedCount: jest.fn(),
  saveProfile: jest.fn(),
  changePassword: jest.fn(),
};
jest.mock("../src/session", () => ({
  configured: true,
  AppProvider: ({ children }: any) => {
    const { QueryClientProvider } = require("@tanstack/react-query");
    return (
      <QueryClientProvider client={mockClient}>{children}</QueryClientProvider>
    );
  },
  useApp: () => mockContext,
}));
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}));
jest.mock("@expo/vector-icons/Ionicons", () => {
  const { Text } = require("react-native");
  return Object.assign(({ name }: any) => <Text>{name}</Text>, { font: {} });
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaProvider: View, SafeAreaView: View };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  mockApi.feed.mockResolvedValue([
    {
      id: "post-1",
      business_id: business.id,
      caption: "Today’s fresh roast",
      image_url: "",
      kind: "post",
      created_at: "2026-01-01",
      businesses: business,
      likes: [],
      comments: [],
    },
  ]);
  mockApi.followedBusinesses.mockResolvedValue([]);
  mockApi.notifications.mockResolvedValue([]);
  mockApi.chats.mockResolvedValue([]);
  mockApi.saved.mockResolvedValue(false);
  mockApi.comments.mockResolvedValue([]);
  mockApi.search.mockResolvedValue([]);
  mockApi.myBusiness.mockResolvedValue(business);
  mockApi.businessStats.mockResolvedValue({
    posts: 1,
    followers: 2,
    products: 0,
    rating: 0,
  });
  mockApi.businessPosts.mockResolvedValue([]);
  mockApi.products.mockResolvedValue([]);
  mockApi.reviews.mockResolvedValue([]);
  mockApi.following.mockResolvedValue(false);
  mockApi.followedCount.mockResolvedValue(3);
  mockContext = {
    api: mockApi,
    user: {
      id: "customer",
      display_name: "Kunjan",
      role: "customer",
      avatar_url: null,
      username: "kunjan",
      bio: "Business community",
      website: "",
    },
    recovery: false,
    finishRecovery: jest.fn(),
    session: { user: { id: "customer" } },
    loading: false,
    profileError: null,
    reloadProfile: jest.fn(),
    run: async (fn: any, keys: string[] = []) => {
      await fn();
      for (const key of keys)
        await mockClient.invalidateQueries({ queryKey: [key] });
      return true;
    },
  };
});
afterEach(() => {
  cleanup();
  mockClient.clear();
});
test("feed comments navigate to a composer and save using the post ID", async () => {
  const screen = render(<App />);
  await screen.findByText("Today’s fresh roast", { exact: false });
  fireEvent.press(screen.getByLabelText("Comments"));
  await screen.findByLabelText("Add a comment");
  fireEvent.changeText(screen.getByLabelText("Add a comment"), "Looks great!");
  fireEvent.press(screen.getByLabelText("Send comment"));
  await waitFor(() =>
    expect(mockApi.comment).toHaveBeenCalledWith("post-1", "Looks great!"),
  );
  fireEvent.press(screen.getByLabelText("Go back"));
  await screen.findByLabelText("Like post");
});
test("explore search maps typed text to the shared search API", async () => {
  const screen = render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  fireEvent.changeText(
    screen.getByLabelText("Search businesses and products"),
    "coffee",
  );
  await waitFor(() =>
    expect(mockApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "coffee" }),
      0,
    ),
  );
});
test("customer create tab gives a real account upgrade path", async () => {
  const screen = render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Create post" }));
  await screen.findByText("Share your business with the world");
  fireEvent.press(screen.getByText("Switch account type"));
  await screen.findByText("Account type");
  expect(mockApi.myBusiness).not.toHaveBeenCalled();
});
test("inbox labels the customer for business owners instead of displaying UUIDs", async () => {
  mockContext.user = {
    id: "owner",
    display_name: "Shop owner",
    role: "owner",
    avatar_url: null,
  };
  mockApi.chats.mockResolvedValue([
    {
      id: "chat-1",
      customer_id: "customer-uuid-should-not-render",
      business_id: business.id,
      businesses: business,
      customer: { display_name: "Asha Patel", avatar_url: null },
      unread: 2,
    },
  ]);
  const screen = render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Messages" }));
  await screen.findByText("Asha Patel");
  expect(screen.queryByText("customer-uuid-should-not-render")).toBeNull();
});
test("a backend profile failure keeps a signed-in session and offers retry", async () => {
  mockContext.user = null;
  mockContext.profileError = { message: "Network request failed" };
  const screen = render(<App />);
  expect(screen.getByText("We couldn’t load your account")).toBeTruthy();
  fireEvent.press(screen.getByText("Try again"));
  expect(mockContext.reloadProfile).toHaveBeenCalled();
  expect(screen.queryByText("Welcome back")).toBeNull();
});

test("profile editor saves username, bio and website through the shared API", async () => {
  const screen = render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Profile" }));
  fireEvent.press(await screen.findByText("Edit profile"));
  fireEvent.changeText(screen.getByLabelText("Username"), "kunjan.herma");
  fireEvent.changeText(
    screen.getByLabelText("Bio"),
    "Helping local businesses",
  );
  fireEvent.changeText(screen.getByLabelText("Website"), "https://example.com");
  fireEvent.press(screen.getByText("Save changes"));
  await waitFor(() =>
    expect(mockApi.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "kunjan.herma",
        bio: "Helping local businesses",
        website: "https://example.com",
      }),
    ),
  );
});
test("recovery session opens password form before the app and checks confirmation", async () => {
  mockContext.recovery = true;
  mockApi.changePassword.mockResolvedValue({});
  const screen = render(<App />);
  expect(screen.queryByRole("tab", { name: "Home" })).toBeNull();
  fireEvent.changeText(
    screen.getByLabelText("New password"),
    "new-password-123",
  );
  fireEvent.changeText(
    screen.getByLabelText("Confirm password"),
    "different-password",
  );
  fireEvent.press(screen.getByText("Update password"));
  expect(screen.getByText("Passwords don’t match.")).toBeTruthy();
  expect(mockApi.changePassword).not.toHaveBeenCalled();
  fireEvent.changeText(
    screen.getByLabelText("Confirm password"),
    "new-password-123",
  );
  fireEvent.press(screen.getByText("Update password"));
  await waitFor(() => expect(mockContext.finishRecovery).toHaveBeenCalled());
  expect(mockApi.changePassword).toHaveBeenCalledWith("new-password-123");
});

test("password recovery stays accessible when profile loading has failed", () => {
  mockContext.recovery = true;
  mockContext.profileError = new Error("Profile unavailable");
  const screen = render(<App />);
  expect(screen.getByLabelText("New password")).toBeTruthy();
  expect(screen.queryByText("We couldn’t load your account")).toBeNull();
});
