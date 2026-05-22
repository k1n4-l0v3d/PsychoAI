package resources

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"psychai/internal/auth"
)

type Handler struct {
	db         *pgxpool.Pool
	tavilyKey  string
	httpClient *http.Client
}

func NewHandler(db *pgxpool.Pool, tavilyKey string) *Handler {
	return &Handler{db: db, tavilyKey: tavilyKey, httpClient: &http.Client{Timeout: 10 * time.Second}}
}

type SearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Content string `json:"content"`
	Score   float64 `json:"score"`
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	q := r.URL.Query().Get("q")
	if q == "" {
		jsonError(w, "q parameter required", http.StatusBadRequest)
		return
	}

	var cachedJSON json.RawMessage
	err := h.db.QueryRow(r.Context(),
		`SELECT results_json FROM resources WHERE user_id = $1 AND query = $2`,
		userID, q,
	).Scan(&cachedJSON)
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.Write(cachedJSON)
		return
	}

	results, err := h.tavilySearch(q)
	if err != nil {
		jsonError(w, "search error: "+err.Error(), http.StatusBadGateway)
		return
	}

	resultsJSON, _ := json.Marshal(results)
	h.db.Exec(r.Context(),
		`INSERT INTO resources (user_id, query, results_json) VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, query) DO UPDATE SET results_json = $3, created_at = NOW()`,
		userID, q, resultsJSON)

	w.Header().Set("Content-Type", "application/json")
	w.Write(resultsJSON)
}

func (h *Handler) tavilySearch(query string) ([]SearchResult, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"api_key":        h.tavilyKey,
		"query":          query + " психология психологическая помощь",
		"search_depth":   "basic",
		"max_results":    8,
		"include_answer": false,
	})

	resp, err := h.httpClient.Post("https://api.tavily.com/search", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tavily returned %d", resp.StatusCode)
	}

	var tavilyResp struct {
		Results []struct {
			Title   string  `json:"title"`
			URL     string  `json:"url"`
			Content string  `json:"content"`
			Score   float64 `json:"score"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tavilyResp); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(tavilyResp.Results))
	for _, r := range tavilyResp.Results {
		results = append(results, SearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Content: r.Content,
			Score:   r.Score,
		})
	}
	return results, nil
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
