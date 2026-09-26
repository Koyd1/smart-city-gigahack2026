COMPOSE := docker compose
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: dev stop build logs logs-backend migrate migrate-dev seed shell-backend shell-db prod-up prod-down prod-build prod-preflight

dev:
	$(COMPOSE) up --build

stop:
	$(COMPOSE) down

build:
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f backend

migrate:
	cd frontend && node scripts/run-with-root-env.cjs npx prisma generate
	cd frontend && node scripts/run-with-root-env.cjs npx prisma migrate deploy
	$(COMPOSE) exec backend sh -lc "alembic upgrade head"

migrate-dev:
	cd frontend && node scripts/run-with-root-env.cjs npx prisma migrate dev

seed:
	cd frontend && node scripts/run-with-root-env.cjs npx prisma generate
	cd frontend && node scripts/run-with-root-env.cjs npx prisma db seed

shell-backend:
	$(COMPOSE) exec backend sh

shell-db:
	@echo "Use your Neon DATABASE_URL with psql or Neon CLI"

prod-build:
	$(COMPOSE_PROD) build

prod-up:
	$(COMPOSE_PROD) up -d --build

prod-down:
	$(COMPOSE_PROD) down

prod-preflight:
	./scripts/preflight_prod.sh .env
