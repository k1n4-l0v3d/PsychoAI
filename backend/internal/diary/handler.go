package diary

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type Entry struct {
	ID        string    `json:"id"`
	Mood      int       `json:"mood"`
	Text      string    `json:"text"`
	Tags      []string  `json:"tags"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * 20

	rows, err := h.db.Query(r.Context(),
		`SELECT id::text, mood, text, tags, created_at FROM diary_entries
		 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET $2`,
		userID, offset)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.Mood, &e.Text, &e.Tags, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []Entry{}
	}
	respondJSON(w, entries)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var req struct {
		Mood int      `json:"mood"`
		Text string   `json:"text"`
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Mood < 1 || req.Mood > 10 {
		jsonError(w, "mood must be 1-10", http.StatusBadRequest)
		return
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	var e Entry
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO diary_entries (user_id, mood, text, tags) VALUES ($1, $2, $3, $4)
		 RETURNING id::text, mood, text, tags, created_at`,
		userID, req.Mood, req.Text, req.Tags,
	).Scan(&e.ID, &e.Mood, &e.Text, &e.Tags, &e.CreatedAt)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	respondJSON(w, e)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	entryID := chi.URLParam(r, "id")

	var req struct {
		Mood int      `json:"mood"`
		Text string   `json:"text"`
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}

	var e Entry
	err := h.db.QueryRow(r.Context(),
		`UPDATE diary_entries SET mood = $1, text = $2, tags = $3
		 WHERE id = $4 AND user_id = $5
		 RETURNING id::text, mood, text, tags, created_at`,
		req.Mood, req.Text, req.Tags, entryID, userID,
	).Scan(&e.ID, &e.Mood, &e.Text, &e.Tags, &e.CreatedAt)
	if err != nil {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	respondJSON(w, e)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	entryID := chi.URLParam(r, "id")

	tag, err := h.db.Exec(r.Context(),
		`DELETE FROM diary_entries WHERE id = $1 AND user_id = $2`,
		entryID, userID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
