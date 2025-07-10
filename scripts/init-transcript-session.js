#!/usr/bin/env node
/**
 * Script d'initialisation de session de transcription
 * À utiliser au début de chaque conversation Claude Code
 * 
 * Usage: node scripts/init-transcript-session.js [sessionId]
 */

const { initSession } = require('../src/infrastructure/transcript-integration');

// Obtenir sessionId depuis arguments ou générer automatiquement
const sessionId = process.argv[2] || null;

try {
    const actualSessionId = initSession(sessionId);
    
    if (actualSessionId) {
        console.log(`🎉 Session transcript initialisée avec succès: ${actualSessionId}`);
        console.log(`📁 Les logs seront dans: logs/transcripts/chat_${actualSessionId}.log`);
        console.log(`📊 Métadonnées dans: logs/transcripts/metadata/${actualSessionId}.json`);
        
        // Exporter la session ID pour les autres scripts
        process.env.SESSION_ID = actualSessionId;
        
        console.log(`🔧 Variables d'environnement mises à jour`);
        console.log(`ℹ️  Utilisez 'export SESSION_ID=${actualSessionId}' pour maintenir la session`);
    } else {
        console.error('❌ Erreur lors de l\'initialisation de la session');
        process.exit(1);
    }
    
} catch (error) {
    console.error('❌ Erreur initialisation session:', error.message);
    process.exit(1);
}