CREATE TABLE "natcash_balance_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"balance_cents" integer NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rake_event" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"environment" "game_environment" DEFAULT 'live' NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rake_event_client_ref_unique" UNIQUE("client_id","reference_id")
);
--> statement-breakpoint
ALTER TABLE "withdrawal_request" ADD COLUMN "fee_cents" integer;