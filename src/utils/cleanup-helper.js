/**
 * Utilitaire d'aide pour le nettoyage global SMS
 * Facilite l'intégration du nettoyage dans différents points de l'application
 */

const { CleanupManager } = require('../core/cleanup/CleanupManager');
const { getFinalCleanupConfig, isGlobalSMSCleanupEnabled, isTriggerEnabled } = require('../config/cleanup');

/**
 * Déclencher le nettoyage global depuis n'importe où
 */
class CleanupHelper {
    /**
     * Nettoyage global à la fin d'un workflow
     */
    static async onWorkflowEnd(context, result = {}) {
        if (!isTriggerEnabled('onWorkflowEnd')) {
            return { skipped: true, reason: 'trigger_disabled' };
        }

        console.log('🎯 Déclenchement nettoyage global de fin de workflow...');
        
        try {
            const cleanupOptions = getFinalCleanupConfig('workflowEnd', {
                enableGlobalSMSCleanup: true
            });

            const cleanupResult = await CleanupManager.performGlobalSMSCleanupOnly(
                context, 
                cleanupOptions
            );

            // Logger les métriques si disponible
            if (context.recordMetric) {
                context.recordMetric('workflowEndCleanup', {
                    success: cleanupResult.success,
                    cancelled: cleanupResult.result?.cancelled || 0,
                    total: cleanupResult.result?.total || 0,
                    duration: cleanupResult.duration
                });
            }

            return cleanupResult;

        } catch (error) {
            console.error(`❌ Erreur nettoyage fin de workflow: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Nettoyage global lors d'une erreur de workflow
     */
    static async onWorkflowError(context, error) {
        if (!isTriggerEnabled('onWorkflowError')) {
            return { skipped: true, reason: 'trigger_disabled' };
        }

        console.log('🚨 Déclenchement nettoyage global d\'erreur de workflow...');
        
        try {
            const cleanupOptions = getFinalCleanupConfig('workflowError', {
                enableGlobalSMSCleanup: true,
                forceGlobalCleanup: true
            });

            const cleanupResult = await CleanupManager.performGlobalSMSCleanupOnly(
                context, 
                cleanupOptions
            );

            // Logger l'erreur et le nettoyage
            if (context.recordMetric) {
                context.recordMetric('workflowErrorCleanup', {
                    success: cleanupResult.success,
                    cancelled: cleanupResult.result?.cancelled || 0,
                    total: cleanupResult.result?.total || 0,
                    duration: cleanupResult.duration,
                    originalError: error.message
                });
            }

            return cleanupResult;

        } catch (cleanupError) {
            console.error(`❌ Erreur nettoyage d'erreur: ${cleanupError.message}`);
            return { success: false, error: cleanupError.message };
        }
    }

    /**
     * Nettoyage global à la fermeture de l'application
     */
    static async onApplicationExit(context = null) {
        if (!isTriggerEnabled('onApplicationExit')) {
            return { skipped: true, reason: 'trigger_disabled' };
        }

        console.log('🔚 Déclenchement nettoyage global de fermeture d\'application...');
        
        try {
            // Si pas de contexte fourni, tenter de créer un contexte minimal
            if (!context) {
                context = await this.createMinimalContext();
            }

            if (!context) {
                console.warn('⚠️ Impossible de créer un contexte pour le nettoyage de fermeture');
                return { success: false, reason: 'no_context' };
            }

            const cleanupOptions = getFinalCleanupConfig('applicationExit', {
                enableGlobalSMSCleanup: true,
                forceGlobalCleanup: true,
                onlyWhatsApp: false // Nettoyer tous les services à la fermeture
            });

            const cleanupResult = await CleanupManager.performGlobalSMSCleanupOnly(
                context, 
                cleanupOptions
            );

            return cleanupResult;

        } catch (error) {
            console.error(`❌ Erreur nettoyage fermeture: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Nettoyage global manuel
     */
    static async onManualCleanup(context, options = {}) {
        console.log('🧹 Déclenchement nettoyage global manuel...');
        
        try {
            const cleanupOptions = getFinalCleanupConfig('manual', {
                enableGlobalSMSCleanup: true,
                ...options
            });

            const cleanupResult = await CleanupManager.performGlobalSMSCleanupOnly(
                context, 
                cleanupOptions
            );

            return cleanupResult;

        } catch (error) {
            console.error(`❌ Erreur nettoyage manuel: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Créer un contexte minimal pour le nettoyage
     */
    static async createMinimalContext() {
        try {
            // Import dynamique pour éviter les dépendances circulaires
            const { createSMSManagerExtended } = require('../services/sms');
            
            const apiKey = process.env.SMS_ACTIVATE_API_KEY;
            if (!apiKey) {
                console.warn('⚠️ Clé API SMS non disponible pour le nettoyage');
                return null;
            }

            const sms = await createSMSManagerExtended(apiKey);
            
            return {
                sms: sms,
                recordMetric: () => {}, // Mock de recordMetric
                config: {
                    enableGlobalSMSCleanup: true
                }
            };

        } catch (error) {
            console.error(`❌ Erreur création contexte minimal: ${error.message}`);
            return null;
        }
    }

    /**
     * Wrapper pour intégration facile dans try/catch
     */
    static async safeCleanup(context, trigger = 'manual', options = {}) {
        try {
            switch (trigger) {
                case 'workflowEnd':
                    return await this.onWorkflowEnd(context, options);
                case 'workflowError':
                    return await this.onWorkflowError(context, options.error);
                case 'applicationExit':
                    return await this.onApplicationExit(context);
                case 'manual':
                default:
                    return await this.onManualCleanup(context, options);
            }
        } catch (error) {
            console.error(`❌ Erreur safeCleanup (${trigger}): ${error.message}`);
            return { success: false, error: error.message, safe: true };
        }
    }

    /**
     * Obtenir des informations sur l'état du nettoyage global
     */
    static getCleanupStatus() {
        return {
            enabled: isGlobalSMSCleanupEnabled(),
            triggers: {
                workflowEnd: isTriggerEnabled('onWorkflowEnd'),
                workflowError: isTriggerEnabled('onWorkflowError'),
                applicationExit: isTriggerEnabled('onApplicationExit'),
                manual: isTriggerEnabled('onCleanupCommand')
            },
            environment: process.env.NODE_ENV || 'development',
            apiKeyAvailable: !!process.env.SMS_ACTIVATE_API_KEY
        };
    }

    /**
     * Logger le statut du nettoyage global
     */
    static logCleanupStatus() {
        const status = this.getCleanupStatus();
        
        console.log('🧹 ═══ STATUT NETTOYAGE GLOBAL SMS ═══');
        console.log(`🔧 Activé: ${status.enabled ? '✅' : '❌'}`);
        console.log(`🌍 Environnement: ${status.environment}`);
        console.log(`🔑 Clé API: ${status.apiKeyAvailable ? '✅' : '❌'}`);
        console.log('📋 Déclencheurs:');
        console.log(`  - Fin workflow: ${status.triggers.workflowEnd ? '✅' : '❌'}`);
        console.log(`  - Erreur workflow: ${status.triggers.workflowError ? '✅' : '❌'}`);
        console.log(`  - Fermeture app: ${status.triggers.applicationExit ? '✅' : '❌'}`);
        console.log(`  - Manuel: ${status.triggers.manual ? '✅' : '❌'}`);
        console.log('═══════════════════════════════════');
    }
}

/**
 * Installer les hooks de nettoyage automatique pour process exit
 */
function installExitHooks() {
    if (!isTriggerEnabled('onApplicationExit')) {
        return;
    }

    // Nettoyage à la fermeture propre
    process.on('SIGTERM', async () => {
        console.log('📡 Signal SIGTERM reçu - nettoyage global...');
        await CleanupHelper.onApplicationExit();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('📡 Signal SIGINT reçu - nettoyage global...');
        await CleanupHelper.onApplicationExit();
        process.exit(0);
    });

    // Nettoyage avant fermeture du process
    process.on('beforeExit', async () => {
        console.log('📡 Process beforeExit - nettoyage global...');
        await CleanupHelper.onApplicationExit();
    });
}

module.exports = {
    CleanupHelper,
    installExitHooks
};