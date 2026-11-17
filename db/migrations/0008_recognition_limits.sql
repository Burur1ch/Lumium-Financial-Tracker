CREATE TABLE "request_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" varchar(48) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "request_limits_window_unique" UNIQUE("user_id","kind","window_start")
);
--> statement-breakpoint
ALTER TABLE "request_limits" ADD CONSTRAINT "request_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_limits_window_idx" ON "request_limits" USING btree ("window_start");