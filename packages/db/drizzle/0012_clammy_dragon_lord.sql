-- Deposit and withdrawal amount bounds are independent per rail, in the same
-- spirit as enabled/withdrawalEnabled: a rail can allow small deposits but
-- only large withdrawals, or vice versa.
ALTER TABLE "payment_rail_config" RENAME COLUMN "min_amount_cents" TO "deposit_min_amount_cents";--> statement-breakpoint
ALTER TABLE "payment_rail_config" RENAME COLUMN "max_amount_cents" TO "deposit_max_amount_cents";--> statement-breakpoint
ALTER TABLE "payment_rail_config" ADD COLUMN "withdrawal_min_amount_cents" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_rail_config" ADD COLUMN "withdrawal_max_amount_cents" integer DEFAULT 7500000 NOT NULL;
