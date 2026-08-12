CREATE TABLE IF NOT EXISTS funnel_events (
  id SERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_hour INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 1,
  metadata_json JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS funnel_events_name_date_hour_idx
  ON funnel_events (event_name, event_date, event_hour);

CREATE INDEX IF NOT EXISTS funnel_events_date_idx ON funnel_events (event_date);
