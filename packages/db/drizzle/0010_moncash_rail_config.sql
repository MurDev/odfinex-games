-- MonCash becomes a togglable payment_rail_config entry alongside NatCash.
-- Defaults to enabled=true so existing games relying on the always-on
-- automated MonCash rail see no behavior change until an admin flips it.
INSERT INTO "payment_rail_config" ("id", "method", "enabled", "account_name", "account_number", "min_amount_cents", "max_amount_cents", "environment")
SELECT gen_random_uuid()::text, 'moncash', true, '', '', 1000, 7500000, 'live'
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_rail_config" WHERE "method" = 'moncash' AND "environment" = 'live'
);--> statement-breakpoint
INSERT INTO "payment_rail_config" ("id", "method", "enabled", "account_name", "account_number", "min_amount_cents", "max_amount_cents", "environment")
SELECT gen_random_uuid()::text, 'moncash', true, '', '', 1000, 7500000, 'sandbox'
WHERE NOT EXISTS (
  SELECT 1 FROM "payment_rail_config" WHERE "method" = 'moncash' AND "environment" = 'sandbox'
);
