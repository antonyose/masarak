CREATE TABLE IF NOT EXISTS behavior_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path TEXT,
  product TEXT,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS behavior_events_occurred_idx
  ON behavior_events (occurred_at);

CREATE INDEX IF NOT EXISTS behavior_events_name_occurred_idx
  ON behavior_events (event_name, occurred_at);

CREATE INDEX IF NOT EXISTS behavior_events_session_occurred_idx
  ON behavior_events (session_id, occurred_at);

COMMENT ON TABLE behavior_events IS
  'Privacy-preserving anonymous session analytics. Never stores seat numbers, names, or IP addresses.';
