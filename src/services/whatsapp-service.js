/**
 * WhatsApp Service - Version simplifiée unifiée
 * Fusion de WhatsAppService avec méthodes essentielles
 */

/**
 * Service WhatsApp simplifié
 */
class WhatsAppService {
    constructor(config = {}) {
        this.config = config;
        this.deviceService = null;
        this.packageName = 'com.whatsapp';
        
        // Éléments UI par défaut (coordonnées approximatives)
        this.uiElements = {
            phoneInput: { x: 540, y: 420 },
            nextButton: { x: 540, y: 620 },
            continueButton: { x: 540, y: 700 },
            codeInput: { x: 540, y: 500 },
            agreeButton: { x: 540, y: 800 },
            skipButton: { x: 540, y: 900 },
            restoreButton: { x: 540, y: 650 },
            
            // Zones pour analyse
            welcomeText: { x: 540, y: 200, w: 400, h: 100 },
            verificationText: { x: 540, y: 300, w: 500, h: 150 },
            errorText: { x: 540, y: 350, w: 500, h: 100 }
        };

        this.metrics = {
            actionsExecuted: 0,
            successfulActions: 0,
            failedActions: 0,
            screenshotsTaken: 0
        };
    }

    /**
     * Initialiser le service avec un device
     */
    async initialize(deviceService) {
        try {
            this.deviceService = deviceService;
            console.log(`✅ WhatsAppService initialisé`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur initialisation WhatsAppService: ${error.message}`);
            throw error;
        }
    }

    /**
     * Lancer WhatsApp et attendre qu'il soit prêt
     */
    async launchAndWait() {
        try {
            await this.deviceService.launchApp(this.packageName);
            await this.deviceService.wait(3000);
            
            this.recordMetric('launchAndWait', true);
            console.log('📱 WhatsApp lancé et prêt');
            return true;
        } catch (error) {
            this.recordMetric('launchAndWait', false);
            throw error;
        }
    }

    /**
     * Saisir le numéro de téléphone
     */
    async enterPhoneNumber(phoneNumber) {
        try {
            const phoneInput = this.uiElements.phoneInput;
            
            // Cliquer sur le champ de saisie
            await this.deviceService.click(phoneInput.x, phoneInput.y);
            await this.deviceService.wait(1000);
            
            // Effacer le champ au cas où
            await this.deviceService.clearField(phoneInput.x, phoneInput.y);
            await this.deviceService.wait(500);
            
            // Saisir le numéro
            await this.deviceService.inputText(phoneNumber);
            await this.deviceService.wait(1000);
            
            this.recordMetric('enterPhoneNumber', true);
            console.log(`📱 Numéro saisi: ${phoneNumber}`);
            
        } catch (error) {
            this.recordMetric('enterPhoneNumber', false);
            throw error;
        }
    }

    /**
     * Cliquer sur le bouton Suivant
     */
    async clickNext() {
        try {
            const nextButton = this.uiElements.nextButton;
            
            await this.deviceService.click(nextButton.x, nextButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('clickNext', true);
            console.log(`➡️ Bouton Suivant cliqué`);
            
        } catch (error) {
            this.recordMetric('clickNext', false);
            throw error;
        }
    }

    /**
     * Cliquer sur le bouton Continuer
     */
    async clickContinue() {
        try {
            const continueButton = this.uiElements.continueButton;
            
            await this.deviceService.click(continueButton.x, continueButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('clickContinue', true);
            console.log(`▶️ Bouton Continuer cliqué`);
            
        } catch (error) {
            this.recordMetric('clickContinue', false);
            throw error;
        }
    }

    /**
     * Saisir le code SMS
     */
    async enterSMSCode(code) {
        try {
            const codeInput = this.uiElements.codeInput;
            
            // Cliquer sur le champ de saisie
            await this.deviceService.click(codeInput.x, codeInput.y);
            await this.deviceService.wait(1000);
            
            // Saisir le code
            await this.deviceService.inputText(code);
            await this.deviceService.wait(1000);
            
            this.recordMetric('enterSMSCode', true);
            console.log(`🔢 Code SMS saisi: ${code}`);
            
        } catch (error) {
            this.recordMetric('enterSMSCode', false);
            throw error;
        }
    }

    /**
     * Accepter les conditions
     */
    async acceptTerms() {
        try {
            const agreeButton = this.uiElements.agreeButton;
            
            await this.deviceService.click(agreeButton.x, agreeButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('acceptTerms', true);
            console.log(`✅ Conditions acceptées`);
            
        } catch (error) {
            this.recordMetric('acceptTerms', false);
            throw error;
        }
    }

    /**
     * Passer l'étape (Skip)
     */
    async skipStep() {
        try {
            const skipButton = this.uiElements.skipButton;
            
            await this.deviceService.click(skipButton.x, skipButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('skipStep', true);
            console.log(`⏭️ Étape passée`);
            
        } catch (error) {
            this.recordMetric('skipStep', false);
            throw error;
        }
    }

    /**
     * Cliquer sur restaurer la sauvegarde (pour migration)
     */
    async clickRestore() {
        try {
            const restoreButton = this.uiElements.restoreButton;
            
            await this.deviceService.click(restoreButton.x, restoreButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('clickRestore', true);
            console.log(`🔄 Bouton Restaurer cliqué`);
            
        } catch (error) {
            this.recordMetric('clickRestore', false);
            throw error;
        }
    }

    /**
     * Prendre un screenshot pour analyse
     */
    async takeScreenshot(suffix = '') {
        try {
            const filename = `whatsapp_${suffix}_${Date.now()}.png`;
            const path = await this.deviceService.takeScreenshot(filename);
            
            this.metrics.screenshotsTaken++;
            console.log(`📸 Screenshot: ${filename}`);
            
            return path;
        } catch (error) {
            console.warn(`⚠️ Erreur screenshot: ${error.message}`);
            return null;
        }
    }

    /**
     * Attendre et vérifier l'état de l'écran
     */
    async waitAndCheck(expectedState, timeout = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const screenshot = await this.takeScreenshot(`check_${expectedState}`);
                
                // Analyse simple basée sur l'état attendu
                const currentState = await this.analyzeScreen(screenshot);
                
                if (currentState === expectedState) {
                    console.log(`✅ État atteint: ${expectedState}`);
                    return true;
                }
                
                console.log(`⏳ En attente de l'état: ${expectedState} (actuel: ${currentState})`);
                await this.deviceService.wait(3000);
                
            } catch (error) {
                console.warn(`⚠️ Erreur vérification état: ${error.message}`);
                await this.deviceService.wait(3000);
            }
        }
        
        console.warn(`⚠️ Timeout: état ${expectedState} non atteint`);
        return false;
    }

    /**
     * Analyser l'écran actuel (version simplifiée)
     */
    async analyzeScreen(screenshot) {
        // Implémentation simplifiée - dans la vraie vie on utiliserait OCR
        // Pour l'instant on retourne des états basiques
        const possibleStates = [
            'welcome',
            'phone_input', 
            'verification',
            'code_input',
            'terms',
            'profile',
            'restore',
            'completed',
            'error'
        ];
        
        // Retourner un état aléatoire pour la démo
        // Dans la vraie implémentation, on analyserait le screenshot
        return possibleStates[Math.floor(Math.random() * possibleStates.length)];
    }

    /**
     * Gérer les erreurs communes
     */
    async handleCommonErrors() {
        try {
            const screenshot = await this.takeScreenshot('error_check');
            
            // Vérifier s'il y a des messages d'erreur visibles
            // Implémentation simplifiée
            console.log('🔍 Vérification des erreurs communes...');
            
            // Essayer de cliquer sur "Réessayer" ou "OK" si présent
            try {
                await this.deviceService.click(540, 600); // Position approximative
                await this.deviceService.wait(1000);
                console.log('🔄 Tentative de récupération d\'erreur');
                return true;
            } catch (e) {
                // Pas d'erreur à gérer
                return false;
            }
        } catch (error) {
            console.warn(`⚠️ Erreur gestion erreurs: ${error.message}`);
            return false;
        }
    }

    /**
     * Réinitialiser WhatsApp
     */
    async reset() {
        try {
            await this.deviceService.resetApp(this.packageName);
            await this.deviceService.wait(3000);
            
            this.recordMetric('reset', true);
            console.log(`🔄 WhatsApp réinitialisé`);
            
        } catch (error) {
            this.recordMetric('reset', false);
            throw error;
        }
    }

    /**
     * Fermer WhatsApp
     */
    async close() {
        try {
            await this.deviceService.killApp(this.packageName);
            await this.deviceService.wait(1000);
            
            this.recordMetric('close', true);
            console.log(`🚪 WhatsApp fermé`);
            
        } catch (error) {
            this.recordMetric('close', false);
            throw error;
        }
    }

    /**
     * Enregistrer une métrique
     */
    recordMetric(action, success) {
        this.metrics.actionsExecuted++;
        if (success) {
            this.metrics.successfulActions++;
        } else {
            this.metrics.failedActions++;
        }
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.actionsExecuted > 0 ? 
                (this.metrics.successfulActions / this.metrics.actionsExecuted) * 100 : 0
        };
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        try {
            if (this.deviceService) {
                await this.deviceService.killApp(this.packageName);
            }
            
            console.log(`🧹 WhatsAppService nettoyé`);
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage WhatsAppService: ${error.message}`);
        }
    }
}

/**
 * Factory function pour compatibilité
 */
function createWhatsAppService(config = {}) {
    return new WhatsAppService(config);
}

module.exports = {
    WhatsAppService,
    createWhatsAppService
};