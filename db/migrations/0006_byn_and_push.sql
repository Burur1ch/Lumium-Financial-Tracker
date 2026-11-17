CREATE TABLE "currency_migration_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(20, 10),
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"slot" integer NOT NULL,
	"sent_at" timestamp with time zone,
	"retry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_deliveries_slot_unique" UNIQUE("subscription_id","local_date","slot")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"timezone" varchar(80) DEFAULT 'Europe/Minsk' NOT NULL,
	"language" varchar(2) DEFAULT 'ru' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint
DO $$
DECLARE conversion_rate numeric := COALESCE(NULLIF(current_setting('lumium.usd_to_byn_rate', true), ''), '0')::numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM transactions UNION ALL SELECT 1 FROM budgets UNION ALL SELECT 1 FROM quick_transaction_presets UNION ALL SELECT 1 FROM recurring_transactions UNION ALL SELECT 1 FROM savings_goals)
     AND (conversion_rate <= 0 OR conversion_rate > 1000) THEN
    RAISE EXCEPTION 'Use npm run db:migrate to supply a verified USD/BYN conversion rate. No amounts were changed.';
  END IF;
  UPDATE transactions SET amount = round(amount * conversion_rate, 8);
  UPDATE transaction_splits SET amount = round(amount * conversion_rate, 8);
  -- Balance converted shares to the converted transaction in database units.
  WITH shares AS (
    SELECT s.id, s.amount, t.amount - sum(s.amount) OVER (PARTITION BY s.transaction_id) AS remainder,
      row_number() OVER (PARTITION BY s.transaction_id ORDER BY s.amount DESC, s.id) AS rank
    FROM transaction_splits s JOIN transactions t ON t.id = s.transaction_id
  ) UPDATE transaction_splits s SET amount = shares.amount + shares.remainder FROM shares WHERE shares.id = s.id AND shares.rank = 1;
  UPDATE quick_transaction_presets SET amount = round(amount * conversion_rate, 8);
  UPDATE recurring_transactions SET amount = round(amount * conversion_rate, 8);
  UPDATE budgets SET monthly_limit = round(monthly_limit * conversion_rate, 8);
  UPDATE savings_goals SET target_amount = round(target_amount * conversion_rate, 8), current_amount = round(current_amount * conversion_rate, 8);
  INSERT INTO currency_migration_audit (id, from_currency, to_currency, rate) VALUES ('usd-to-byn-v1', 'USD', 'BYN', NULLIF(conversion_rate, 0));
END $$;
