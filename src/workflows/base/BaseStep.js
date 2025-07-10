/**
 * BaseStep - Classe de base pour toutes les étapes de workflow
 * Version simplifiée récupérée après nettoyage
 */

class BaseStep {
    constructor(name, dependencies = []) {
        this.name = name;
        this.dependencies = dependencies;
        this.executed = false;
        this.result = null;
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Exécuter l'étape avec gestion d'erreurs
     */
    async execute(context) {
        try {
            this.startTime = Date.now();
            
            // Vérifier les prérequis
            if (this.canExecute && !(await this.canExecute(context))) {
                throw new Error(`Prérequis non satisfaits pour l'étape: ${this.name}`);
            }

            console.log(`🔄 Exécution: ${this.name}...`);
            
            // Exécuter l'étape
            this.result = await this._execute(context);
            
            this.executed = true;
            this.endTime = Date.now();
            
            console.log(`✅ ${this.name} terminé (${this.endTime - this.startTime}ms)`);
            
            return this.result;
        } catch (error) {
            this.endTime = Date.now();
            console.error(`❌ Erreur dans ${this.name}: ${error.message}`);
            
            // Nettoyage si l'étape échoue
            if (this.cleanup) {
                try {
                    await this.cleanup(context);
                } catch (cleanupError) {
                    console.warn(`⚠️ Erreur nettoyage ${this.name}: ${cleanupError.message}`);
                }
            }
            
            throw error;
        }
    }

    /**
     * Méthode abstraite à implémenter par les sous-classes
     */
    async _execute(context) {
        throw new Error(`Méthode _execute non implémentée pour ${this.name}`);
    }

    /**
     * Obtenir le résultat d'une dépendance
     */
    _getDependencyResult(context, stepName) {
        const result = context.getStepResult(stepName);
        if (!result) {
            throw new Error(`Résultat non trouvé pour l'étape dépendante: ${stepName}`);
        }
        return result;
    }

    /**
     * Méthodes utilitaires pour les étapes
     */
    async _takeScreenshot(context, suffix = '') {
        if (context.bluestack && context.bluestack.takeScreenshot) {
            const stepNumber = this._getStepNumber ? this._getStepNumber() : '00';
            const filename = `${stepNumber}_${this.name.toLowerCase().replace(/\s+/g, '_')}${suffix ? '_' + suffix : ''}`;
            return await context.bluestack.takeScreenshot(filename);
        }
        return null;
    }

    async _click(context, x, y) {
        if (context.bluestack && context.bluestack.click) {
            await context.bluestack.click(x, y);
        }
    }

    async _input(context, text) {
        if (context.bluestack && context.bluestack.input) {
            await context.bluestack.input(text);
        }
    }

    async _pressKey(context, keyCode) {
        if (context.bluestack && context.bluestack.pressKey) {
            await context.bluestack.pressKey(keyCode);
        }
    }

    async _wait(context, duration = 'medium') {
        const durations = {
            short: 1000,
            medium: 3000,
            long: 5000,
            extra: 10000
        };
        
        const ms = typeof duration === 'number' ? duration : durations[duration] || 3000;
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtenir des informations sur l'étape
     */
    getInfo() {
        return {
            name: this.name,
            dependencies: this.dependencies,
            executed: this.executed,
            duration: this.endTime && this.startTime ? this.endTime - this.startTime : null
        };
    }

    /**
     * Obtenir le numéro d'étape (à override)
     */
    _getStepNumber() {
        return '00';
    }
}

module.exports = { BaseStep };