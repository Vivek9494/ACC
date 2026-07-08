/**
 * iOS New Architecture: RNDateTimePicker spinner never fires onChange because
 * UIControl targets are gated behind #ifndef RCT_NEW_ARCH_ENABLED.
 * @see https://github.com/react-native-datetimepicker/datetimepicker/issues/995
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'ACC_NEW_ARCH_ONCHANGE_FIX';
const filePath = path.join(
  __dirname,
  '../node_modules/@react-native-community/datetimepicker/ios/RNDateTimePicker.m',
);

if (!fs.existsSync(filePath)) {
  process.exit(0);
}

const source = fs.readFileSync(filePath, 'utf8');
if (source.includes(MARKER)) {
  process.exit(0);
}

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

if (!source.includes(oldBlock)) {
  console.warn(
    '[patch-datetimepicker-ios] RNDateTimePicker.m layout changed; skipping patch.',
  );
  process.exit(0);
}

fs.writeFileSync(filePath, source.replace(oldBlock, newBlock));
console.log('[patch-datetimepicker-ios] Applied New Architecture onChange fix.');
