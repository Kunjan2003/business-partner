import { pickPhoto } from "../src/session";
const mockPick = jest.fn(),
  mockResize = jest.fn(),
  mockRead = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: (...args: any[]) => mockPick(...args),
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: () => ({
      resize: mockResize,
      renderAsync: async () => ({
        saveAsync: async () => ({ uri: "file:///converted.jpg" }),
      }),
    }),
  },
}));
jest.mock("expo-file-system", () => ({
  File: class {
    arrayBuffer() {
      return mockRead();
    }
  },
}));
test("HEIC gallery image is converted and read natively without fetching a file URL", async () => {
  mockPick.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "file:///source.heic",
        width: 4000,
        height: 3000,
        mimeType: "image/heic",
      },
    ],
  });
  mockRead.mockResolvedValue(new Uint8Array([255, 216, 255, 217]).buffer);
  const original = global.fetch;
  const fetch = jest.fn(() => {
    throw new Error("file URL fetch is unsupported");
  });
  global.fetch = fetch as never;
  try {
    const photo = await pickPhoto();
    expect(photo?.mime).toBe("image/jpeg");
    expect(photo?.bytes.byteLength).toBe(4);
    expect(mockResize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    global.fetch = original;
  }
});
test("cancelled picker does not upload or read a file", async () => {
  mockRead.mockClear();
  mockPick.mockResolvedValue({ canceled: true });
  expect(await pickPhoto()).toBeNull();
  expect(mockRead).not.toHaveBeenCalled();
});
