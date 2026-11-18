CREATE TABLE "card_balances" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "confirmed_amount" numeric(20,8) NOT NULL,
  "ledger_income" numeric(20,8) NOT NULL,
  "ledger_expense" numeric(20,8) NOT NULL,
  "confirmed_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "recurring_transactions" DROP CONSTRAINT "recurring_transactions_frequency_check";
--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_frequency_check"
  CHECK ("frequency" IN ('once', 'weekly', 'monthly', 'yearly'));
