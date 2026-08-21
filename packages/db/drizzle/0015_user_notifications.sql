CREATE TABLE "user_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title_fr" text NOT NULL,
	"title_en" text NOT NULL,
	"title_ht" text NOT NULL,
	"body_fr" text NOT NULL,
	"body_en" text NOT NULL,
	"body_ht" text NOT NULL,
	"link_url" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_user_type_unique" UNIQUE("user_id","type")
);
--> statement-breakpoint
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
