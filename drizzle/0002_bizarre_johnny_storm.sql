/*
 * Preserve the previous timestamp semantics while adopting Better Auth's
 * boolean contract: any recorded verification date becomes true, and null
 * becomes false before the default and required constraint are applied.
 */
ALTER TABLE "user" ALTER COLUMN "email_verified" SET DATA TYPE boolean USING ("email_verified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_verified" SET NOT NULL;
