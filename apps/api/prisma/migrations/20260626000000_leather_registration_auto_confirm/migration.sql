-- Leather ACC has no verification gate: confirm any waitlisted leather registrations.
UPDATE "Registration" AS r
SET status = 'CONFIRMED'
FROM "Tournament" AS t
WHERE r."tournamentId" = t.id
  AND t."ballType" = 'LEATHER'
  AND r.status = 'IN_WAITLIST';
