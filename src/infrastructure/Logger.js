/**
 * Logger - Système de logging simple et efficace
 * Phase 6: Infrastructure Simple
 * 
 * Logger simple avec rotation et niveaux multiples
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(config = {}) {
        this.config = {
            level: config.level || 'info',
            outputDir: config.outputDir || 'logs',
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: config.maxFiles || 5,
            enableConsole: config.enableConsole !== false,
            enableFile: config.enableFile !== false,
            ...config
        };
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.currentLevel = this.levels[this.config.level] || 2;
        this.setupOutputDir();
    }

    /**
     * Créer le dossier de logs
     */
    setupOutputDir() {
        if (this.config.enableFile && !fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
    }

    /**
     * Formater un message de log
     */
    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    }

    /**
     * Écrire dans le fichier de log
     */
    writeToFile(level, formattedMessage) {
        if (!this.config.enableFile) return;
        
        const logFile = path.join(this.config.outputDir, `${level}.log`);
        
        try {
            // Vérifier la taille du fichier
            if (fs.existsSync(logFile)) {
                const stats = fs.statSync(logFile);
                if (stats.size > this.config.maxFileSize) {
                    this.rotateFile(logFile);
                }
            }
            
            fs.appendFileSync(logFile, formattedMessage + '\n');
            
        } catch (error) {
            console.error('Erreur écriture log:', error);
        }
    }

    /**
     * Effectuer la rotation des fichiers
     */
    rotateFile(logFile) {
        const ext = path.extname(logFile);
        const base = path.basename(logFile, ext);
        const dir = path.dirname(logFile);
        
        // Décaler les fichiers existants
        for (let i = this.config.maxFiles - 1; i >= 1; i--) {
            const oldFile = path.join(dir, `${base}.${i}${ext}`);
            const newFile = path.join(dir, `${base}.${i + 1}${ext}`);
            
            if (fs.existsSync(oldFile)) {
                if (i === this.config.maxFiles - 1) {
                    fs.unlinkSync(oldFile);
                } else {
                    fs.renameSync(oldFile, newFile);
                }
            }
        }
        
        // Renommer le fichier actuel
        const rotatedFile = path.join(dir, `${base}.1${ext}`);
        fs.renameSync(logFile, rotatedFile);
    }

    /**
     * Logger générique
     */
    log(level, message, meta = {}) {
        const levelNum = this.levels[level];
        if (levelNum > this.currentLevel) return;
        
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console
        if (this.config.enableConsole) {
            const colors = {
                error: '\x1b[31m',
                warn: '\x1b[33m',
                info: '\x1b[36m',
                debug: '\x1b[37m'
            };
            const reset = '\x1b[0m';
            console.log(colors[level] + formattedMessage + reset);
        }
        
        // Fichier
        this.writeToFile(level, formattedMessage);
    }

    /**
     * Méthodes de logging spécifiques
     */
    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    /**
     * Nettoyer les anciens logs
     */
    cleanup(daysToKeep = 7) {
        if (!this.config.enableFile) return;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        try {
            const files = fs.readdirSync(this.config.outputDir);
            
            for (const file of files) {
                const filePath = path.join(this.config.outputDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    this.info(`Log nettoyé: ${file}`);
                }
            }
            
        } catch (error) {
            this.error('Erreur nettoyage logs:', { error: error.message });
        }
    }
}

// Instance globale
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

module.exports = { Logger, getLogger };