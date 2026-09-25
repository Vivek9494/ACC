# ACC typography ESLint plugin

Locks the mobile type scale from `apps/mobile/src/theme/typography.ts`.

## Rules

| Rule | Level | What it bans |
|---|---|---|
| `acc-typography/no-sub-caption-font-size` | error | `text-[8px]`–`text-[11px]`, `fontSize < 12` |
| `acc-typography/no-small-input-font-size` | error (input files) | `fontSize < 16` on shared inputs |
| `acc-typography/prefer-type-scale-token` | warn | arbitrary `text-[Npx]` (prefer tokens) |

## Allowlist

`allowlist.mjs` → `SUB_CAPTION_ALLOWLIST` lists files still below the caption floor until Phases 1–3. **Do not add new paths** — migrate to `text-caption` / `variant="caption"` instead.

## Verify fixtures

```bash
pnpm exec eslint --no-ignore tools/eslint-plugin-acc-typography/__fixtures__/violations.tsx
```

Expect errors for `text-[10px]`, `fontSize: 11`, and (with input rule enabled on that file) `fontSize: 14`.
