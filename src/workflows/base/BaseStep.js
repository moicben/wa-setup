/**
 * Classe de base pour les étapes de workflow
 * Fournit la structure commune et les utilitaires partagés
 */

class BaseStep {
    constructor(name, dependencies = []) {
        this.name = name;
        this.dependencies = dependencies;
        this.executed = false;
        this.result = null;
        this.startTime = null;
        this.endTime = null;
        this.error = null;
    }

    /**
     * Point d'entrée principal pour exécuter l'étape
     */
    async execute(context) {
        try {
            this.startTime = Date.now();
            this.logStart();
            
            // Vérifier les dépendances
            this._checkDependencies(context);
            
            // Exécuter l'étape spécifique (implémentée par les sous-classes)
            this.result = await this._execute(context);
            
            this.executed = true;
            this.endTime = Date.now();
            this.logSuccess();
            
            return this.result;
        } catch (error) {
            this.error = error;
            this.endTime = Date.now();
            this.logError(error);
            throw error;
        }
    }

    /**
     * Méthode abstraite à implémenter par les sous-classes
     */
    async _execute(context) {
        throw new Error(`Méthode _execute() doit être implémentée par ${this.constructor.name}`);
    }

    /**
     * Vérifier que les dépendances sont satisfaites
     */
    _checkDependencies(context) {
        for (const dependency of this.dependencies) {
            if (!context.hasStepResult(dependency)) {
                throw new Error(`Dépendance manquante: ${dependency} requis pour ${this.name}`);
            }
        }
    }

    /**
     * Obtenir le résultat d'une dépendance
     */
    _getDependencyResult(context, stepName) {
        return context.getStepResult(stepName);
    }

    /**
     * Prendre un screenshot avec nom automatique
     */
    async _takeScreenshot(context, suffix = '') {
        const filename = this._generateScreenshotName(suffix);
        return await context.bluestack.takeScreenshot(filename);
    }

    /**
     * Générer un nom de screenshot basé sur l'étape
     */
    _generateScreenshotName(suffix = '') {
        const stepNumber = this._getStepNumber();
        const baseName = this.name.toLowerCase().replace(/\s+/g, '_');
        const suffixPart = suffix ? `_${suffix}` : '';
        const attemptPart = this._getAttemptSuffix();
        
        return `${stepNumber}_${baseName}${suffixPart}${attemptPart}.png`;
    }

    /**
     * Obtenir le numéro d'étape pour le screenshot
     */
    _getStepNumber() {
        // Mapping des étapes vers leurs numéros (pour compatibilité avec l'ancien système)
        const stepNumbers = {
            'initialize_app': '01',
            'buy_phone_number': '02',
            'input_phone': '03',
            'verify_sms': '04',
            'request_sms': '05',
            'analyze_post_sms': '06',
            'wait_sms': '07',
            'input_code': '08',
            'finalize': '09'
        };
        
        const stepKey = this.name.toLowerCase().replace(/\s+/g, '_');
        return stepNumbers[stepKey] || '00';
    }

    /**
     * Obtenir le suffixe d'tentative pour les screenshots
     */
    _getAttemptSuffix() {
        // Pourrait être fourni par le contexte si nécessaire
        return '';
    }

    /**
     * Logging des étapes
     */
    logStart() {
        console.log(`\n${this.name}...`);
    }

    logSuccess() {
        const duration = this.endTime - this.startTime;
        console.log(`✅ ${this.name} terminé (${duration}ms)`);
    }

    logError(error) {
        const duration = this.endTime - this.startTime;
        console.error(`❌ ${this.name} échoué après ${duration}ms: ${error.message}`);
    }

    /**
     * Obtenir des informations sur l'étape
     */
    getInfo() {
        return {
            name: this.name,
            dependencies: this.dependencies,
            executed: this.executed,
            duration: this.endTime ? (this.endTime - this.startTime) : null,
            error: this.error?.message || null,
            hasResult: this.result !== null
        };
    }

    /**
     * Méthodes utilitaires communes
     */

    // Attendre un délai
    async _wait(context, delayNameOrMs) {
        return await context.bluestack.wait(delayNameOrMs);
    }

    // Cliquer
    async _click(context, x, y) {
        return await context.bluestack.click(x, y);
    }

    // Saisir du texte
    async _inputText(context, text) {
        return await context.bluestack.inputText(text);
    }

    // Appuyer sur une touche
    async _pressKey(context, keyCode) {
        return await context.bluestack.pressKey(keyCode);
    }

    // Effacer un champ
    async _clearField(context, x, y) {
        return await context.bluestack.clearField(x, y);
    }

    // Vérifier si l'étape peut être exécutée
    canExecute(context) {
        try {
            this._checkDependencies(context);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Réinitialiser l'état de l'étape
    reset() {
        this.executed = false;
        this.result = null;
        this.startTime = null;
        this.endTime = null;
        this.error = null;
    }
}

module.exports = { BaseStep }; 