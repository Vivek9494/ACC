# ACC typography ESLint plugin

Locks the mobile type scale from `apps/mobile/src/theme/typography.ts`.

## Rules

| Rule | Level | What it bans |
|---|---|---|
| `acc-typography/no-sub-caption-font-size` | **error** | `text-[8px]`–`text-[11px]`, `fontSize < 12` |
| `acc-typography/no-small-input-font-size` | error (input files) | `fontSize < 16` on shared inputs (`TYPE.input`, not body 15) |
| `acc-typography/prefer-type-scale-token` | warn | arbitrary `text-[Npx]` ≥12 (prefer tokens) |

Sub-12 is **error-only** outside the documented allowlist (Phase 3 complete).

## Allowlist (sub-12)

`allowlist.mjs` → `SUB_CAPTION_ALLOWLIST_ENTRIES` — only intentional density exceptions
(ball chips, OBS micro-badges, keypad cluster labels). Each entry has a **reason**.
Do **not** add new paths without documenting why 12 cannot absorb the layout.

## Verify fixtures

```bash
pnpm lint:typography-rules
```

Expect errors for `text-[10px]`, `fontSize: 11`, and (with input rule enabled on that file) `fontSize: 14`.
