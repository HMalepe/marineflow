-- Fix stale age-gate branding (Bart → Dr Marley) on dispensary salons.
UPDATE "Salon"
SET metadata = jsonb_set(
  COALESCE(metadata::jsonb, '{}'::jsonb),
  '{retail,ageGateCopy}',
  to_jsonb(
    E'🌿 *Dr Marley Dispensary*\n\nYou must be *18+* to order cannabis products.\n\nReply *YES* to confirm you are 18 or older, or *NO* to exit.'
  ),
  true
)
WHERE "deletedAt" IS NULL
  AND (
    "industryTemplate" = 'dispensary'
    OR metadata::text ILIKE '%Bart Marley%'
  )
  AND (
    COALESCE(metadata::jsonb #>> '{retail,ageGateCopy}', '') ILIKE '%Bart Marley%'
    OR COALESCE(metadata::jsonb #>> '{retail,ageGateCopy}', '') = ''
  );
