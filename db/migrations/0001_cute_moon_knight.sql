CREATE TABLE "quick_transaction_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid,
	"name" varchar(80) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" varchar(16) DEFAULT 'expense' NOT NULL,
	"icon" varchar(32) DEFAULT 'train' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_presets_type_check" CHECK ("quick_transaction_presets"."type" in ('expense', 'income')),
	CONSTRAINT "quick_presets_amount_check" CHECK ("quick_transaction_presets"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "idempotency_key" varchar(64);--> statement-breakpoint
ALTER TABLE "quick_transaction_presets" ADD CONSTRAINT "quick_transaction_presets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_transaction_presets" ADD CONSTRAINT "quick_transaction_presets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quick_presets_user_order_idx" ON "quick_transaction_presets" USING btree ("user_id","sort_order");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_idempotency_unique" UNIQUE("user_id","idempotency_key");