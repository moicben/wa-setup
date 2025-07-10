/**
 * WhatsAppService - Service WhatsApp unifié multi-versions
 * Phase 5: Services Unifiés
 * 
 * Service unifié pour gérer différentes versions de WhatsApp
 * avec détection UI adaptative et automation intelligente
 */

/**
 * Service WhatsApp unifié
 */
class WhatsAppService {
    constructor(config = {}) {
        this.config = config;
        this.deviceService = null;
        this.currentVersion = null;
        this.uiElements = null;
        this.packageName = 'com.whatsapp';
        this.metrics = {
            actionsExecuted: 0,
            successfulActions: 0,
            failedActions: 0,
            uiDetections: 0,
            versionDetections: 0
        };
    }

    /**
     * Initialiser le service avec un device
     * @param {DeviceService} deviceService - Service device
     */
    async initialize(deviceService) {
        try {
            this.deviceService = deviceService;
            
            // Détecter la version de WhatsApp
            await this.detectVersion();
            
            // Charger les éléments UI pour cette version
            await this.loadUIElements();
            
            console.log(`✅ WhatsAppService initialisé (version: ${this.currentVersion})`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur initialisation WhatsAppService: ${error.message}`);
            throw error;
        }
    }

    /**
     * Détecter la version de WhatsApp installée
     */
    async detectVersion() {
        try {
            const startTime = Date.now();
            
            // Lancer WhatsApp pour analyser l'interface
            await this.deviceService.launchApp(this.packageName);
            await this.deviceService.wait(3000);
            
            // Prendre une capture pour analyser l'UI
            const screenshot = await this.deviceService.takeScreenshot('whatsapp_version_detection.png');
            
            // Analyser l'interface pour détecter la version
            // Pour l'instant, on utilise une version par défaut
            this.currentVersion = await this.analyzeVersionFromUI(screenshot);
            
            this.metrics.versionDetections++;
            this.recordMetric('detectVersion', Date.now() - startTime, true);
            
            console.log(`🔍 Version WhatsApp détectée: ${this.currentVersion}`);
            
        } catch (error) {
            this.currentVersion = 'default';
            console.warn(`⚠️ Impossible de détecter la version WhatsApp: ${error.message}`);
        }
    }

    /**
     * Analyser l'interface pour détecter la version
     * @param {string} screenshot - Chemin de la capture
     * @returns {string} Version détectée
     */
    async analyzeVersionFromUI(screenshot) {
        // Implémentation simplifiée - peut être étendue avec OCR
        // ou analyse des éléments UI spécifiques
        return 'v2.23.20'; // Version par défaut
    }

    /**
     * Charger les éléments UI pour la version actuelle
     */
    async loadUIElements() {
        // Définir les éléments UI selon la version
        this.uiElements = this.getUIElementsForVersion(this.currentVersion);
        console.log(`🎨 Éléments UI chargés pour version ${this.currentVersion}`);
    }

    /**
     * Obtenir les éléments UI selon la version
     * @param {string} version - Version de WhatsApp
     * @returns {Object} Mapping des éléments UI
     */
    getUIElementsForVersion(version) {
        // Configuration par défaut (peut être étendue)
        const baseElements = {
            phoneInput: { x: 540, y: 400 },
            nextButton: { x: 540, y: 600 },
            continueButton: { x: 540, y: 700 },
            codeInput: { x: 540, y: 500 },
            agreeButton: { x: 540, y: 800 },
            skipButton: { x: 540, y: 900 },
            
            // Zones de texte pour OCR
            welcomeText: { x: 540, y: 200, w: 400, h: 100 },
            verificationText: { x: 540, y: 300, w: 500, h: 150 },
            errorText: { x: 540, y: 350, w: 500, h: 100 }
        };

        // Ajustements selon la version
        switch (version) {
            case 'v2.23.20':
                return {
                    ...baseElements,
                    phoneInput: { x: 540, y: 420 },
                    nextButton: { x: 540, y: 620 }
                };
            
            case 'v2.24.0':
                return {
                    ...baseElements,
                    phoneInput: { x: 540, y: 400 },
                    nextButton: { x: 540, y: 580 }
                };
            
            default:
                return baseElements;
        }
    }

    /**
     * Lancer WhatsApp et attendre qu'il soit prêt
     */
    async launchAndWait() {
        const startTime = Date.now();
        
        try {
            await this.deviceService.launchApp(this.packageName);
            await this.deviceService.wait(3000);
            
            // Vérifier que WhatsApp est bien lancé
            const isReady = await this.waitForWhatsAppReady();
            
            this.recordMetric('launchAndWait', Date.now() - startTime, isReady);
            return isReady;
            
        } catch (error) {
            this.recordMetric('launchAndWait', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Attendre que WhatsApp soit prêt
     */
    async waitForWhatsAppReady(timeout = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const screenshot = await this.deviceService.takeScreenshot('whatsapp_ready_check.png');
                
                // Analyser si WhatsApp est prêt (interface visible)
                const isReady = await this.analyzeWhatsAppReady(screenshot);
                if (isReady) {
                    return true;
                }
                
                await this.deviceService.wait(2000);
                
            } catch (error) {
                console.warn(`⚠️ Erreur vérification WhatsApp: ${error.message}`);
                await this.deviceService.wait(2000);
            }
        }
        
        return false;
    }

    /**
     * Analyser si WhatsApp est prêt
     * @param {string} screenshot - Chemin de la capture
     * @returns {boolean} True si prêt
     */
    async analyzeWhatsAppReady(screenshot) {
        // Implémentation simplifiée - peut être étendue avec OCR
        // Pour l'instant, on considère que WhatsApp est prêt après 3 secondes
        return true;
    }

    /**
     * Saisir le numéro de téléphone
     * @param {string} phoneNumber - Numéro à saisir
     */
    async enterPhoneNumber(phoneNumber) {
        const startTime = Date.now();
        
        try {
            const phoneInput = this.uiElements.phoneInput;
            
            // Cliquer sur le champ de saisie
            await this.deviceService.click(phoneInput.x, phoneInput.y);
            await this.deviceService.wait(1000);
            
            // Saisir le numéro
            await this.deviceService.inputText(phoneNumber);
            await this.deviceService.wait(1000);
            
            this.recordMetric('enterPhoneNumber', Date.now() - startTime, true);
            console.log(`📱 Numéro saisi: ${phoneNumber}`);
            
        } catch (error) {
            this.recordMetric('enterPhoneNumber', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Cliquer sur le bouton Suivant
     */
    async clickNext() {
        const startTime = Date.now();
        
        try {
            const nextButton = this.uiElements.nextButton;
            
            await this.deviceService.click(nextButton.x, nextButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('clickNext', Date.now() - startTime, true);
            console.log(`➡️ Bouton Suivant cliqué`);
            
        } catch (error) {
            this.recordMetric('clickNext', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Cliquer sur le bouton Continuer
     */
    async clickContinue() {
        const startTime = Date.now();
        
        try {
            const continueButton = this.uiElements.continueButton;
            
            await this.deviceService.click(continueButton.x, continueButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('clickContinue', Date.now() - startTime, true);
            console.log(`▶️ Bouton Continuer cliqué`);
            
        } catch (error) {
            this.recordMetric('clickContinue', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Saisir le code SMS
     * @param {string} code - Code à saisir
     */
    async enterSMSCode(code) {
        const startTime = Date.now();
        
        try {
            const codeInput = this.uiElements.codeInput;
            
            // Cliquer sur le champ de saisie
            await this.deviceService.click(codeInput.x, codeInput.y);
            await this.deviceService.wait(1000);
            
            // Saisir le code
            await this.deviceService.inputText(code);
            await this.deviceService.wait(1000);
            
            this.recordMetric('enterSMSCode', Date.now() - startTime, true);
            console.log(`🔢 Code SMS saisi: ${code}`);
            
        } catch (error) {
            this.recordMetric('enterSMSCode', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Accepter les conditions
     */
    async acceptTerms() {
        const startTime = Date.now();
        
        try {
            const agreeButton = this.uiElements.agreeButton;
            
            await this.deviceService.click(agreeButton.x, agreeButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('acceptTerms', Date.now() - startTime, true);
            console.log(`✅ Conditions acceptées`);
            
        } catch (error) {
            this.recordMetric('acceptTerms', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Passer l'étape (Skip)
     */
    async skipStep() {
        const startTime = Date.now();
        
        try {
            const skipButton = this.uiElements.skipButton;
            
            await this.deviceService.click(skipButton.x, skipButton.y);
            await this.deviceService.wait(2000);
            
            this.recordMetric('skipStep', Date.now() - startTime, true);
            console.log(`⏭️ Étape passée`);
            
        } catch (error) {
            this.recordMetric('skipStep', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Analyser l'écran actuel pour détecter les éléments
     * @returns {Object} Éléments détectés
     */
    async analyzeCurrentScreen() {
        const startTime = Date.now();
        
        try {
            const screenshot = await this.deviceService.takeScreenshot('whatsapp_screen_analysis.png');
            
            // Analyser l'écran pour détecter les éléments présents
            const elements = await this.detectUIElements(screenshot);
            
            this.metrics.uiDetections++;
            this.recordMetric('analyzeCurrentScreen', Date.now() - startTime, true);
            
            return elements;
            
        } catch (error) {
            this.recordMetric('analyzeCurrentScreen', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Détecter les éléments UI sur l'écran
     * @param {string} screenshot - Chemin de la capture
     * @returns {Object} Éléments détectés
     */
    async detectUIElements(screenshot) {
        // Implémentation simplifiée
        // Dans une version complète, on utiliserait OCR et analyse d'image
        return {
            hasPhoneInput: true,
            hasNextButton: true,
            hasContinueButton: false,
            hasCodeInput: false,
            hasErrorMessage: false
        };
    }

    /**
     * Réinitialiser WhatsApp
     */
    async reset() {
        const startTime = Date.now();
        
        try {
            await this.deviceService.resetApp(this.packageName);
            await this.deviceService.wait(3000);
            
            this.recordMetric('reset', Date.now() - startTime, true);
            console.log(`🔄 WhatsApp réinitialisé`);
            
        } catch (error) {
            this.recordMetric('reset', Date.now() - startTime, false);
            throw error;
        }
    }

    /**
     * Obtenir les métriques du service
     */
    getMetrics() {
        return {
            ...this.metrics,
            currentVersion: this.currentVersion,
            successRate: this.metrics.actionsExecuted > 0 ? 
                (this.metrics.successfulActions / this.metrics.actionsExecuted) * 100 : 0
        };
    }

    /**
     * Enregistrer une métrique
     * @param {string} action - Action exécutée
     * @param {number} duration - Durée en ms
     * @param {boolean} success - Succès/échec
     */
    recordMetric(action, duration, success) {
        this.metrics.actionsExecuted++;
        if (success) {
            this.metrics.successfulActions++;
        } else {
            this.metrics.failedActions++;
        }
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

module.exports = { WhatsAppService };