#!/usr/bin/env node
/**
 * Script hook pour capture de transcriptions complètes
 * À utiliser dans les hooks postToolUse de Claude Code
 * 
 * Usage: node scripts/claude-transcript-hook.js
 */

const { logToolFromHook } = require('../src/infrastructure/transcript-integration');

// Lire les données depuis stdin (format JSON de Claude Code)
let inputData = '';

process.stdin.on('data', (chunk) => {
    inputData += chunk;
});

process.stdin.on('end', () => {
    try {
        if (inputData.trim()) {
            // Log pour debug
            console.log(`📝 [DEBUG] Hook reçu: ${inputData.substring(0, 100)}...`);
            
            const toolData = JSON.parse(inputData);
            logToolFromHook(toolData);
            
            console.log(`✅ [SUCCESS] Hook transcript traité avec succès`);
        } else {
            console.log(`⚠️ [WARNING] Hook reçu sans données`);
        }
    } catch (error) {
        console.error('❌ [ERROR] Erreur traitement hook transcript:', error.message);
        console.error('❌ [ERROR] Données reçues:', inputData);
        process.exit(1);
    }
});

process.stdin.on('error', (error) => {
    console.error('❌ [ERROR] Erreur lecture stdin:', error.message);
    process.exit(1);
});

// Timeout augmenté à 10 secondes
setTimeout(() => {
    console.error('⏰ [TIMEOUT] Hook transcript timeout après 10 secondes');
    process.exit(1);
}, 10000);