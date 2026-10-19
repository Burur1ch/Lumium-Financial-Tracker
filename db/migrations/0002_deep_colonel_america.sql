CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid,
	"name" varchar(120) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" varchar(16) DEFAULT 'expense' NOT NULL,
	"frequency" varchar(16) NOT NULL,
	"next_date" date NOT NULL,
	"auto_create" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_transactions_type_check" CHECK ("recurring_transactions"."type" in ('expense', 'income')),
	CONSTRAINT "recurring_transactions_frequency_check" CHECK ("recurring_transactions"."frequency" in ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_transactions_amount_check" CHECK ("recurring_transactions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"current_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"target_date" date,
	"color" varchar(32) DEFAULT '#ef4444' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_goals_target_check" CHECK ("savings_goals"."target_amount" > 0),
	CONSTRAINT "savings_goals_current_check" CHECK ("savings_goals"."current_amount" >= 0),
	CONSTRAINT "savings_goals_status_check" CHECK ("savings_goals"."status" in ('active', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "transaction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid,
	"name" varchar(100) NOT NULL,
	"match_text" varchar(120) NOT NULL,
	"type" varchar(16),
	"mark_reviewed" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_rules_type_check" CHECK ("transaction_rules"."type" is null or "transaction_rules"."type" in ('expense', 'income'))
);
--> statement-breakpoint
CREATE TABLE "transaction_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_splits_amount_check" CHECK ("transaction_splits"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "rollover_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "alert_threshold" integer DEFAULT 75 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "review_status" varchar(16) DEFAULT 'reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "recurring_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_rules" ADD CONSTRAINT "transaction_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_transactions_user_date_idx" ON "recurring_transactions" USING btree ("user_id","next_date");--> statement-breakpoint
CREATE INDEX "savings_goals_user_idx" ON "savings_goals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_rules_user_idx" ON "transaction_rules" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transaction_splits_transaction_idx" ON "transaction_splits" USING btree ("transaction_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_alert_threshold_check" CHECK ("budgets"."alert_threshold" between 50 and 100);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_review_status_check" CHECK ("transactions"."review_status" in ('reviewed', 'needs_review'));