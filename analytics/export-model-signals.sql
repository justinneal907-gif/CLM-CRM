-- Replace YOUR_PROJECT.YOUR_DATASET with your GA4 BigQuery export dataset.
-- Set the inclusive date window. Daily tables only; do not union intraday duplicates.
WITH events AS (
 SELECT event_name, FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E3SZ', TIMESTAMP_MICROS(event_timestamp), 'UTC') AS timestamp,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='clm_submission') AS submission_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='clm_model') AS model_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key='clm_position') AS position,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='clm_visitor') AS visitor_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='clm_session') AS session_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key='traffic_type') AS traffic_type
 FROM `YOUR_PROJECT.YOUR_DATASET.events_*`
 WHERE _TABLE_SUFFIX BETWEEN '20260923' AND '20260930'
 AND event_name IN ('model_view','model_interaction')
)
SELECT * FROM events
WHERE submission_id IS NOT NULL AND COALESCE(traffic_type,'') <> 'internal';
