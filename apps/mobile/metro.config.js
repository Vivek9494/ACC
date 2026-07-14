// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const appNodeModules = path.resolve(projectRoot, 'node_modules');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so workspace packages (e.g. @acc/types) hot-reload.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];

// Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(workspaceRoot, 'node_modules'),
];

/**
 * Resolve a package directory for Metro singleton pinning.
 * Tries the app workspace first, then via expo-router (pnpm nest).
 */
function resolvePackageDir(name) {
  const candidates = [projectRoot, appNodeModules];
  try {
    candidates.push(path.dirname(require.resolve('expo-router/package.json', { paths: [projectRoot] })));
  } catch {
    // expo-router may be missing during sparse installs
  }

  for (const from of candidates) {
    try {
      return path.dirname(require.resolve(`${name}/package.json`, { paths: [from] }));
    } catch {
      // try next
    }
  }

  const local = path.join(appNodeModules, ...name.split('/'));
  if (fs.existsSync(local)) {
    return local;
  }

  throw new Error(
    `Metro singleton: cannot resolve "${name}". Run pnpm install from the repo root.`,
  );
}

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
  ...Object.fromEntries(singletonPackages.map((name) => [name, resolvePackageDir(name)])),
};

module.exports = withNativeWind(config, { input: './global.css' });
