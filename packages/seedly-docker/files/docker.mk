# seedly-docker — include from your Seedly folder:
#   make -f docker.mk docker-up
#
# Or add this line to your own Makefile:
#   include docker.mk

.PHONY: docker-env docker-up docker-up-backend docker-up-prod docker-down docker-logs docker-ps docker-reset docker-admin-key docker-seed

COMPOSE := docker compose
ENV_FILE := .env.docker

docker-env: ## Create .env.docker and generate empty secrets
	@bash docker/generate-env.sh

docker-up: docker-env ## Build and start Convex + Next.js (dev, hot reload)
	$(COMPOSE) --env-file $(ENV_FILE) up --build

docker-up-backend: docker-env ## Convex only — run Next.js on the host (hot reload)
	@$(COMPOSE) --env-file $(ENV_FILE) stop web 2>/dev/null || true
	INTERNAL_APP_URL=http://host.docker.internal:3100 $(COMPOSE) --env-file $(ENV_FILE) up --build -d convex-backend convex-dashboard convex-init convex-sync
	@echo "Convex is up. Copy apps/web/.env.docker-hybrid.example to apps/web/.env.local if needed,"
	@echo "then: npx pnpm --filter @seedly-crm/web exec next dev --port 3100"

docker-up-prod: docker-env ## Production-like images (no bind mounts)
	$(COMPOSE) --env-file $(ENV_FILE) -f compose.yaml -f compose.prod.yaml up --build

docker-down: ## Stop containers (keep volumes)
	$(COMPOSE) --env-file $(ENV_FILE) down

docker-logs: ## Follow all container logs
	$(COMPOSE) --env-file $(ENV_FILE) logs -f

docker-ps: ## Show compose services
	$(COMPOSE) --env-file $(ENV_FILE) ps

docker-admin-key: ## Print the self-hosted Convex admin key
	@$(COMPOSE) --env-file $(ENV_FILE) exec convex-backend sh -c './generate_admin_key.sh' || \
		$(COMPOSE) --env-file $(ENV_FILE) run --rm --entrypoint /bin/sh convex-init -c 'cat /keys/admin_key'

docker-seed: ## Load demo CRM data + login accounts into the local Convex backend
	$(COMPOSE) --env-file $(ENV_FILE) run --rm --no-deps --entrypoint /bin/bash convex-sync /app/scripts/docker-seed.sh

docker-reset: ## Stop and delete Convex data + node_modules volumes
	$(COMPOSE) --env-file $(ENV_FILE) down -v
	@echo "Volumes removed. Run make -f docker.mk docker-up to start clean."
