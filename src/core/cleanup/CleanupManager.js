/**
 * CleanupManager - Nettoyage automatique après échec
 * 
 * OBJECTIF: Nettoyage complet et radical entre tentatives
 * - Annulation SMS immédiate
 * - Reset application WhatsApp
 * - Nettoyage screenshots temporaires
 * - Reset contexte workflow
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

const fs = require('fs');
const path = require('path');

class CleanupManager {
    /**
     * Effectuer un nettoyage complet après échec
     * 
     * @param {Object} context - Contexte du workflow
     * @param {Object} options - Options de nettoyage
     * @returns {Promise<Object>} Résultat du nettoyage
     */
    static async performFullCleanup(context, options = {}) {
        console.log('🧹 ═══ NETTOYAGE COMPLET APRÈS ÉCHEC ═══');
        const startTime = Date.now();
        
        const cleanupResults = {
            sms: { success: false, details: null },
            globalSMS: { success: false, details: null, skipped: true },
            whatsapp: { success: false, details: null },
            screenshots: { success: false, details: null },
            workflow: { success: false, details: null },
            duration: 0,
            timestamp: new Date().toISOString()
        };

        try {
            // 1. Annuler SMS actuel
            console.log('📱 Étape 1/5: Annulation SMS...');
            cleanupResults.sms = await this.cancelCurrentSMS(context);
            
            // 2. Nettoyage global SMS (nouveau)
            console.log('🌍 Étape 2/5: Nettoyage global SMS...');
            cleanupResults.globalSMS = await this.performGlobalSMSCleanup(context, options);
            
            // 3. Reset application WhatsApp
            console.log('📲 Étape 3/5: Reset WhatsApp...');
            cleanupResults.whatsapp = await this.resetWhatsAppState(context);
            
            // 4. Nettoyer screenshots temporaires
            console.log('📸 Étape 4/5: Nettoyage screenshots...');
            cleanupResults.screenshots = await this.cleanupScreenshots();
            
            // 5. Reset contexte workflow
            console.log('🔄 Étape 5/5: Reset contexte workflow...');
            cleanupResults.workflow = await this.resetWorkflowContext(context);
            
            cleanupResults.duration = Date.now() - startTime;
            console.log(`✅ Nettoyage terminé en ${cleanupResults.duration}ms - Prêt pour nouveau numéro`);
            
            return cleanupResults;
            
        } catch (error) {
            cleanupResults.duration = Date.now() - startTime;
            cleanupResults.error = error.message;
            console.error(`❌ Erreur lors du nettoyage: ${error.message}`);
            throw error;
        }
    }

    /**
     * Effectuer un nettoyage global des numéros SMS actifs
     * 
     * @param {Object} context - Contexte du workflow
     * @param {Object} options - Options de nettoyage
     * @returns {Promise<Object>} Résultat du nettoyage global
     */
    static async performGlobalSMSCleanup(context, options = {}) {
        try {
            // Vérifier si le nettoyage global est activé
            const enableGlobalCleanup = options.enableGlobalSMSCleanup || 
                                      process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true' ||
                                      options.forceGlobalCleanup ||
                                      false;

            if (!enableGlobalCleanup) {
                return {
                    success: true,
                    details: 'Nettoyage global SMS désactivé',
                    action: 'disabled',
                    skipped: true
                };
            }

            if (!context.sms) {
                return {
                    success: false,
                    details: 'Service SMS non disponible',
                    action: 'no_service',
                    skipped: true
                };
            }

            // Vérifier si le contexte a une méthode globalSMSCleanup
            if (typeof context.globalSMSCleanup === 'function') {
                console.log('🧹 Utilisation de la méthode globalSMSCleanup du contexte...');
                const result = await context.globalSMSCleanup({
                    enabled: true,
                    maxConcurrent: 3,
                    ignoreErrors: true,
                    onlyWhatsApp: true,
                    logProgress: true,
                    ...options.globalSMSOptions
                });

                return {
                    success: result.success,
                    details: `${result.cancelled || 0}/${result.total || 0} numéros annulés`,
                    action: 'context_cleanup',
                    skipped: false,
                    result: result
                };
            }

            // Fallback : utiliser directement le provider SMS
            if (typeof context.sms.cancelAllActiveNumbers === 'function') {
                console.log('🧹 Utilisation directe du provider SMS...');
                const result = await context.sms.cancelAllActiveNumbers({
                    maxConcurrent: 3,
                    ignoreErrors: true,
                    onlyWhatsApp: true,
                    logProgress: true,
                    ...options.globalSMSOptions
                });

                return {
                    success: result.success,
                    details: `${result.cancelled || 0}/${result.total || 0} numéros annulés`,
                    action: 'direct_cleanup',
                    skipped: false,
                    result: result
                };
            }

            return {
                success: false,
                details: 'Nettoyage global SMS non supporté par le provider',
                action: 'not_supported',
                skipped: true
            };

        } catch (error) {
            console.error(`❌ Erreur nettoyage global SMS dans CleanupManager: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'exception',
                skipped: false
            };
        }
    }

    /**
     * Annuler le SMS actuel
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat de l'annulation
     */
    static async cancelCurrentSMS(context) {
        try {
            if (!context.session || !context.session.smsId) {
                return {
                    success: true,
                    details: 'Aucun SMS actif à annuler',
                    action: 'skip'
                };
            }

            if (!context.sms) {
                return {
                    success: false,
                    details: 'Manager SMS non disponible',
                    action: 'error'
                };
            }

            // Annuler le numéro SMS
            const result = await context.sms.cancelNumber(context.session.smsId);
            
            if (result.success) {
                console.log(`🗑️ SMS annulé: ${context.session.smsId}`);
                return {
                    success: true,
                    details: `SMS ${context.session.smsId} annulé avec succès`,
                    action: 'cancelled',
                    smsId: context.session.smsId
                };
            } else {
                console.warn(`⚠️ Impossible d'annuler le SMS: ${result.error}`);
                return {
                    success: false,
                    details: result.error,
                    action: 'cancel_failed',
                    smsId: context.session.smsId
                };
            }
            
        } catch (error) {
            console.error(`❌ Erreur annulation SMS: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'exception'
            };
        }
    }

    /**
     * Reset l'état de l'application WhatsApp
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat du reset
     */
    static async resetWhatsAppState(context) {
        try {
            if (!context.bluestack) {
                return {
                    success: false,
                    details: 'BlueStack controller non disponible',
                    action: 'error'
                };
            }

            // Forcer l'arrêt de WhatsApp
            await context.bluestack.executeCommand('am force-stop com.whatsapp');
            await this.delay(1000);
            
            // Nettoyer les données temporaires WhatsApp (optionnel)
            await context.bluestack.executeCommand('pm clear com.whatsapp');
            await this.delay(2000);
            
            // Redémarrer WhatsApp
            await context.bluestack.executeCommand('am start -n com.whatsapp/.HomeActivity');
            await this.delay(3000);
            
            console.log('🔄 WhatsApp reset et redémarré');
            return {
                success: true,
                details: 'WhatsApp reset et redémarré avec succès',
                action: 'reset_complete'
            };
            
        } catch (error) {
            console.error(`❌ Erreur reset WhatsApp: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'reset_failed'
            };
        }
    }

    /**
     * Nettoyer les screenshots temporaires
     * 
     * @returns {Promise<Object>} Résultat du nettoyage
     */
    static async cleanupScreenshots() {
        try {
            const screenshotDir = path.join(__dirname, '../../../screenshots');
            
            if (!fs.existsSync(screenshotDir)) {
                return {
                    success: true,
                    details: 'Dossier screenshots inexistant',
                    action: 'skip',
                    filesDeleted: 0
                };
            }

            const files = fs.readdirSync(screenshotDir);
            const tempFiles = files.filter(file => 
                file.startsWith('temp_') || 
                file.includes('_attempt_') ||
                file.includes('_diagnostic_')
            );

            let deletedCount = 0;
            for (const file of tempFiles) {
                try {
                    const filePath = path.join(screenshotDir, file);
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } catch (deleteError) {
                    console.warn(`⚠️ Impossible de supprimer ${file}: ${deleteError.message}`);
                }
            }

            console.log(`🗑️ ${deletedCount} screenshots temporaires supprimés`);
            return {
                success: true,
                details: `${deletedCount} fichiers temporaires supprimés`,
                action: 'cleanup_complete',
                filesDeleted: deletedCount
            };
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage screenshots: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'cleanup_failed'
            };
        }
    }

    /**
     * Reset le contexte workflow
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat du reset
     */
    static async resetWorkflowContext(context) {
        try {
            if (!context.session) {
                return {
                    success: true,
                    details: 'Aucune session à reset',
                    action: 'skip'
                };
            }

            // Sauvegarder les données importantes
            const preservedData = {
                startTime: context.session.startTime,
                country: context.session.country,
                attempt: context.session.attempt
            };

            // Reset complet de la session
            context.session = {
                ...preservedData,
                phone: null,
                smsId: null,
                parsedNumber: null,
                lastError: null,
                lastCleanup: Date.now()
            };

            console.log('🔄 Contexte workflow reset');
            return {
                success: true,
                details: 'Contexte workflow reset avec succès',
                action: 'reset_complete',
                preservedData: Object.keys(preservedData)
            };
            
        } catch (error) {
            console.error(`❌ Erreur reset contexte: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'reset_failed'
            };
        }
    }

    /**
     * Nettoyage d'urgence rapide (version allégée)
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat du nettoyage rapide
     */
    static async performQuickCleanup(context) {
        console.log('⚡ NETTOYAGE RAPIDE...');
        const startTime = Date.now();

        try {
            // Annuler SMS seulement
            const smsResult = await this.cancelCurrentSMS(context);
            
            // Reset session basique
            if (context.session) {
                context.session.phone = null;
                context.session.smsId = null;
                context.session.parsedNumber = null;
            }

            const duration = Date.now() - startTime;
            console.log(`⚡ Nettoyage rapide terminé en ${duration}ms`);
            
            return {
                success: true,
                type: 'quick',
                duration,
                sms: smsResult
            };
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage rapide: ${error.message}`);
            throw error;
        }
    }

    /**
     * Délai d'attente utilitaire
     * 
     * @param {number} ms - Délai en millisecondes
     * @returns {Promise} Promise qui se résout après le délai
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Nettoyage global SMS uniquement (sans autres étapes)
     * 
     * @param {Object} context - Contexte du workflow
     * @param {Object} options - Options de nettoyage
     * @returns {Promise<Object>} Résultat du nettoyage global uniquement
     */
    static async performGlobalSMSCleanupOnly(context, options = {}) {
        console.log('🌍 ═══ NETTOYAGE GLOBAL SMS UNIQUEMENT ═══');
        const startTime = Date.now();

        try {
            const result = await this.performGlobalSMSCleanup(context, {
                enableGlobalSMSCleanup: true,
                ...options
            });

            result.duration = Date.now() - startTime;
            console.log(`🌍 Nettoyage global SMS terminé en ${result.duration}ms`);

            return result;

        } catch (error) {
            console.error(`❌ Erreur nettoyage global SMS uniquement: ${error.message}`);
            return {
                success: false,
                details: error.message,
                action: 'exception',
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Vérifier si un nettoyage est nécessaire
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {boolean} True si nettoyage nécessaire
     */
    static isCleanupNeeded(context) {
        return !!(context.session && (
            context.session.smsId ||
            context.session.phone ||
            context.session.lastError
        ));
    }

    /**
     * Vérifier si le nettoyage global SMS est disponible
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {boolean} True si le nettoyage global est supporté
     */
    static isGlobalSMSCleanupAvailable(context) {
        return !!(context.sms && (
            typeof context.globalSMSCleanup === 'function' ||
            typeof context.sms.cancelAllActiveNumbers === 'function'
        ));
    }
}

module.exports = { CleanupManager };