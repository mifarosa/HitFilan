import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../js'),
      '@': path.resolve(__dirname, 'src'),
      // The phone's SQLite key-value storage: replaced by a plain in-memory one in tests.
      'expo-sqlite/kv-store': path.resolve(__dirname, 'tests/stubKv.ts'),
      'expo-notifications': path.resolve(__dirname, 'tests/stubNotifications.ts'),
      'expo-constants': path.resolve(__dirname, 'tests/stubConstants.ts'),
      'react-native': path.resolve(__dirname, 'tests/stubReactNative.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
