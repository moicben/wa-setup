/**
 * Cleanup - Module simplifié
 * Fonctions de nettoyage essentielles pour le workflow
 */

const fs = require('fs');
const path = require('path');

/**
 * Nettoyer un répertoire des fichiers anciens
 */
async function cleanupDirectory(dirPath, maxAge = 24 * 60 * 60 * 1000) {
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
 * Nettoyer les fichiers temporaires
 */
async function cleanupTempFiles() {
    try {
        console.log('🧹 Nettoyage fichiers temporaires...');
        
        const tempDirs = ['./temp', './screenshots', './logs'];
        
        for (const dir of tempDirs) {
            if (fs.existsSync(dir)) {
                await cleanupDirectory(dir);
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
async function emergencyCleanup() {
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
 * Nettoyer en fin de workflow
 */
async function onWorkflowEnd(context) {
    console.log('🏁 Nettoyage fin de workflow...');
    
    try {
        // Nettoyage spécifique au workflow
        if (context && context.cleanup) {
            await context.cleanup();
        }
        
        // Nettoyage global SMS si activé
        if (process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true') {
            await performGlobalSMSCleanup(context);
        }
        
        // Nettoyage des fichiers temporaires
        await cleanupTempFiles();
        
        console.log('✅ Nettoyage fin de workflow terminé');
        
    } catch (error) {
        console.warn('⚠️ Erreur nettoyage fin de workflow:', error.message);
    }
}

/**
 * Nettoyer en cas d'erreur
 */
async function onWorkflowError(context, error) {
    console.log('💥 Nettoyage après erreur de workflow...');
    
    try {
        // Nettoyage du contexte
        if (context && context.cleanup) {
            await context.cleanup();
        }
        
        // Nettoyage global SMS si activé
        if (process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true') {
            await performGlobalSMSCleanup(context);
        }
        
        // Nettoyage d'urgence
        await emergencyCleanup();
        
        console.log('✅ Nettoyage après erreur terminé');
        
    } catch (cleanupError) {
        console.error('❌ Erreur critique nettoyage:', cleanupError.message);
    }
}

/**
 * Nettoyage global SMS
 */
async function performGlobalSMSCleanup(context) {
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
 * Installer les hooks de sortie
 */
function installExitHooks() {
    const exitHandler = async (signal) => {
        console.log(`\n🛑 Signal reçu: ${signal}`);
        await emergencyCleanup();
        process.exit(0);
    };
    
    process.on('SIGINT', exitHandler);
    process.on('SIGTERM', exitHandler);
    process.on('SIGQUIT', exitHandler);
    
    // Hook pour les exceptions non gérées
    process.on('uncaughtException', async (error) => {
        console.error('💥 Exception non gérée:', error);
        await emergencyCleanup();
        process.exit(1);
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('💥 Promesse rejetée non gérée:', reason);
        await emergencyCleanup();
        process.exit(1);
    });
    
    console.log('🔒 Hooks de nettoyage installés');
}

module.exports = {
    cleanupDirectory,
    cleanupTempFiles,
    emergencyCleanup,
    onWorkflowEnd,
    onWorkflowError,
    performGlobalSMSCleanup,
    installExitHooks
};