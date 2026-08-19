CREATE INDEX "roast_status_created_at_idx" ON "roast" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "roast_book_status_idx" ON "roast" USING btree ("book_work_id","status");--> statement-breakpoint
CREATE INDEX "roast_author_status_idx" ON "roast" USING btree ("author_profile_id","status");