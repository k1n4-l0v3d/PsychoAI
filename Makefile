.PHONY: dev dev-backend dev-frontend dev-db stop-db kill migrate db-reset help

BACKEND_DIR := backend
FRONTEND_DIR := frontend

# Запуск всего сразу (в фоне, логи в терминале)
dev:
	@$(MAKE) dev-db
	@echo "Waiting for postgres..."
	@sleep 2
	@$(MAKE) -j2 dev-backend dev-frontend

# Только бэкенд
dev-backend:
	@echo "Starting backend on :8080..."
	cd $(BACKEND_DIR) && go run ./cmd/server/main.go

# Только фронтенд
dev-frontend:
	@echo "Starting frontend on :5173..."
	cd $(FRONTEND_DIR) && npm run dev

# Запуск баз данных (PostgreSQL на 5433 и Redis)
dev-db:
	@echo "Starting PostgreSQL (port 5433) and Redis..."
	brew services start postgresql@16
	brew services start redis
	@echo "Done. PostgreSQL: 127.0.0.1:5433  Redis: 127.0.0.1:6379"

# Убить процессы на портах бэкенда и фронтенда
kill:
	@lsof -ti :8080 | xargs kill -9 2>/dev/null || true
	@lsof -ti :5173 | xargs kill -9 2>/dev/null || true
	@echo "Killed processes on :8080 and :5173"

# Остановка баз данных
stop-db:
	brew services stop postgresql@16
	brew services stop redis

# Применить миграции
migrate:
	@echo "Running migrations..."
	psql -h 127.0.0.1 -p 5433 -U psychai psychai -f $(BACKEND_DIR)/db/migrations/001_init.up.sql
	psql -h 127.0.0.1 -p 5433 -U psychai psychai -f $(BACKEND_DIR)/db/migrations/002_seed_exercises.up.sql
	@echo "Migrations done."

# Пересоздать БД с нуля
db-reset:
	@echo "Resetting database..."
	psql -h 127.0.0.1 -p 5433 -U $(shell whoami) postgres -c "DROP DATABASE IF EXISTS psychai;"
	psql -h 127.0.0.1 -p 5433 -U $(shell whoami) postgres -c "DROP USER IF EXISTS psychai;"
	psql -h 127.0.0.1 -p 5433 -U $(shell whoami) postgres -c "CREATE USER psychai WITH PASSWORD 'psychai';"
	psql -h 127.0.0.1 -p 5433 -U $(shell whoami) postgres -c "CREATE DATABASE psychai OWNER psychai;"
	@$(MAKE) migrate

help:
	@echo ""
	@echo "  make dev            — запустить всё (БД + бэкенд + фронтенд)"
	@echo "  make dev-backend    — только Go сервер (:8080)"
	@echo "  make dev-frontend   — только Vite (:5173)"
	@echo "  make dev-db         — запустить PostgreSQL и Redis"
	@echo "  make stop-db        — остановить PostgreSQL и Redis"
	@echo "  make migrate        — применить миграции"
	@echo "  make db-reset       — пересоздать БД с нуля + миграции"
	@echo "  make kill           — убить процессы на :8080 и :5173"
	@echo ""
