UPDATE exercises
SET content_json = content_json || '{"step_durations": [4, 7, 8]}'::jsonb
WHERE slug = 'breathing-478';

UPDATE exercises
SET content_json = content_json || '{"step_durations": [4, 4, 4, 4]}'::jsonb
WHERE slug = 'box-breathing';
