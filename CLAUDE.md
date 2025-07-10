# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Application
- `npm start` - Creates a UK WhatsApp account (default)
- `npm run create-uk` - Creates a UK WhatsApp account
- `npm run create-fr` - Creates a French WhatsApp account  
- `npm run create-us` - Creates a US WhatsApp account
- `npm run setup` - Sets up SMS API configuration

### MoreLogin Cloud Mode
- `ENABLE_CLOUD=true npm start` - Creates account using MoreLogin cloud profiles
- `ENABLE_CLOUD=true npm run create-uk` - UK account with MoreLogin cloud
- `ENABLE_CLOUD=true npm run create-fr` - FR account with MoreLogin cloud

### Testing
- `npm test` - Runs main workflow tests
- `npm run test-parsing` - Tests phone number parsing
- `npm run test-ocr` - Tests OCR functionality
- `npm run test-uk-pricing` - Tests UK pricing scenarios

### Database Testing
- `node test-supabase-integration.js` - Tests Supabase integration (35 tests)
- `node test-supabase-tables.js` - Tests database tables creation
- `node src/database/test-database.js` - Tests database modules

### Services & Infrastructure Testing
- `node test-services-unified.js` - Tests unified services and infrastructure (Phase 5-7)

### MoreLogin Integration Testing
- `node test-morelogin-integration-complete.js` - Complete MoreLogin integration test suite
- `node test-morelogin-integration-complete.js --basic` - Basic MoreLogin API connectivity test
- `node test-morelogin-api-real.js` - Test real MoreLogin API connection
- `node test-morelogin-provider.js` - Test MoreLogin device provider
- `node test-workflow-morelogin.js` - Test workflow with MoreLogin integration

### Maintenance & Cleanup
- `npm run clean` - Removes screenshots, temp files, and logs
- `ENABLE_GLOBAL_SMS_CLEANUP=true npm start` - Run with global SMS cleanup enabled
- Global SMS cleanup automatically cancels all active SMS numbers at workflow end

### Transcription System
- `node test-transcript-system.js` - Tests the complete conversation transcript system
- Transcripts are automatically captured in `logs/transcripts/` with postToolUse hooks
- Metadata and conversation analytics available in `logs/transcripts/metadata/`

## Testing Guidelines
- Stock tous les tests dans un dossier spécifique

## Instruction Handling
- Opte pour des réponses courtes quand je te pose des question sans trop de structure

## Language Instructions
- Réponds toujours en francais