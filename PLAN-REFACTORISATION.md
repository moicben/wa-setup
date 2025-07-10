# Plan de Refactorisation et Nettoyage Intelligent

## 1. **Nettoyage Dossiers Vides** (23 dossiers)
- Supprimer tous les dossiers vides dans `src/core/`, `src/workflows/`, `src/utils/`, `src/services/`
- Impact: Structure plus claire, réduction complexité

## 2. **Consolidation BlueStack Controllers**
- Fusionner `src/core/bluestack.js` avec `src/services/bluestack/BlueStackController.js`
- Garder uniquement la version services (plus modulaire)
- Impact: Élimination code dupliqué

## 3. **Nettoyage Tests** (5 tests redondants)
- Supprimer: `test-refactored-components.js`, `test-integration-workflow.js`, `test-modular-workflow.js`, `test-performance-comparison.js`, `test-morelogin-integration.js`
- Garder: `test-services-unified.js`, `test-supabase-integration.js`, `test-workflow.js`
- Impact: Tests focalisés, maintenance simplifiée

## 4. **Nettoyage Documentation**
- Supprimer: `2025-07-09-command-messageinit-is-analyzing-your-codebase.txt`, `SAUVETAGE-PHASE-1.md`, `SAUVETAGE-PHASE-1-RAPPORT-FINAL.md`
- Garder: `CLAUDE.md`, `PROJECT_CONTEXT.md`
- Impact: Documentation claire et à jour

## 5. **Nettoyage Fichiers Temporaires**
- Supprimer: `production-test-results-1751998511876.json`, `test-profiles/` (3 fichiers)
- Nettoyer: `screenshots/` (garder 10 essentiels, supprimer 35+ temporaires)
- Impact: ~6MB économisés

## 6. **Correction package.json**
- Supprimer références scripts manquants: `test-phone-parsing.js`, `test-ocr.js`, `test-uk-pricing.js`
- Mettre à jour scripts vers tests existants
- Impact: Élimination erreurs scripts

## 7. **Tests Finaux Obligatoires**
Après cleanup, tester comme si j'étais l'utilisateur:
- `npm test` → Test workflow principal
- `node test-services-unified.js` → Test services/infrastructure 
- `node test-supabase-integration.js` → Test base de données
- `npm start` → Test création compte complet
- `npm run clean` → Test nettoyage

## Résultats Attendus:
- **30% réduction** dossiers et fichiers
- **Structure claire** sans doublons
- **Tests focalisés** et maintenables  
- **Documentation épurée**
- **Fonctionnalité préservée** à 100%

Plan direct, sans sur-complexification, avec validation complète finale.