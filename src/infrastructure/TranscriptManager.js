/**
 * TranscriptManager - Système de gestion des transcriptions complètes
 * Phase 6: Infrastructure Simple - Extension pour transcriptions conversationnelles
 * 
 * Gère la transcription complète des conversations Claude Code:
 * - Capture toutes les interactions utilisateur/Claude
 * - Intègre avec le système de hooks postToolUse
 * - Maintient un fichier unique par session de conversation
 * - Inclut les réflexions, demandes, et outcomes
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('./Logger');

class TranscriptManager {
    constructor(config = {}) {
        this.config = {
            transcriptsDir: config.transcriptsDir || 'logs/transcripts',
            metadataDir: config.metadataDir || 'logs/transcripts/metadata',
            archiveDir: config.archiveDir || 'logs/transcripts/archives',
            maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
            enableArchiving: config.enableArchiving !== false,
            timestampFormat: config.timestampFormat || 'YYYY-MM-DD HH:mm:ss',
            ...config
        };
        
        this.logger = getLogger();
        this.currentSession = null;
        this.conversationMetadata = {};
        
        this.setupDirectories();
    }

    /**
     * Créer les dossiers nécessaires
     */
    setupDirectories() {
        [this.config.transcriptsDir, this.config.metadataDir, this.config.archiveDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * Initialiser une nouvelle session de conversation
     */
    initializeSession(sessionId) {
        this.currentSession = sessionId;
        this.conversationMetadata[sessionId] = {
            sessionId,
            startTime: new Date().toISOString(),
            userRequests: [],
            claudeResponses: [],
            toolUses: [],
            outcomes: [],
            totalInteractions: 0,
            lastUpdate: new Date().toISOString()
        };
        
        const transcriptFile = this.getTranscriptPath(sessionId);
        const header = this.formatConversationHeader(sessionId);
        
        fs.writeFileSync(transcriptFile, header);
        this.saveMetadata(sessionId);
        
        this.logger.info(`Session transcript initialisée: ${sessionId}`);
        return transcriptFile;
    }

    /**
     * Obtenir le chemin du fichier de transcript
     */
    getTranscriptPath(sessionId) {
        return path.join(this.config.transcriptsDir, `chat_${sessionId}.log`);
    }

    /**
     * Formater l'en-tête de conversation
     */
    formatConversationHeader(sessionId) {
        const timestamp = new Date().toLocaleString('fr-FR');
        return `# 📝 TRANSCRIPT DE CONVERSATION CLAUDE CODE
# Session ID: ${sessionId}
# Démarré le: ${timestamp}
# Système: Claude Code - Transcription complète des interactions
#
# ================================================================================
# HISTORIQUE COMPLET - Toutes demandes, réflexions et outcomes
# ================================================================================

`;
    }

    /**
     * Enregistrer une demande utilisateur
     */
    logUserRequest(sessionId, request, context = {}) {
        if (!this.conversationMetadata[sessionId]) {
            this.initializeSession(sessionId);
        }
        
        const timestamp = new Date().toLocaleString('fr-FR');
        const metadata = this.conversationMetadata[sessionId];
        
        metadata.userRequests.push({
            timestamp: new Date().toISOString(),
            request: request,
            context: context
        });
        
        const entry = `
## 👤 DEMANDE UTILISATEUR [${timestamp}]
${request}
${context.priority ? `**Priorité:** ${context.priority}` : ''}
${context.context ? `**Contexte:** ${context.context}` : ''}

`;
        
        this.appendToTranscript(sessionId, entry);
        this.updateMetadata(sessionId);
    }

    /**
     * Enregistrer une réflexion/réponse de Claude
     */
    logClaudeResponse(sessionId, response, type = 'reflection', context = {}) {
        if (!this.conversationMetadata[sessionId]) {
            this.initializeSession(sessionId);
        }
        
        const timestamp = new Date().toLocaleString('fr-FR');
        const metadata = this.conversationMetadata[sessionId];
        
        metadata.claudeResponses.push({
            timestamp: new Date().toISOString(),
            response: response,
            type: type,
            context: context
        });
        
        const typeEmoji = {
            reflection: '🤔',
            analysis: '🔍',
            planning: '📋',
            implementation: '⚙️',
            explanation: '📖',
            error: '❌',
            success: '✅'
        };
        
        const entry = `
## ${typeEmoji[type] || '💭'} RÉFLEXION CLAUDE [${timestamp}] - ${type.toUpperCase()}
${response}
${context.reasoning ? `\n**Raisonnement:** ${context.reasoning}` : ''}
${context.nextSteps ? `\n**Prochaines étapes:** ${context.nextSteps}` : ''}

`;
        
        this.appendToTranscript(sessionId, entry);
        this.updateMetadata(sessionId);
    }

    /**
     * Enregistrer l'utilisation d'un outil (pour hook postToolUse)
     */
    logToolUse(sessionId, toolName, parameters, result, outcome = 'success') {
        if (!this.conversationMetadata[sessionId]) {
            this.initializeSession(sessionId);
        }
        
        const timestamp = new Date().toLocaleString('fr-FR');
        const metadata = this.conversationMetadata[sessionId];
        
        const toolUse = {
            timestamp: new Date().toISOString(),
            toolName: toolName,
            parameters: parameters,
            result: result,
            outcome: outcome
        };
        
        metadata.toolUses.push(toolUse);
        
        const outcomeEmoji = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            partial: '🔄'
        };
        
        const entry = `
## 🛠️ UTILISATION OUTIL [${timestamp}] ${outcomeEmoji[outcome]} ${outcome.toUpperCase()}
**Outil:** ${toolName}
**Paramètres:** ${JSON.stringify(parameters, null, 2)}
**Résultat:** 
\`\`\`
${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
\`\`\`

`;
        
        this.appendToTranscript(sessionId, entry);
        this.updateMetadata(sessionId);
    }

    /**
     * Enregistrer un outcome/résultat final
     */
    logOutcome(sessionId, outcome, details = {}) {
        if (!this.conversationMetadata[sessionId]) {
            this.initializeSession(sessionId);
        }
        
        const timestamp = new Date().toLocaleString('fr-FR');
        const metadata = this.conversationMetadata[sessionId];
        
        metadata.outcomes.push({
            timestamp: new Date().toISOString(),
            outcome: outcome,
            details: details
        });
        
        const entry = `
## 🎯 OUTCOME FINAL [${timestamp}]
**Résultat:** ${outcome}
${details.summary ? `**Résumé:** ${details.summary}` : ''}
${details.filesModified ? `**Fichiers modifiés:** ${details.filesModified.join(', ')}` : ''}
${details.nextActions ? `**Actions suivantes recommandées:** ${details.nextActions}` : ''}

`;
        
        this.appendToTranscript(sessionId, entry);
        this.updateMetadata(sessionId);
    }

    /**
     * Ajouter du contenu au transcript
     */
    appendToTranscript(sessionId, content) {
        const transcriptFile = this.getTranscriptPath(sessionId);
        
        try {
            // Vérifier la taille du fichier
            if (fs.existsSync(transcriptFile)) {
                const stats = fs.statSync(transcriptFile);
                if (stats.size > this.config.maxFileSize) {
                    this.archiveTranscript(sessionId);
                    this.initializeSession(sessionId); // Redémarrer un nouveau fichier
                }
            }
            
            fs.appendFileSync(transcriptFile, content);
            
        } catch (error) {
            this.logger.error(`Erreur écriture transcript ${sessionId}:`, { error: error.message });
        }
    }

    /**
     * Mettre à jour les métadonnées
     */
    updateMetadata(sessionId) {
        if (!this.conversationMetadata[sessionId]) return;
        
        this.conversationMetadata[sessionId].lastUpdate = new Date().toISOString();
        this.conversationMetadata[sessionId].totalInteractions = 
            this.conversationMetadata[sessionId].userRequests.length +
            this.conversationMetadata[sessionId].claudeResponses.length +
            this.conversationMetadata[sessionId].toolUses.length;
            
        this.saveMetadata(sessionId);
    }

    /**
     * Sauvegarder les métadonnées
     */
    saveMetadata(sessionId) {
        const metadataFile = path.join(this.config.metadataDir, `${sessionId}.json`);
        
        try {
            fs.writeFileSync(metadataFile, JSON.stringify(this.conversationMetadata[sessionId], null, 2));
        } catch (error) {
            this.logger.error(`Erreur sauvegarde métadonnées ${sessionId}:`, { error: error.message });
        }
    }

    /**
     * Archiver un transcript
     */
    archiveTranscript(sessionId) {
        if (!this.config.enableArchiving) return;
        
        const transcriptFile = this.getTranscriptPath(sessionId);
        const archiveFile = path.join(this.config.archiveDir, `chat_${sessionId}_${Date.now()}.log`);
        
        try {
            fs.renameSync(transcriptFile, archiveFile);
            this.logger.info(`Transcript archivé: ${sessionId} -> ${archiveFile}`);
        } catch (error) {
            this.logger.error(`Erreur archivage transcript ${sessionId}:`, { error: error.message });
        }
    }

    /**
     * Finaliser une session
     */
    finalizeSession(sessionId, summary = null) {
        if (!this.conversationMetadata[sessionId]) return;
        
        const timestamp = new Date().toLocaleString('fr-FR');
        const metadata = this.conversationMetadata[sessionId];
        metadata.endTime = new Date().toISOString();
        
        const finalEntry = `
# ================================================================================
# 🏁 FIN DE CONVERSATION [${timestamp}]
# ================================================================================

## 📊 STATISTIQUES DE SESSION
- **Durée totale:** ${this.calculateSessionDuration(sessionId)}
- **Demandes utilisateur:** ${metadata.userRequests.length}
- **Réponses Claude:** ${metadata.claudeResponses.length}
- **Outils utilisés:** ${metadata.toolUses.length}
- **Outcomes:** ${metadata.outcomes.length}
- **Total interactions:** ${metadata.totalInteractions}

${summary ? `## 📝 RÉSUMÉ FINAL\n${summary}\n` : ''}

# Fin du transcript - Session ${sessionId}
`;

        this.appendToTranscript(sessionId, finalEntry);
        this.updateMetadata(sessionId);
        
        this.logger.info(`Session finalisée: ${sessionId}`);
    }

    /**
     * Calculer la durée de session
     */
    calculateSessionDuration(sessionId) {
        const metadata = this.conversationMetadata[sessionId];
        if (!metadata || !metadata.startTime) return 'Inconnue';
        
        const start = new Date(metadata.startTime);
        const end = metadata.endTime ? new Date(metadata.endTime) : new Date();
        const duration = Math.round((end - start) / 1000 / 60); // en minutes
        
        return `${duration} minutes`;
    }

    /**
     * Obtenir les métadonnées d'une session
     */
    getSessionMetadata(sessionId) {
        return this.conversationMetadata[sessionId] || null;
    }

    /**
     * Rechercher dans les transcripts
     */
    searchTranscripts(query, sessionId = null) {
        const searchResults = [];
        const searchPattern = new RegExp(query, 'gi');
        
        try {
            if (sessionId) {
                // Recherche dans une session spécifique
                const transcriptFile = this.getTranscriptPath(sessionId);
                if (fs.existsSync(transcriptFile)) {
                    const content = fs.readFileSync(transcriptFile, 'utf8');
                    const matches = content.match(searchPattern);
                    if (matches) {
                        searchResults.push({ sessionId, matches: matches.length });
                    }
                }
            } else {
                // Recherche dans tous les transcripts
                const files = fs.readdirSync(this.config.transcriptsDir);
                for (const file of files) {
                    if (file.startsWith('chat_') && file.endsWith('.log')) {
                        const filePath = path.join(this.config.transcriptsDir, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        const matches = content.match(searchPattern);
                        if (matches) {
                            const sessionIdFromFile = file.replace('chat_', '').replace('.log', '');
                            searchResults.push({ sessionId: sessionIdFromFile, matches: matches.length });
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Erreur recherche transcripts:', { error: error.message });
        }
        
        return searchResults;
    }
}

// Instance globale
let globalTranscriptManager = null;

/**
 * Obtenir l'instance globale du TranscriptManager
 */
function getTranscriptManager(config = {}) {
    if (!globalTranscriptManager) {
        globalTranscriptManager = new TranscriptManager(config);
    }
    return globalTranscriptManager;
}

module.exports = { TranscriptManager, getTranscriptManager };