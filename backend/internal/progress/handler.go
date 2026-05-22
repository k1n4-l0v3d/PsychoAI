package progress

import (
	"context"
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

type DayMood struct {
	Date string  `json:"date"`
	Avg  float64 `json:"avg"`
}

type Badge struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Icon  string `json:"icon"`
}

type ProgressData struct {
	MoodChart      []DayMood  `json:"mood_chart"`
	MoodAvgWeek    float64    `json:"mood_avg_week"`
	DiaryStreak    int        `json:"diary_streak"`
	ExerciseStreak int        `json:"exercise_streak"`
	ExercisesCount int        `json:"exercises_count"`
	ExercisesWeek  int        `json:"exercises_week"`
	DiaryCount     int        `json:"diary_count"`
	DiaryLastAt    *time.Time `json:"diary_last_at"`
	Badges         []Badge    `json:"badges"`
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID := auth.GetUserID(r)
	ctx := r.Context()

	moodRows, err := h.db.Query(ctx,
		`SELECT DATE(created_at)::TEXT, AVG(mood)::FLOAT8
		 FROM diary_entries WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`,
		userID)
	if err != nil {
		jsonError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer moodRows.Close()

	var moodChart []DayMood
	for moodRows.Next() {
		var d DayMood
		moodRows.Scan(&d.Date, &d.Avg)
		moodChart = append(moodChart, d)
	}
	if moodChart == nil {
		moodChart = []DayMood{}
	}

	var moodAvgWeek float64
	h.db.QueryRow(ctx,
		`SELECT COALESCE(AVG(mood), 0)::FLOAT8 FROM diary_entries
		 WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
		userID).Scan(&moodAvgWeek)

	var exercisesWeek int
	h.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM user_exercises
		 WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'`,
		userID).Scan(&exercisesWeek)

	var diaryLastAt *time.Time
	h.db.QueryRow(ctx,
		`SELECT MAX(created_at) FROM diary_entries WHERE user_id = $1`,
		userID).Scan(&diaryLastAt)

	diaryStreak := h.calcStreak(ctx, userID,
		`SELECT DISTINCT DATE(created_at) FROM diary_entries WHERE user_id = $1 ORDER BY 1 DESC LIMIT 60`)
	exerciseStreak := h.calcStreak(ctx, userID,
		`SELECT DISTINCT DATE(completed_at) FROM user_exercises WHERE user_id = $1 ORDER BY 1 DESC LIMIT 60`)

	var badges []Badge
	var diaryCount, exerciseCount int
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM diary_entries WHERE user_id = $1`, userID).Scan(&diaryCount)
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM user_exercises WHERE user_id = $1`, userID).Scan(&exerciseCount)

	if diaryCount >= 1 {
		badges = append(badges, Badge{"first_diary", "Первая запись", "📔"})
	}
	if exerciseCount >= 1 {
		badges = append(badges, Badge{"first_exercise", "Первое упражнение", "🧘"})
	}
	if diaryStreak >= 7 || exerciseStreak >= 7 {
		badges = append(badges, Badge{"week_streak", "Неделя подряд", "🔥"})
	}
	if diaryCount >= 30 {
		badges = append(badges, Badge{"diary_30", "30 записей", "⭐"})
	}
	if badges == nil {
		badges = []Badge{}
	}

	respondJSON(w, ProgressData{
		MoodChart:      moodChart,
		MoodAvgWeek:    moodAvgWeek,
		DiaryStreak:    diaryStreak,
		ExerciseStreak: exerciseStreak,
		ExercisesCount: exerciseCount,
		ExercisesWeek:  exercisesWeek,
		DiaryCount:     diaryCount,
		DiaryLastAt:    diaryLastAt,
		Badges:         badges,
	})
}

func (h *Handler) calcStreak(ctx context.Context, userID, query string) int {
	rows, err := h.db.Query(ctx, query, userID)
	if err != nil {
		return 0
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var d time.Time
		rows.Scan(&d)
		dates = append(dates, d)
	}

	if len(dates) == 0 {
		return 0
	}

	today := time.Now().Truncate(24 * time.Hour)
	streak := 0
	expected := today

	for _, d := range dates {
		day := d.Truncate(24 * time.Hour)
		if day.Equal(expected) || day.Equal(expected.Add(-24*time.Hour)) {
			streak++
			expected = day.Add(-24 * time.Hour)
		} else {
			break
		}
	}
	return streak
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
