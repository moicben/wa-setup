/**
 * Logger - Version simplifiée unifiée
 * Fusion de Logger + WorkflowLogger avec fonctionnalités essentielles
 */

const fs = require('fs');
const path = require('path');

/**
 * Logger simplifié pour le workflow
 */
class Logger {
    constructor(config = {}) {
        this.config = {
            level: config.level || 'info',
            logToFile: config.logToFile !== false,
            logToConsole: config.logToConsole !== false,
            logDir: config.logDir || './logs',
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: config.maxFiles || 5,
            ...config
        };

        this.levels = {
            error: 0,
            warn: 1, 
            info: 2,
            debug: 3
        };

        this.currentLevel = this.levels[this.config.level] || this.levels.info;
        this.logFileName = null;
        
        // Créer le dossier de logs
        this._ensureLogDirectory();
        
        // Initialiser le fichier de log
        if (this.config.logToFile) {
            this._initializeLogFile();
        }
    }

    /**
     * Créer le dossier de logs
     */
    _ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }
    }

    /**
     * Initialiser le fichier de log
     */
    _initializeLogFile() {
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        this.logFileName = path.join(this.config.logDir, `workflow_${timestamp}.log`);
        
        // Écrire l'en-tête du log
        const header = `\n=== WORKFLOW LOG - ${new Date().toISOString()} ===\n`;
        this._writeToFile(header);
    }

    /**
     * Écrire dans le fichier de log
     */
    _writeToFile(message) {
        if (!this.config.logToFile || !this.logFileName) return;
        
        try {
            fs.appendFileSync(this.logFileName, message);
        } catch (error) {
            console.error('❌ Erreur écriture log:', error.message);
        }
    }

    /**
     * Formater un message de log
     */
    _formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
        
        let formattedMessage = `${prefix} ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` | ${data}`;
            }
        }
        
        return formattedMessage;
    }

    /**
     * Méthode générique de log
     */
    _log(level, message, data = null) {
        const levelNumber = this.levels[level];
        
        if (levelNumber > this.currentLevel) {
            return; // Niveau trop bas, ignorer
        }
        
        const formattedMessage = this._formatMessage(level, message, data);
        
        // Console
        if (this.config.logToConsole) {
            switch (level) {
                case 'error':
                    console.error(formattedMessage);
                    break;
                case 'warn':
                    console.warn(formattedMessage);
                    break;
                case 'debug':
                    console.debug(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        }
        
        // Fichier
        if (this.config.logToFile) {
            this._writeToFile(formattedMessage + '\n');
        }
    }

    /**
     * Méthodes de logging par niveau
     */
    error(message, data = null) {
        this._log('error', message, data);
    }

    warn(message, data = null) {
        this._log('warn', message, data);
    }

    info(message, data = null) {
        this._log('info', message, data);
    }

    debug(message, data = null) {
        this._log('debug', message, data);
    }

    /**
     * Méthodes spécialisées pour le workflow
     */
    logStep(stepName, status = 'info', details = null) {
        const emoji = status === 'error' ? '❌' : status === 'warn' ? '⚠️' : '📋';
        this._log(status, `${emoji} STEP: ${stepName}`, details);
    }

    logWorkflowStart(workflowName, config = {}) {
        const message = `🚀 === DÉBUT WORKFLOW: ${workflowName} ===`;
        this._log('info', message, config);
    }

    logWorkflowSuccess(result = {}) {
        const message = `✅ === WORKFLOW TERMINÉ AVEC SUCCÈS ===`;
        this._log('info', message, result);
    }

    logWorkflowFailure(error, attempt = 1, maxRetries = 1) {
        const message = `❌ === WORKFLOW ÉCHOUÉ (${attempt}/${maxRetries}) ===`;
        this._log('error', message, { 
            error: error.message, 
            stack: error.stack,
            attempt,
            maxRetries 
        });
    }

    logRetryInfo(attempt, maxRetries, delaySeconds) {
        const message = `🔄 Retry ${attempt}/${maxRetries} dans ${delaySeconds}s`;
        this._log('warn', message);
    }

    logMetrics(metrics = {}) {
        const message = `📊 Métriques du workflow`;
        this._log('info', message, metrics);
    }

    logScreenshot(filename, stepName = null) {
        const message = `📸 Screenshot: ${filename}`;
        const details = stepName ? { step: stepName } : null;
        this._log('debug', message, details);
    }

    logSMS(action, details = {}) {
        const emoji = action === 'buy' ? '📞' : action === 'receive' ? '📨' : action === 'cancel' ? '🗑️' : '📱';
        const message = `${emoji} SMS ${action.toUpperCase()}`;
        this._log('info', message, details);
    }

    logDevice(action, details = {}) {
        const emoji = action === 'connect' ? '🔌' : action === 'click' ? '👆' : action === 'input' ? '⌨️' : '📱';
        const message = `${emoji} Device ${action.toUpperCase()}`;
        this._log('debug', message, details);
    }

    /**
     * Nettoyer les anciens fichiers de log
     */
    cleanup() {
        if (!this.config.logToFile) return;
        
        try {
            const files = fs.readdirSync(this.config.logDir)
                .filter(file => file.startsWith('workflow_') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.logDir, file),
                    stats: fs.statSync(path.join(this.config.logDir, file))
                }))
                .sort((a, b) => b.stats.mtime - a.stats.mtime); // Plus récent en premier
            
            // Supprimer les fichiers excédentaires
            if (files.length > this.config.maxFiles) {
                const filesToDelete = files.slice(this.config.maxFiles);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Ancien log supprimé: ${file.name}`);
                });
            }
            
            // Supprimer les fichiers trop volumineux
            files.forEach(file => {
                if (file.stats.size > this.config.maxFileSize) {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Log trop volumineux supprimé: ${file.name}`);
                }
            });
            
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage logs:', error.message);
        }
    }

    /**
     * Obtenir le chemin du fichier de log actuel
     */
    getLogFilePath() {
        return this.logFileName;
    }

    /**
     * Changer le niveau de log
     */
    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.currentLevel = this.levels[level];
            this.config.level = level;
            this.info(`Logger niveau changé: ${level}`);
        }
    }
}

/**
 * Instance globale du logger
 */
let globalLogger = null;

/**
 * Obtenir l'instance globale du logger
 */
function getLogger(config = {}) {
    if (!globalLogger) {
        globalLogger = new Logger(config);
    }
    return globalLogger;
}

/**
 * Fonctions utilitaires pour logging rapide
 */
function logStep(stepName, status = 'info', details = null) {
    const logger = getLogger();
    logger.logStep(stepName, status, details);
}

function logWorkflowStart(workflowName, config = {}) {
    const logger = getLogger();
    logger.logWorkflowStart(workflowName, config);
}

function logWorkflowSuccess(result = {}) {
    const logger = getLogger();
    logger.logWorkflowSuccess(result);
}

function logWorkflowFailure(error, attempt = 1, maxRetries = 1) {
    const logger = getLogger();
    logger.logWorkflowFailure(error, attempt, maxRetries);
}

module.exports = {
    Logger,
    getLogger,
    logStep,
    logWorkflowStart,
    logWorkflowSuccess,
    logWorkflowFailure
};