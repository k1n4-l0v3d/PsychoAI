UPDATE exercises
SET content_json = content_json - 'step_durations'
WHERE slug IN ('breathing-478', 'box-breathing');
