package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"psychai/internal/auth"
	"psychai/internal/chat"
	"psychai/internal/diary"
	"psychai/internal/mood"
	"psychai/internal/progress"
	"psychai/internal/resources"
	"psychai/internal/tools"
)

func main() {
	godotenv.Load(".env", "../.env", "../../.env")

	dbURL := mustEnv("DATABASE_URL")
	redisURL := mustEnv("REDIS_URL")
	jwtSecret := mustEnv("JWT_SECRET")
	groqKey := mustEnv("GROQ_API_KEY")
	tavilyKey := mustEnv("TAVILY_API_KEY")
	port := getEnv("PORT", "8080")

	db, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("cannot connect to postgres: %v", err)
	}
	defer db.Close()

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("invalid redis URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	authSvc := auth.NewService(db, rdb, jwtSecret)
	authHandler := auth.NewHandler(authSvc)
	chatHandler := chat.NewHandler(db, chat.NewGroqClient(groqKey))
	diaryHandler := diary.NewHandler(db)
	toolsHandler := tools.NewHandler(db)
	resourcesHandler := resources.NewHandler(db, tavilyKey)
	progressHandler := progress.NewHandler(db)
	moodHandler := mood.NewHandler(db)

	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Post("/auth/register", authHandler.Register)
	r.Post("/auth/login", authHandler.Login)
	r.Post("/auth/refresh", authHandler.Refresh)
	r.Post("/auth/logout", authHandler.Logout)

	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware(authSvc))

		r.Get("/api/user", authHandler.GetProfile)
		r.Put("/api/user", authHandler.UpdateProfile)

		r.Get("/api/sessions", chatHandler.ListSessions)
		r.Post("/api/sessions", chatHandler.CreateSession)
		r.Patch("/api/sessions/{id}", chatHandler.RenameSession)
		r.Delete("/api/sessions/{id}", chatHandler.DeleteSession)
		r.Get("/api/sessions/{id}/messages", chatHandler.GetMessages)
		r.Post("/api/sessions/{id}/chat", chatHandler.Chat)

		r.Get("/api/diary", diaryHandler.List)
		r.Post("/api/diary", diaryHandler.Create)
		r.Put("/api/diary/{id}", diaryHandler.Update)
		r.Delete("/api/diary/{id}", diaryHandler.Delete)

		r.Get("/api/exercises", toolsHandler.List)
		r.Get("/api/exercises/{slug}", toolsHandler.Get)
		r.Post("/api/exercises/{slug}/complete", toolsHandler.Complete)
		r.Get("/api/exercises/history", toolsHandler.History)

		r.Get("/api/resources/search", resourcesHandler.Search)

		r.Get("/api/progress", progressHandler.Get)

		r.Post("/api/mood", moodHandler.Upsert)
		r.Get("/api/mood/today", moodHandler.Today)
		r.Get("/api/mood/calendar", moodHandler.Calendar)
	})

	log.Printf("Server listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
