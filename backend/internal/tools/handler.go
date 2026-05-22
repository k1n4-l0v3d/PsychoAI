package tools

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type Exercise struct {
	ID          string          `json:"id"`
	Slug        string          `json:"slug"`
	Type        string          `json:"type"`
	TitleRU     string          `json:"title_ru"`
	TitleEN     string          `json:"title_en"`
	ContentJSON json.RawMessage `json:"content"`
	DurationSec int             `json:"duration_sec"`
}

type CompletedExercise struct {
	ID          string    `json:"id"`
	ExerciseID  string    `json:"exercise_id"`
	Slug        string    `json:"slug"`
	CompletedAt time.Time `json:"completed_at"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	typeFilter := r.URL.Query().Get("type")

	var rows pgx.Rows
	var err error

	if typeFilter != "" {
		rows, err = h.db.Query(r.Context(),
			`SELECT id::text, slug, type, title_ru, title_en, content_json, duration_sec FROM exercises WHERE type = $1 ORDER BY slug`,
			typeFilter)
	} else {
		rows, err = h.db.Query(r.Context(),
			`SELECT id::text, slug, type, title_ru, title_en, content_json, duration_sec FROM exercises ORDER BY type, slug`)
	}
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var exercises []Exercise
	for rows.Next() {
		var e Exercise
		if err := rows.Scan(&e.ID, &e.Slug, &e.Type, &e.TitleRU, &e.TitleEN, &e.ContentJSON, &e.DurationSec); err != nil {
			continue
		}
		exercises = append(exercises, e)
	}
	if exercises == nil {
		exercises = []Exercise{}
	}
	respondJSON(w, exercises)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	var e Exercise
	err := h.db.QueryRow(r.Context(),
		`SELECT id::text, slug, type, title_ru, title_en, content_json, duration_sec FROM exercises WHERE slug = $1`,
		slug,
	).Scan(&e.ID, &e.Slug, &e.Type, &e.TitleRU, &e.TitleEN, &e.ContentJSON, &e.DurationSec)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	respondJSON(w, e)
}

func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	slug := chi.URLParam(r, "slug")

	var exerciseID string
	err := h.db.QueryRow(r.Context(),
		`SELECT id::text FROM exercises WHERE slug = $1`, slug,
	).Scan(&exerciseID)
	if err != nil {
		jsonError(w, "exercise not found", http.StatusNotFound)
		return
	}

	var ce CompletedExercise
	err = h.db.QueryRow(r.Context(),
		`INSERT INTO user_exercises (user_id, exercise_id) VALUES ($1, $2) RETURNING id::text, exercise_id::text, completed_at`,
		userID, exerciseID,
	).Scan(&ce.ID, &ce.ExerciseID, &ce.CompletedAt)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	ce.Slug = slug
	w.WriteHeader(http.StatusCreated)
	respondJSON(w, ce)
}

func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	rows, err := h.db.Query(r.Context(),
		`SELECT ue.id::text, ue.exercise_id::text, e.slug, ue.completed_at
		 FROM user_exercises ue JOIN exercises e ON e.id = ue.exercise_id
		 WHERE ue.user_id = $1 ORDER BY ue.completed_at DESC LIMIT 50`,
		userID)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var history []CompletedExercise
	for rows.Next() {
		var ce CompletedExercise
		rows.Scan(&ce.ID, &ce.ExerciseID, &ce.Slug, &ce.CompletedAt)
		history = append(history, ce)
	}
	if history == nil {
		history = []CompletedExercise{}
	}
	respondJSON(w, history)
}

func respondJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
