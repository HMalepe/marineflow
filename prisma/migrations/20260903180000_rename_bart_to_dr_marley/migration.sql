-- Rename live Bart Marley tenant + WhatsApp picker to Dr Marley
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

-- Router picker labels stored in JSON
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
      '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(metadata::jsonb->'linkedBusinesses', '[]'::jsonb)) elem
  )
)
WHERE "isBusinessRouter" = true
  AND metadata::text ILIKE '%Bart Marley%';

-- Age-gate copy on dispensary metadata
UPDATE "Salon"
SET metadata = jsonb_set(
  COALESCE(metadata::jsonb, '{}'::jsonb),
  '{retail,ageGateCopy}',
  to_jsonb(
    E'🌿 *Dr Marley Dispensary*\n\nYou must be *18+* to order cannabis products.\n\nReply *YES* to confirm you are 18 or older, or *NO* to exit.'
  )
)
WHERE "industryTemplate" = 'dispensary'
  AND (
    COALESCE(metadata::jsonb #>> '{retail,ageGateCopy}', '') ILIKE '%Bart Marley%'
    OR metadata::jsonb #>> '{retail,ageGateCopy}' IS NULL
  );
