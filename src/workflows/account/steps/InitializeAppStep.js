/**
 * Étape d'initialisation de l'application WhatsApp
 * Réinitialise et lance l'application pour un état propre
 */

const { BaseStep } = require('../../base/BaseStep');

class InitializeAppStep extends BaseStep {
    constructor() {
        super('Initialize App', []); // Aucune dépendance
        this.whatsappPackage = 'com.whatsapp';
    }

    /**
     * Exécuter l'étape d'initialisation
     */
    async _execute(context) {
        try {
            // Étape 1: Réinitialiser WhatsApp (clear data)
            console.log(`🔄 Réinitialisation de ${this.whatsappPackage}...`);
            await context.bluestack.resetApp(this.whatsappPackage);
            
            // Étape 2: Lancer WhatsApp
            console.log(`📱 Lancement de ${this.whatsappPackage}...`);
            await context.bluestack.launchApp(this.whatsappPackage);
            
            // Étape 3: Screenshot de l'état initial
            const screenshotPath = await this._takeScreenshot(
                context, 
                `fresh_attempt_${context.getCurrentAttempt()}`
            );
            
            // Vérifier que l'application s'est bien lancée
            await this._verifyAppLaunched(context);
            
            const result = {
                success: true,
                appPackage: this.whatsappPackage,
                screenshotPath,
                timestamp: Date.now(),
                attempt: context.getCurrentAttempt()
            };
            
            console.log('✅ WhatsApp initialisé et prêt');
            return result;
            
        } catch (error) {
            // Screenshot en cas d'erreur
            await this._takeScreenshot(context, 'error_initialize');
            throw new Error(`Échec initialisation WhatsApp: ${error.message}`);
        }
    }

    /**
     * Vérifier que l'application s'est bien lancée
     */
    async _verifyAppLaunched(context) {
        try {
            // Attendre un peu pour que l'app se charge
            await this._wait(context, 'appLaunch');
            
            // Vérifier via ADB que l'app est active
            const result = await context.bluestack.executeADB(
                `shell dumpsys window windows | grep -E 'mCurrentFocus.*${this.whatsappPackage}'`
            );
            
            if (!result.stdout.includes(this.whatsappPackage)) {
                console.warn('⚠️ WhatsApp pourrait ne pas être au premier plan');
                // Ne pas échouer, juste avertir
            }
            
        } catch (error) {
            console.warn(`⚠️ Impossible de vérifier le statut de l'app: ${error.message}`);
            // Ne pas échouer l'étape pour un problème de vérification
        }
    }

    /**
     * Obtenir le nom d'étape pour les screenshots
     */
    _getStepNumber() {
        return '01';
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier que BlueStack est connecté
            const status = await context.bluestack.checkStatus();
            if (!status.connected) {
                throw new Error('BlueStack non connecté');
            }
            
            // Vérifier que WhatsApp est installé
            if (!status.whatsappInstalled) {
                throw new Error('WhatsApp non installé sur BlueStack');
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits: ${error.message}`);
            return false;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            // Forcer l'arrêt de WhatsApp si l'initialisation a échoué
            await context.bluestack.executeADB(`shell am force-stop ${this.whatsappPackage}`);
            console.log('🧹 WhatsApp arrêté lors du nettoyage');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage InitializeApp: ${error.message}`);
        }
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Réinitialise et lance WhatsApp pour un état propre',
            inputs: ['BlueStack connecté', 'WhatsApp installé'],
            outputs: ['Application lancée', 'Screenshot initial'],
            duration: '~8-12 secondes',
            canFail: true,
            retryable: true
        };
    }
}

module.exports = { InitializeAppStep }; 