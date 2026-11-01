ALTER TABLE "categories" ADD COLUMN "system_key" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_system_key_unique" ON "categories" USING btree ("user_id","system_key");
