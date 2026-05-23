CREATE TABLE mood_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, entry_date);
