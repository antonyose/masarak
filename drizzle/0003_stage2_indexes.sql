CREATE INDEX "payment_submissions_student_created_idx" ON "payment_submissions" USING btree ("saved_student_id","created_at");--> statement-breakpoint
CREATE INDEX "prediction_runs_stage_model_idx" ON "prediction_runs" USING btree ("year","coordination_stage","model_version_id");
