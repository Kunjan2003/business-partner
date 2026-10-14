module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@bp/core$": "<rootDir>/../../packages/core/src/index.ts",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-.*|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*|@tanstack/.*|react-native-.*)/)",
  ],
};
