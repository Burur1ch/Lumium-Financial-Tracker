ALTER TABLE "budgets" ALTER COLUMN "monthly_limit" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "quick_transaction_presets" ALTER COLUMN "amount" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "recurring_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "savings_goals" ALTER COLUMN "target_amount" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "savings_goals" ALTER COLUMN "current_amount" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "savings_goals" ALTER COLUMN "current_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "transaction_splits" ALTER COLUMN "amount" SET DATA TYPE numeric(20, 8);--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(20, 8);