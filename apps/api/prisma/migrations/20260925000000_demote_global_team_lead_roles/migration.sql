-- Phase 1 role-model fix: Cap/VC/Manager are tournament-scoped via RoleAssignment,
-- not global User.role. Demote any global Cap/VC/Manager to PLAYER.
-- RoleAssignment rows are intentionally untouched.
-- Idempotent: re-run is a no-op once no rows match the WHERE clause.
-- tokenVersion bump invalidates existing JWTs that still carry the old platform role.

UPDATE "User"
SET
  "role" = 'PLAYER',
  "tokenVersion" = "tokenVersion" + 1
WHERE "role" IN ('CAPTAIN', 'VICE_CAPTAIN', 'MANAGER');
