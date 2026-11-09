# Developer shortcuts (Linux/macOS/Git Bash). Windows PowerShell: scripts/mf.ps1
# Variables come from the environment; see .env.example.

.PHONY: help fmt vet test test-integration migrate run demo web up down

help:
	@echo "fmt | vet | test | test-integration | migrate | run | demo | web | up | down"

fmt:
	cd backend && gofmt -w .

vet:
	cd backend && go vet ./... && go vet -tags=integration ./...

test:
	cd backend && go test -count=1 ./...
	cd frontend && npm test

# Needs MF_TEST_DATABASE_DSN pointing at a disposable *_test database.
test-integration:
	cd backend && go test -tags=integration -count=1 -v ./tests/integration/...

migrate:
	cd backend && go run ./cmd/migrate

run:
	cd backend && go run ./cmd/api

demo:
	cd backend && go run ./cmd/demo -base http://127.0.0.1:8080

web:
	cd frontend && npm run dev

up:
	docker compose up --build

down:
	docker compose down
