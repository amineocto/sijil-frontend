# Sijil frontend : front unique sijil-web et kit d'interface (ADR 0032, 0037).
# Le backend vit dans le dépôt voisin sijil-kit (BFF, API, contrats).
.DEFAULT_GOAL := help
.PHONY: help ci install secrets vulns awb-ui contract-sync dev dev-bff build

AWB_UI_VERSION := 1.3.0-SNAPSHOT
AWB_UI_TGZ := vendor/awb-ui-$(AWB_UI_VERSION).tgz

help: ## Liste des commandes
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

ci: secrets install vulns ## Vérification complète : secrets, contrat, lint, format, types, tests et axe, build, Playwright, vulnérabilités
	npm run ci

install: $(AWB_UI_TGZ) ## Dépendances exactes du verrou
	npm ci --no-audit --no-fund

awb-ui: ## Construit @awb/ui depuis AWB_UI_SRC (dépôt de la banque) dans vendor/, jamais versionné (ADR 0037)
	scripts/build-awb-ui.sh "$(AWB_UI_SRC)" $(AWB_UI_VERSION) $(AWB_UI_TGZ)

$(AWB_UI_TGZ):
	@echo "$(AWB_UI_TGZ) absent : lancez make awb-ui AWB_UI_SRC=<dépôt awb-ui> (B-032, ADR 0037)"; exit 1

secrets: ## Recherche de secrets : historique git et arbre de travail (gitleaks, bloquant)
	gitleaks git --no-banner --redact --config .gitleaks.toml .
	gitleaks dir --no-banner --redact --config .gitleaks.toml .

vulns: ## Dépendances vulnérables HIGH et CRITICAL (Trivy, bloquant)
	trivy fs --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --quiet .

contract-sync: ## Recopie le contrat du BFF depuis ../sijil-kit puis régénère le client
	npm run contract:sync
	npm run api -w sijil-web

dev: ## Front en développement sur les bouchons MSW
	npm run dev -w sijil-web

dev-bff: ## Front en développement contre le BFF local (make run-admin-channel dans sijil-kit)
	VITE_MOCKS=false npm run dev -w sijil-web

build: ## Build de production, embarqué par admin-channel (voir sijil-kit, channel/admin-channel/pom.xml)
	npm run build -w sijil-web
