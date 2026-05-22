package chat

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
	"psychai/internal/i18n"
)

type Handler struct {
	db   *pgxpool.Pool
	groq *GroqClient
}

func NewHandler(db *pgxpool.Pool, groq *GroqClient) *Handler {
	return &Handler{db: db, groq: groq}
}

type Session struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}

type Message struct {
	ID        string    `json:"id"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	rows, err := h.db.Query(r.Context(),
		`SELECT id::text, title, created_at FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
		userID)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.Title, &s.CreatedAt); err != nil {
			continue
		}
		sessions = append(sessions, s)
	}
	if sessions == nil {
		sessions = []Session{}
	}
	respondJSON(w, sessions)
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	var req struct {
		Title string `json:"title"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Title == "" {
		req.Title = "Новая беседа"
	}

	var s Session
	err := h.db.QueryRow(r.Context(),
		`INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id::text, title, created_at`,
		userID, req.Title,
	).Scan(&s.ID, &s.Title, &s.CreatedAt)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	respondJSON(w, s)
}

func (h *Handler) RenameSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	sessionID := chi.URLParam(r, "id")

	var req struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		jsonError(w, "title required", http.StatusBadRequest)
		return
	}

	tag, err := h.db.Exec(r.Context(),
		`UPDATE chat_sessions SET title = $1 WHERE id = $2 AND user_id = $3`,
		req.Title, sessionID, userID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	sessionID := chi.URLParam(r, "id")

	tag, err := h.db.Exec(r.Context(),
		`DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2`,
		sessionID, userID)
	if err != nil || tag.RowsAffected() == 0 {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	sessionID := chi.URLParam(r, "id")

	var ownerID string
	err := h.db.QueryRow(r.Context(),
		`SELECT user_id::text FROM chat_sessions WHERE id = $1`, sessionID,
	).Scan(&ownerID)
	if err != nil || ownerID != userID {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id::text, role, content, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 100`,
		sessionID)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			continue
		}
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []Message{}
	}
	respondJSON(w, msgs)
}

func (h *Handler) Chat(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	sessionID := chi.URLParam(r, "id")

	var ownerID string
	var userLang string
	err := h.db.QueryRow(r.Context(),
		`SELECT cs.user_id::text, u.lang FROM chat_sessions cs JOIN users u ON u.id = cs.user_id WHERE cs.id = $1`,
		sessionID,
	).Scan(&ownerID, &userLang)
	if err != nil || ownerID != userID {
		jsonError(w, "not found", http.StatusNotFound)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Content == "" {
		jsonError(w, "content required", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(r.Context(),
		`INSERT INTO messages (session_id, role, content) VALUES ($1, 'user', $2)`,
		sessionID, req.Content)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20`,
		sessionID)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	var recentMsgs []groqMessage
	for rows.Next() {
		var m groqMessage
		rows.Scan(&m.Role, &m.Content)
		recentMsgs = append(recentMsgs, m)
	}
	rows.Close()
	for i, j := 0, len(recentMsgs)-1; i < j; i, j = i+1, j-1 {
		recentMsgs[i], recentMsgs[j] = recentMsgs[j], recentMsgs[i]
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		jsonError(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")

	systemPrompt := i18n.GetSystemPrompt(userLang)
	fullText, err := h.groq.Stream(w, flusher, systemPrompt, recentMsgs)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}

	h.db.Exec(r.Context(),
		`INSERT INTO messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
		sessionID, fullText)

	chips := analyzeChips(fullText)
	chipsJSON, _ := json.Marshal(chips)
	fmt.Fprintf(w, "event: chips\ndata: %s\n\n", string(chipsJSON))
	flusher.Flush()
}

// newSessionID generates a new UUID string for use in responses
func newSessionID() string {
	return uuid.New().String()
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
