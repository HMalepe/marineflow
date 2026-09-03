-- Rename live Bart Marley tenant + WhatsApp picker to Dr Marley (idempotent)
UPDATE "Salon"
SET
  slug = 'dr-marley',
  name = 'Dr Marley Dispensary',
  "tradingName" = 'Dr Marley',
  "legalName" = 'Dr Marley Dispensary (Pty) Ltd',
  "welcomeMessage" = 'Welcome to Dr Marley Dispensary 🌿 Open 24/7 — reply with a number:'
WHERE slug = 'bart-marley'
  AND NOT EXISTS (SELECT 1 FROM "Salon" WHERE slug = 'dr-marley');

UPDATE "Salon"
SET
  name = 'Dr Marley Dispensary',
  "tradingName" = 'Dr Marley',
  "legalName" = 'Dr Marley Dispensary (Pty) Ltd',
  "welcomeMessage" = 'Welcome to Dr Marley Dispensary 🌿 Open 24/7 — reply with a number:'
WHERE slug = 'dr-marley';

UPDATE "StaffUser"
SET
  email = 'owner@drmarley.co.za',
  name = 'Dr Marley'
WHERE email = 'owner@bartmarley.co.za'
  AND NOT EXISTS (SELECT 1 FROM "StaffUser" WHERE email = 'owner@drmarley.co.za');

UPDATE "StaffUser"
SET name = 'Dr Marley'
WHERE email = 'owner@drmarley.co.za';

-- JSON patches must never fail the whole migration (would take WhatsApp down)
DO $$
BEGIN
  UPDATE "Salon"
  SET metadata = jsonb_set(
    COALESCE(metadata::jsonb, '{}'::jsonb),
    '{linkedBusinesses}',
    (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN elem->>'label' ILIKE '%bart marley%'
              THEN jsonb_set(elem, '{label}', '"Dr Marley - Dispensary"'::jsonb)
            ELSE elem
          END
        ),
        COALESCE(metadata::jsonb->'linkedBusinesses', '[]'::jsonb)
      )
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(metadata::jsonb->'linkedBusinesses', '[]'::jsonb)) = 'array'
            THEN COALESCE(metadata::jsonb->'linkedBusinesses', '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) elem
    )
  )
  WHERE "isBusinessRouter" = true
    AND metadata IS NOT NULL
    AND metadata::text ILIKE '%Bart Marley%';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'dr_marley_picker_label_skip: %', SQLERRM;
END $$;

DO $$
BEGIN
  UPDATE "Salon"
  SET metadata = jsonb_set(
    COALESCE(metadata::jsonb, '{}'::jsonb),
    '{retail,ageGateCopy}',
    to_jsonb(
      E'🌿 *Dr Marley Dispensary*\n\nYou must be *18+* to order cannabis products.\n\nReply *YES* to confirm you are 18 or older, or *NO* to exit.'
    ),
    true
  )
  WHERE "industryTemplate" = 'dispensary'
    AND (
      COALESCE(metadata::jsonb #>> '{retail,ageGateCopy}', '') ILIKE '%Bart Marley%'
      OR metadata::jsonb #>> '{retail,ageGateCopy}' IS NULL
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'dr_marley_age_gate_skip: %', SQLERRM;
END $$;
