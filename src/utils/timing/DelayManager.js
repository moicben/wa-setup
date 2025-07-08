/**
 * Gestionnaire de délais et timing
 * Module extrait de bluestack.js pour une architecture modulaire
 */

class DelayManager {
    constructor(customDelays = {}) {
        // Délais par défaut (en millisecondes)
        this.delays = {
            short: 500,
            medium: 1500,
            long: 3000,
            appLaunch: 8000,
            network: 5000,
            animation: 1000,
            ...customDelays
        };
    }

    /**
     * Attendre un délai nommé ou une durée en ms
     */
    async wait(delayNameOrMs) {
        let ms;
        
        if (typeof delayNameOrMs === 'string') {
            ms = this.delays[delayNameOrMs];
            if (ms === undefined) {
                throw new Error(`Délai inconnu: ${delayNameOrMs}. Délais disponibles: ${Object.keys(this.delays).join(', ')}`);
            }
        } else if (typeof delayNameOrMs === 'number') {
            ms = delayNameOrMs;
        } else {
            throw new Error('Le délai doit être un nom (string) ou une durée en ms (number)');
        }

        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Attendre avec un callback de progression (utile pour les longs délais)
     */
    async waitWithProgress(delayNameOrMs, progressCallback = null) {
        let ms;
        
        if (typeof delayNameOrMs === 'string') {
            ms = this.delays[delayNameOrMs];
        } else {
            ms = delayNameOrMs;
        }

        if (!progressCallback) {
            return this.wait(ms);
        }

        const steps = 10;
        const stepDuration = ms / steps;
        
        for (let i = 0; i < steps; i++) {
            await new Promise(resolve => setTimeout(resolve, stepDuration));
            progressCallback((i + 1) / steps, ms);
        }
    }

    /**
     * Attendre avec timeout et condition
     */
    async waitUntil(conditionFn, options = {}) {
        const {
            timeout = 30000,        // 30 secondes par défaut
            interval = 1000,        // Vérifier toutes les secondes
            timeoutMessage = 'Timeout waiting for condition'
        } = options;

        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const result = await conditionFn();
                if (result) {
                    return result;
                }
            } catch (error) {
                // Continuer d'attendre même si la condition lève une erreur
                console.debug(`Condition check failed: ${error.message}`);
            }
            
            await this.wait(interval);
        }
        
        throw new Error(timeoutMessage);
    }

    /**
     * Retry avec délai exponentiel
     */
    async retry(fn, options = {}) {
        const {
            maxRetries = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            exponentialBase = 2,
            retryCondition = () => true
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries || !retryCondition(error, attempt)) {
                    throw error;
                }
                
                // Calcul du délai exponentiel
                const delay = Math.min(
                    baseDelay * Math.pow(exponentialBase, attempt),
                    maxDelay
                );
                
                console.log(`Tentative ${attempt + 1}/${maxRetries + 1} échouée, retry dans ${delay}ms...`);
                await this.wait(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * Obtenir tous les délais configurés
     */
    getDelays() {
        return { ...this.delays };
    }

    /**
     * Modifier un délai
     */
    setDelay(name, ms) {
        this.delays[name] = ms;
    }

    /**
     * Ajouter plusieurs délais
     */
    setDelays(delaysObject) {
        this.delays = { ...this.delays, ...delaysObject };
    }

    /**
     * Réinitialiser aux délais par défaut
     */
    resetDelays() {
        this.delays = {
            short: 500,
            medium: 1500,
            long: 3000,
            appLaunch: 8000,
            network: 5000,
            animation: 1000
        };
    }

    /**
     * Mesurer le temps d'exécution d'une fonction
     */
    async measure(fn, label = 'Operation') {
        const startTime = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            console.log(`⏱️ ${label} completed in ${duration}ms`);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`⏱️ ${label} failed after ${duration}ms`);
            throw error;
        }
    }

    /**
     * Créer un délai adaptatif basé sur la performance
     */
    adaptiveDelay(baseName, performanceFactor = 1) {
        const baseDelay = this.delays[baseName] || 1000;
        return Math.round(baseDelay * performanceFactor);
    }
}

module.exports = { DelayManager }; 