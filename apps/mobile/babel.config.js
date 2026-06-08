module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // react-native-worklets/plugin powers react-native-reanimated (a NativeWind
    // peer). It must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
