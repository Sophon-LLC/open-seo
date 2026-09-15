CREATE TABLE "channel_reports" (
	"project_id" text NOT NULL,
	"channel" text NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"count" integer,
	"source" text NOT NULL,
	"observed_at" text NOT NULL,
	"source_updated_at" text,
	"imported_at" text NOT NULL,
	"period_start" text,
	"period_end" text,
	"scope" text,
	"configuration" text,
	CONSTRAINT "channel_reports_project_id_channel_item_key_pk" PRIMARY KEY("project_id","channel","item_key")
);
--> statement-breakpoint
ALTER TABLE "channel_reports" ADD CONSTRAINT "channel_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;