// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages (e.g. @acc/types) hot-reload.
// Append to (don't replace) Expo's default watch folders.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(workspaceRoot, 'node_modules'),
];

// Pin singleton packages so Metro never bundles duplicate copies from the pnpm
// store (duplicate expo-router / react-navigation breaks LinkPreviewContext).
const singletonPackages = [
  'react',
  'react-native',
  'expo',
  'expo-router',
  '@react-navigation/native',
  '@react-navigation/core',
  '@expo/metro-runtime',
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...singletonPackages.reduce((acc, name) => {
    acc[name] = path.join(appNodeModules, name);
    return acc;
  }, {}),
};

module.exports = withNativeWind(config, { input: './global.css' });
