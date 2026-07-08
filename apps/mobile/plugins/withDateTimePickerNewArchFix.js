const fs = require('fs');
const path = require('path');

const MARKER = 'ACC_NEW_ARCH_ONCHANGE_FIX';

/**
 * Same fix as scripts/patch-datetimepicker-ios.js, applied during expo prebuild.
 */
function withDateTimePickerNewArchFix(config) {
  const filePath = path.join(
    config.modRequest?.projectRoot ?? process.cwd(),
    'node_modules/@react-native-community/datetimepicker/ios/RNDateTimePicker.m',
  );

  if (fs.existsSync(filePath)) {
    let source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes(MARKER)) {
      const oldBlock = `  if ((self = [super initWithFrame:frame])) {
    #ifndef RCT_NEW_ARCH_ENABLED
      // somehow, with Fabric, the callbacks are executed here as well as in RNDateTimePickerComponentView
      // so do not register it with Fabric, to avoid potential problems
      [self addTarget:self action:@selector(didChange)
               forControlEvents:UIControlEventValueChanged];
      [self addTarget:self action:@selector(onDismiss:) forControlEvents:UIControlEventEditingDidEnd];
    #endif

    _reactMinuteInterval = 1;
  }`;

      const newBlock = `  if ((self = [super initWithFrame:frame])) {
    // ${MARKER}: always register onChange/onDismiss (New Architecture).
    [self addTarget:self action:@selector(didChange)
             forControlEvents:UIControlEventValueChanged];
    [self addTarget:self action:@selector(onDismiss:) forControlEvents:UIControlEventEditingDidEnd];

    _reactMinuteInterval = 1;
  }`;

      if (source.includes(oldBlock)) {
        source = source.replace(oldBlock, newBlock);
        fs.writeFileSync(filePath, source);
      }
    }
  }

  return config;
}

module.exports = withDateTimePickerNewArchFix;
