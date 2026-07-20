ALTER TABLE analytics_events
    ADD COLUMN device_type VARCHAR(24) NOT NULL DEFAULT 'unknown' AFTER source,
    ADD COLUMN traffic_source VARCHAR(40) NOT NULL DEFAULT 'unknown' AFTER device_type,
    ADD COLUMN traffic_medium VARCHAR(24) NOT NULL DEFAULT 'unknown' AFTER traffic_source,
    ADD KEY idx_analytics_device_occurred (device_type, occurred_at),
    ADD KEY idx_analytics_source_occurred (traffic_source, occurred_at);
