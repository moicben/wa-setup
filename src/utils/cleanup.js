/**
 * Cleanup - Version simplifiée unifiée
 * Fusion de CleanupHelper + CleanupManager avec fonctionnalités essentielles
 */

const fs = require('fs');
const path = require('path');

/**
 * Gestionnaire de nettoyage simplifié
 */
class CleanupManager {
    constructor() {
        this.cleanupHandlers = [];
        this.isCleaningUp = false;
        this.exitHooksInstalled = false;
        
        // Types de nettoyage
        this.cleanupTypes = {
            SMS: 'sms',
            DEVICE: 'device', 
            WHATSAPP: 'whatsapp',
            FILES: 'files',
            GENERAL: 'general'
        };
    }

    /**
     * Ajouter un handler de nettoyage
     */
    addCleanupHandler(type, handler, priority = 5) {
        this.cleanupHandlers.push({
            type,
            handler,
            priority,
            added: Date.now()
        });
        
        // Trier par priorité (plus haute en premier)
        this.cleanupHandlers.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Nettoyer par type
     */
    async cleanupByType(type) {
        const handlers = this.cleanupHandlers.filter(h => h.type === type);
        
        for (const { handler } of handlers) {
            try {
                await handler();
            } catch (error) {
                console.warn(`⚠️ Erreur nettoyage ${type}:`, error.message);
            }
        }
    }

    /**
     * Nettoyer tout
     */
    async cleanupAll() {
        if (this.isCleaningUp) {
            console.log('🧹 Nettoyage déjà en cours...');
            return;
        }
        
        this.isCleaningUp = true;
        console.log('🧹 === DÉBUT NETTOYAGE GLOBAL ===');
        
        for (const { type, handler } of this.cleanupHandlers) {
            try {
                console.log(`🧹 Nettoyage ${type}...`);
                await handler();
                console.log(`✅ Nettoyage ${type} terminé`);
            } catch (error) {
                console.error(`❌ Erreur nettoyage ${type}:`, error.message);
            }
        }
        
        console.log('✅ === NETTOYAGE GLOBAL TERMINÉ ===');
        this.isCleaningUp = false;
    }

    /**
     * Installer les hooks de sortie
     */
    installExitHooks() {
        if (this.exitHooksInstalled) return;
        
        const exitHandler = async (signal) => {
            console.log(`\n🛑 Signal reçu: ${signal}`);
            await this.cleanupAll();
            process.exit(0);
        };
        
        process.on('SIGINT', exitHandler);
        process.on('SIGTERM', exitHandler);
        process.on('SIGQUIT', exitHandler);
        
        // Hook pour les exceptions non gérées
        process.on('uncaughtException', async (error) => {
            console.error('💥 Exception non gérée:', error);
            await this.cleanupAll();
            process.exit(1);
        });
        
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('💥 Promesse rejetée non gérée:', reason);
            await this.cleanupAll();
            process.exit(1);
        });
        
        this.exitHooksInstalled = true;
        console.log('🔒 Hooks de nettoyage installés');
    }
}

/**
 * Helper de nettoyage pour les workflows
 */
class CleanupHelper {
    constructor() {
        this.manager = new CleanupManager();
        this.globalSMSCleanupEnabled = process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true';
    }

    /**
     * Installer les hooks de sortie
     */
    installExitHooks() {
        this.manager.installExitHooks();
    }

    /**
     * Logger le statut du nettoyage
     */
    logCleanupStatus() {
        console.log('🧹 Configuration nettoyage:');
        console.log(`   - Nettoyage global SMS: ${this.globalSMSCleanupEnabled ? 'Activé' : 'Désactivé'}`);
        console.log(`   - Handlers enregistrés: ${this.manager.cleanupHandlers.length}`);
    }

    /**
     * Nettoyage en fin de workflow réussi
     */
    async onWorkflowEnd(context, result) {
        console.log('🏁 Nettoyage fin de workflow (succès)...');
        
        try {
            // Nettoyage spécifique au workflow
            if (context && context.cleanup) {
                await context.cleanup();
            }
            
            // Nettoyage global SMS si activé
            if (this.globalSMSCleanupEnabled) {
                await this._performGlobalSMSCleanup(context);
            }
            
            // Nettoyage des fichiers temporaires
            await this._cleanupTempFiles();
            
            console.log('✅ Nettoyage fin de workflow terminé');
            
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage fin de workflow:', error.message);
        }
    }

    /**
     * Nettoyage en cas d'erreur de workflow
     */
    async onWorkflowError(context, error) {
        console.log('💥 Nettoyage après erreur de workflow...');
        
        try {
            // Nettoyage du contexte
            if (context && context.cleanup) {
                await context.cleanup();
            }
            
            // Nettoyage global SMS si activé
            if (this.globalSMSCleanupEnabled) {
                await this._performGlobalSMSCleanup(context);
            }
            
            // Nettoyage d'urgence
            await this._emergencyCleanup();
            
            console.log('✅ Nettoyage après erreur terminé');
            
        } catch (cleanupError) {
            console.error('❌ Erreur critique nettoyage:', cleanupError.message);
        }
    }

    /**
     * Nettoyage global SMS
     */
    async _performGlobalSMSCleanup(context) {
        try {
            console.log('🧹 Nettoyage global SMS...');
            
            if (context && context.sms && typeof context.sms.cancelAllActiveNumbers === 'function') {
                const result = await context.sms.cancelAllActiveNumbers({
                    maxConcurrent: 3,
                    ignoreErrors: true,
                    onlyWhatsApp: true,
                    logProgress: true
                });
                
                console.log(`📊 SMS cleanup: ${result.cancelled}/${result.total} annulés`);
            } else {
                console.log('⚠️ Service SMS non disponible pour nettoyage global');
            }
            
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage global SMS:', error.message);
        }
    }

    /**
     * Nettoyage des fichiers temporaires
     */
    async _cleanupTempFiles() {
        try {
            console.log('🧹 Nettoyage fichiers temporaires...');
            
            const tempDirs = ['./temp', './screenshots', './logs'];
            
            for (const dir of tempDirs) {
                if (fs.existsSync(dir)) {
                    await this._cleanupDirectory(dir);
                }
            }
            
            console.log('✅ Fichiers temporaires nettoyés');
            
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage fichiers temporaires:', error.message);
        }
    }

    /**
     * Nettoyage d'urgence
     */
    async _emergencyCleanup() {
        try {
            console.log('🚨 Nettoyage d\'urgence...');
            
            // Tuer les processus ADB zombie
            try {
                const { spawn } = require('child_process');
                spawn('pkill', ['-f', 'adb'], { stdio: 'ignore' });
            } catch (e) {
                // Ignorer les erreurs pkill
            }
            
            // Nettoyer les fichiers de lock
            const lockFiles = ['./temp/.lock', './screenshots/.lock'];
            for (const lockFile of lockFiles) {
                if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                }
            }
            
            console.log('✅ Nettoyage d\'urgence terminé');
            
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage d\'urgence:', error.message);
        }
    }

    /**
     * Nettoyer un répertoire
     */
    async _cleanupDirectory(dirPath, maxAge = 24 * 60 * 60 * 1000) {
        try {
            if (!fs.existsSync(dirPath)) return;
            
            const files = fs.readdirSync(dirPath);
            const now = Date.now();
            let cleaned = 0;
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                // Supprimer les fichiers trop anciens
                if (now - stats.mtime.getTime() > maxAge) {
                    if (stats.isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                    cleaned++;
                }
            }
            
            if (cleaned > 0) {
                console.log(`🗑️ ${cleaned} fichiers supprimés dans ${dirPath}`);
            }
            
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage répertoire ${dirPath}:`, error.message);
        }
    }

    /**
     * Nettoyage manuel des screenshots
     */
    async cleanupScreenshots(maxAge = 24 * 60 * 60 * 1000) {
        await this._cleanupDirectory('./screenshots', maxAge);
    }

    /**
     * Nettoyage manuel des logs
     */
    async cleanupLogs(maxAge = 7 * 24 * 60 * 60 * 1000) {
        await this._cleanupDirectory('./logs', maxAge);
    }
}

/**
 * Instance globale
 */
let globalCleanupHelper = null;

/**
 * Obtenir l'instance globale
 */
function getCleanupHelper() {
    if (!globalCleanupHelper) {
        globalCleanupHelper = new CleanupHelper();
    }
    return globalCleanupHelper;
}

/**
 * Installer les hooks de sortie globaux
 */
function installExitHooks() {
    const helper = getCleanupHelper();
    helper.installExitHooks();
}

/**
 * Fonctions utilitaires
 */
function logCleanupStatus() {
    const helper = getCleanupHelper();
    helper.logCleanupStatus();
}

async function onWorkflowEnd(context, result) {
    const helper = getCleanupHelper();
    return await helper.onWorkflowEnd(context, result);
}

async function onWorkflowError(context, error) {
    const helper = getCleanupHelper();
    return await helper.onWorkflowError(context, error);
}

module.exports = {
    CleanupManager,
    CleanupHelper,
    getCleanupHelper,
    installExitHooks,
    logCleanupStatus,
    onWorkflowEnd,
    onWorkflowError
};