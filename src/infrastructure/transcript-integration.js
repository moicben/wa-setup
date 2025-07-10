/**
 * Script d'intégration du TranscriptManager avec Claude Code
 * Ce script facilite l'utilisation du TranscriptManager dans les hooks
 */

const { getTranscriptManager } = require('./TranscriptManager');

/**
 * Obtenir l'ID de session actuel depuis les variables d'environnement
 */
function getCurrentSessionId() {
    return process.env.SESSION_ID || `${process.pid}-${new Date().toISOString().replace(/[:.]/g, '')}`;
}

/**
 * Enregistrer une utilisation d'outil via hook
 * Utilisé dans postToolUse
 */
function logToolFromHook(toolData) {
    try {
        const sessionId = getCurrentSessionId();
        const transcriptManager = getTranscriptManager();
        
        // Analyser les données reçues de Claude Code
        const toolName = toolData.tool_name || toolData.name || 'Unknown';
        const parameters = toolData.tool_input || toolData.input || toolData.parameters || {};
        const result = toolData.result || toolData.output || {};
        
        // Déterminer l'outcome basé sur plusieurs critères
        let outcome = 'success';
        if (result.stderr || result.error) {
            outcome = 'error';
        } else if (result.stdout && result.stdout.includes('warning')) {
            outcome = 'warning';
        }
        
        // Initialiser la session si nécessaire
        if (!transcriptManager.getSessionMetadata(sessionId)) {
            transcriptManager.initializeSession(sessionId);
        }
        
        transcriptManager.logToolUse(sessionId, toolName, parameters, result, outcome);
        
        // Log également dans le format existant pour compatibilité
        console.log(`🛠️ [${new Date().toLocaleString()}] ${toolName} - ${outcome}`);
        
    } catch (error) {
        console.error('❌ [ERROR] Erreur logging outil:', error.message);
        console.error('❌ [ERROR] Données tool:', JSON.stringify(toolData, null, 2));
    }
}

/**
 * Enregistrer le début d'une session
 */
function initSession(sessionId = null) {
    try {
        const actualSessionId = sessionId || getCurrentSessionId();
        const transcriptManager = getTranscriptManager();
        
        transcriptManager.initializeSession(actualSessionId);
        console.log(`📝 Session transcript initialisée: ${actualSessionId}`);
        
        return actualSessionId;
    } catch (error) {
        console.error('Erreur initialisation session:', error.message);
        return null;
    }
}

/**
 * Enregistrer la fin d'une session
 */
function finalizeSession(sessionId = null, summary = null) {
    try {
        const actualSessionId = sessionId || getCurrentSessionId();
        const transcriptManager = getTranscriptManager();
        
        transcriptManager.finalizeSession(actualSessionId, summary);
        console.log(`🏁 Session finalisée: ${actualSessionId}`);
        
    } catch (error) {
        console.error('Erreur finalisation session:', error.message);
    }
}

module.exports = {
    logToolFromHook,
    initSession,
    finalizeSession,
    getCurrentSessionId
};