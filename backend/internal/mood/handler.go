package mood

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type MoodEntry struct {
	ID        string    `json:"id"`
	Score     int       `json:"score"`
	CreatedAt time.Time `json:"created_at"`
}

type CalendarDay struct {
	Date  string `json:"date"`
	Score int    `json:"score"`
}

// POST /api/mood — upsert mood for today
func (h *Handler) Upsert(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var req struct {
		Score int `json:"score"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Score < 1 || req.Score > 10 {
		jsonError(w, "score must be 1-10", http.StatusBadRequest)
		return
	}

	var e MoodEntry
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO mood_entries (user_id, score, entry_date)
		 VALUES ($1, $2, CURRENT_DATE)
		 ON CONFLICT (user_id, entry_date)
		 DO UPDATE SET score = EXCLUDED.score, created_at = NOW()
		 RETURNING id::text, score, created_at`,
		userID, req.Score,
	).Scan(&e.ID, &e.Score, &e.CreatedAt)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	respondJSON(w, e)
}

// GET /api/mood/today — today's entry or null
func (h *Handler) Today(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var e MoodEntry
	err := h.db.QueryRow(r.Context(),
		`SELECT id::text, score, created_at FROM mood_entries
		 WHERE user_id = $1 AND entry_date = CURRENT_DATE`,
		userID,
	).Scan(&e.ID, &e.Score, &e.CreatedAt)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("null"))
		return
	}
	respondJSON(w, e)
}

// GET /api/mood/calendar?month=2025-05
func (h *Handler) Calendar(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	month := r.URL.Query().Get("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT entry_date::TEXT, score FROM mood_entries
		 WHERE user_id = $1 AND TO_CHAR(entry_date, 'YYYY-MM') = $2
		 ORDER BY entry_date ASC`,
		userID, month,
	)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var days []CalendarDay
	for rows.Next() {
		var d CalendarDay
		rows.Scan(&d.Date, &d.Score)
		days = append(days, d)
	}
	if days == nil {
		days = []CalendarDay{}
	}
	respondJSON(w, days)
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
