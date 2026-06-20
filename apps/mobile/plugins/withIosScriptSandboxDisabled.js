const { withXcodeProject } = require('expo/config-plugins');

/**
 * CocoaPods copy-resources scripts write files under ios/Pods/. Xcode 15+ user script
 * sandboxing blocks that unless ENABLE_USER_SCRIPT_SANDBOXING is NO.
 */
function withIosScriptSandboxDisabled(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key]?.buildSettings;
      if (buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return modConfig;
  });
}

module.exports = withIosScriptSandboxDisabled;
