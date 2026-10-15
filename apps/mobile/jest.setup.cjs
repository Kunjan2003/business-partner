jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
// Native-only integrations are mocked for the Jest React Native renderer.
// Production builds use the actual Expo, Sentry and video modules.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  wrap: (Component) => Component,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "" })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-device", () => ({ isDevice: false }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { easConfig: null, expoConfig: null },
}));
jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return { VideoView: View, useVideoPlayer: () => ({}) };
});
