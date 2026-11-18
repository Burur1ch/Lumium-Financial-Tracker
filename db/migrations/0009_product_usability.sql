CREATE TABLE "user_preferences" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "data" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reminder_days" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "local_date" date NOT NULL,
  "completed" boolean NOT NULL DEFAULT false,
  "snoozed_until" timestamptz,
  "timezone" varchar(80) NOT NULL,
  CONSTRAINT "reminder_days_user_date_unique" UNIQUE("user_id", "local_date")
);
--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD COLUMN "anchor_date" date;
UPDATE "recurring_transactions" r SET "anchor_date" = COALESCE(
  (SELECT min(t."date")::date FROM "transactions" t WHERE t."recurring_transaction_id" = r."id" AND t."user_id" = r."user_id"),
  r."next_date"
);
ALTER TABLE "recurring_transactions" ALTER COLUMN "anchor_date" SET NOT NULL;
--> statement-breakpoint
CREATE FUNCTION "set_recurring_anchor"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.anchor_date IS NULL THEN NEW.anchor_date := NEW.next_date; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "recurring_anchor_default" BEFORE INSERT ON "recurring_transactions"
  FOR EACH ROW EXECUTE FUNCTION "set_recurring_anchor"();
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "created_at" timestamptz;
UPDATE "transactions" SET "created_at" = "date";
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET NOT NULL;
CREATE INDEX "transactions_user_created_idx" ON "transactions" ("user_id", "created_at");
