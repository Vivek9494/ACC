/**
 * ESLint rules locking ACC mobile type-scale floor.
 * @see apps/mobile/src/theme/typography.ts
 */

const SUB_CAPTION_CLASS =
  /(?:^|[\s"'`])text-\[(?:8|9|10|11)px\](?:$|[\s"'`])|text-\[(?:8|9|10|11)px\]/;

const CAPTION_FLOOR = 12;
const INPUT_FLOOR = 16;

function reportSubCaptionClass(context, node, raw) {
  if (typeof raw !== 'string' || !SUB_CAPTION_CLASS.test(raw)) {
    return;
  }
  context.report({
    node,
    messageId: 'subCaptionClass',
    data: { sample: raw.match(/text-\[(?:8|9|10|11)px\]/)?.[0] ?? 'text-[Npx]' },
  });
}

function fontSizeKeyName(keyNode) {
  if (!keyNode) {
    return null;
  }
  if (keyNode.type === 'Identifier') {
    return keyNode.name;
  }
  if (keyNode.type === 'Literal' && typeof keyNode.value === 'string') {
    return keyNode.value;
  }
  return null;
}

function createSubCaptionRule() {
  return {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Disallow font sizes below the caption floor (12). Use text-caption / TYPE.caption.',
      },
      schema: [],
      messages: {
        subCaptionClass:
          'Sub-caption size "{{sample}}" is below the 12px floor. Use text-caption (or Text variant="caption") from the type scale.',
        subCaptionFontSize:
          'fontSize {{size}} is below the 12px caption floor. Use TYPE.caption (12) or larger from @/theme/typography.',
      },
    },
    create(context) {
      return {
        Literal(node) {
          if (typeof node.value === 'string') {
            reportSubCaptionClass(context, node, node.value);
          }
        },
        TemplateElement(node) {
          reportSubCaptionClass(context, node, node.value.cooked ?? node.value.raw);
        },
        Property(node) {
          if (node.computed || fontSizeKeyName(node.key) !== 'fontSize') {
            return;
          }
          if (node.value.type !== 'Literal' || typeof node.value.value !== 'number') {
            return;
          }
          if (node.value.value < CAPTION_FLOOR) {
            context.report({
              node: node.value,
              messageId: 'subCaptionFontSize',
              data: { size: String(node.value.value) },
            });
          }
        },
      };
    },
  };
}

function createSmallInputRule() {
  return {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Disallow input fontSize below 16 (iOS focus auto-zoom). Use INPUT_TEXT_STYLE / TYPE.body.',
      },
      schema: [],
      messages: {
        smallInputFontSize:
          'Input fontSize {{size}} is below 16. Use INPUT_TEXT_STYLE or TYPE.body (16) to avoid iOS focus zoom.',
      },
    },
    create(context) {
      return {
        Property(node) {
          if (node.computed || fontSizeKeyName(node.key) !== 'fontSize') {
            return;
          }
          if (node.value.type !== 'Literal' || typeof node.value.value !== 'number') {
            return;
          }
          if (node.value.value < INPUT_FLOOR) {
            context.report({
              node: node.value,
              messageId: 'smallInputFontSize',
              data: { size: String(node.value.value) },
            });
          }
        },
      };
    },
  };
}

/** Prefer type-scale tokens over one-off arbitrary px (warn). */
function createPreferTokenRule() {
  const arbitraryPx = /text-\[(\d+)px\]/g;
  return {
    meta: {
      type: 'suggestion',
      docs: {
        description:
          'Prefer type-scale utilities (text-caption, text-body, …) over arbitrary text-[Npx].',
      },
      schema: [],
      messages: {
        arbitraryPx:
          'Prefer a type-scale class (text-caption / text-sm / text-body / text-card-title / text-section / text-screen) over "{{sample}}". See @/theme/typography.',
      },
    },
    create(context) {
      function check(node, raw) {
        if (typeof raw !== 'string') {
          return;
        }
        arbitraryPx.lastIndex = 0;
        let match;
        while ((match = arbitraryPx.exec(raw)) !== null) {
          const px = Number(match[1]);
          // Sub-caption (8–11) is an error via no-sub-caption-font-size.
          if (px >= 8 && px <= 11) {
            continue;
          }
          context.report({
            node,
            messageId: 'arbitraryPx',
            data: { sample: match[0] },
          });
        }
      }
      return {
        Literal(node) {
          if (typeof node.value === 'string') {
            check(node, node.value);
          }
        },
        TemplateElement(node) {
          check(node, node.value.cooked ?? node.value.raw);
        },
      };
    },
  };
}

export default {
  meta: {
    name: 'eslint-plugin-acc-typography',
    version: '1.0.0',
  },
  rules: {
    'no-sub-caption-font-size': createSubCaptionRule(),
    'no-small-input-font-size': createSmallInputRule(),
    'prefer-type-scale-token': createPreferTokenRule(),
  },
};
