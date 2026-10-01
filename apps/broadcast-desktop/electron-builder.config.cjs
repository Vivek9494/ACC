/**
 * electron-builder config for ASC Broadcast.
 *
 * macOS: universal .dmg. Signed + hardened + notarized when credentials are in
 * the environment; otherwise ad-hoc signed (runs on Apple Silicon after
 * right-click → Open) for internal testing.
 *   Signing:      CSC_LINK (+ CSC_KEY_PASSWORD) or CSC_NAME (identity in the keychain)
 *   Notarization: APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID,
 *                 or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER
 * Windows: x64 NSIS installer. Signed only when WIN_CSC_LINK (+ WIN_CSC_KEY_PASSWORD) is set.
 */

const env = process.env;

// CI passes unset GitHub secrets as empty strings; electron-builder treats an
// empty CSC_LINK as a (missing) file path and aborts instead of skipping signing.
for (const key of [
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'CSC_NAME',
  'WIN_CSC_LINK',
  'WIN_CSC_KEY_PASSWORD',
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
]) {
  if (env[key] !== undefined && env[key].trim() === '') delete env[key];
}

const macSigning = Boolean(env.CSC_LINK || env.CSC_NAME);
const notarizeCredentials =
  Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) ||
  Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER);

if (process.argv.includes('--mac')) {
  console.log(
    `[ASC Broadcast] macOS signing: ${macSigning ? 'Developer ID' : 'ad-hoc (unsigned)'}; ` +
      `notarization: ${macSigning && notarizeCredentials ? 'on' : 'skipped'}`,
  );
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'ca.asc.broadcast',
  productName: 'ASC Broadcast',
  copyright: 'Copyright © ASC',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: ['src/**/*', 'package.json'],
  extraResources: [
    { from: 'build/ffmpeg/${os}-${arch}', to: 'bin' },
    { from: 'build/ffmpeg/licenses', to: 'licenses' },
  ],
  npmRebuild: false,
  icon: 'build/icon.png',
  publish: null,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    enableCookieEncryption: true,
  },

  mac: {
    category: 'public.app-category.sports',
    target: [{ target: 'dmg', arch: ['universal'] }],
    // Fixed names: the cockpit /download page links to releases/latest/download/<name>.
    artifactName: 'ASC-Broadcast-mac.${ext}',
    identity: macSigning ? undefined : '-',
    hardenedRuntime: macSigning,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: macSigning && notarizeCredentials,
    extendInfo: {
      NSAppleEventsUsageDescription:
        'ASC Broadcast hides OBS while you score and quits it cleanly when you close the app.',
    },
  },
  dmg: {
    title: '${productName} ${version}',
  },

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: 'ASC-Broadcast-Setup-win.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'ASC Broadcast',
  },
};
