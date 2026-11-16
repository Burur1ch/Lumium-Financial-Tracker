ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_id_owner_type_unique" UNIQUE("id","user_id","type");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_owner_type_fk" FOREIGN KEY ("parent_id","user_id","type") REFERENCES "public"."categories"("id","user_id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("user_id","parent_id");--> statement-breakpoint
-- Older clients could race when creating categories. Preserve every ID and
-- transaction, making only duplicate labels distinct before enforcing uniqueness.
WITH duplicates AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, type, lower(btrim(name)) ORDER BY (system_key IS NOT NULL) DESC, created_at, id) AS position
  FROM categories
)
UPDATE categories c SET name = c.name || ' (' || c.id::text || ')'
FROM duplicates d WHERE c.id = d.id AND d.position > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_sibling_name_unique" ON "categories" USING btree ("user_id","type",coalesce("parent_id"::text, ''),lower(btrim("name")));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_not_own_parent" CHECK ("categories"."parent_id" is null or "categories"."parent_id" <> "categories"."id");--> statement-breakpoint
CREATE FUNCTION enforce_category_depth() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id, 0));
  IF NEW.parent_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM categories WHERE parent_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'Categories support two levels only' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER categories_depth_guard BEFORE INSERT OR UPDATE OF parent_id, user_id, type ON categories FOR EACH ROW EXECUTE FUNCTION enforce_category_depth();
