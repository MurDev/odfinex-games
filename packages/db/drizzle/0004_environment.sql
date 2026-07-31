CREATE TYPE "game_environment" AS ENUM ('sandbox', 'live');--> statement-breakpoint
ALTER TABLE "game_client" ADD COLUMN "environment" "game_environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_client" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_account" ADD COLUMN "environment" "game_environment" DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_account" DROP CONSTRAINT "wallet_account_pkey";--> statement-breakpoint
ALTER TABLE "wallet_account" ADD CONSTRAINT "wallet_account_pkey" PRIMARY KEY("user_id","environment");--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "environment" "game_environment" DEFAULT 'live' NOT NULL;
