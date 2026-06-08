# Open Decisions

These items are flagged in the ACC Application Consolidated Specification V3 but not yet resolved. Do not implement assumptions for these in code until a decision is recorded here.

## 1. Captain + VC both suspended

What happens when both Captain and Vice Captain are suspended for the same match? Who selects the Playing 11 and who acts as on-field captain?

**Status:** Open

## 2. Powerplay scope

Is the powerplay restriction (max 2 fielders outside the 30-yard circle) enforced in the scoring engine for all tournament types, or only ACC/BEDCL matches?

**Status:** Open

## 3. Locked account unlock UX

When a player is locked out after failed OTP attempts, what is the exact unlock flow for Captain vs Club Manager? Is there a time-based auto-unlock?

**Status:** Open

## 4. Impact Player 12th selection mechanic

How is the 12th player (Impact Player substitute) selected at swap time — pre-nominated list only, or can Captain pick any squad member?

**Status:** Open

## 5. Email field purpose

The registration form includes an optional email field. Is it used for notifications, account recovery fallback, or display only?

**Status:** Open

## 6. Combined auth risk

The spec allows a 6-character alphanumeric password with no failed-login lockout on password attempts (only OTP lockout). Should password login have its own rate limiting independent of OTP?

**Status:** Open
