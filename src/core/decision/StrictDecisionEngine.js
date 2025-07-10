/**
 * StrictDecisionEngine - Système de décision binaire strict
 * 
 * OBJECTIF: Transformer le système en "MACHINE À REFUSER" 
 * - ZÉRO TOLÉRANCE aux hésitations
 * - ABANDON IMMÉDIAT si confiance < 90%
 * - DÉCISIONS BINAIRES: OUI ou ABANDON (pas de "peut-être")
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

class StrictDecisionEngine {
    /**
     * Seuils de confiance INTOLÉRANTS
     * Ces seuils sont volontairement élevés pour éliminer les "peut-être"
     */
    static CONFIDENCE_THRESHOLDS = {
        CONTINUE: 0.90,      // Minimum 90% pour continuer
        VALIDATE: 0.85,      // 85-89% nécessite tests supplémentaires
        ABORT: 0.70,         // 70-84% déclenche abandon immédiat
        PANIC: 0.50          // < 50% déclenche reset complet
    };

    /**
     * Contextes d'application avec seuils spécifiques
     */
    static CONTEXT_SPECIFIC_THRESHOLDS = {
        SMS_CHECK: {
            CONTINUE: 0.92,  // SMS encore plus strict
            VALIDATE: 0.88,
            ABORT: 0.75,
            PANIC: 0.50
        },
        SMS_FAILURE: {
            CONTINUE: 0.85,  // Détection d'échec peut être moins stricte
            VALIDATE: 0.75,
            ABORT: 0.65,
            PANIC: 0.40
        },
        WHATSAPP_VERIFICATION: {
            CONTINUE: 0.95,  // Écrans WhatsApp ultra-stricts
            VALIDATE: 0.90,
            ABORT: 0.80,
            PANIC: 0.60
        }
    };

    /**
     * Évaluer la confiance et prendre une décision BINAIRE
     * 
     * @param {number} confidence - Niveau de confiance (0-1)
     * @param {string} context - Contexte d'application
     * @returns {Object} Décision avec action recommandée
     */
    static evaluateConfidence(confidence, context = 'default') {
        // Utiliser les seuils spécifiques au contexte si disponibles
        const thresholds = this.CONTEXT_SPECIFIC_THRESHOLDS[context] || this.CONFIDENCE_THRESHOLDS;
        
        // Validation d'entrée
        if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
            return {
                decision: 'PANIC',
                action: 'full_reset',
                reason: 'Confiance invalide',
                confidence: 0
            };
        }

        // Décision stricte basée sur les seuils
        if (confidence >= thresholds.CONTINUE) {
            return {
                decision: 'CONTINUE',
                action: 'proceed',
                reason: `Confiance excellente (${Math.round(confidence * 100)}%)`,
                confidence: confidence,
                threshold: thresholds.CONTINUE
            };
        }
        
        if (confidence >= thresholds.VALIDATE) {
            return {
                decision: 'VALIDATE',
                action: 'additional_tests',
                reason: `Confiance modérée (${Math.round(confidence * 100)}%) - Tests supplémentaires requis`,
                confidence: confidence,
                threshold: thresholds.VALIDATE
            };
        }
        
        if (confidence >= thresholds.ABORT) {
            return {
                decision: 'ABORT',
                action: 'retry_new_number',
                reason: `Confiance insuffisante (${Math.round(confidence * 100)}%) - Abandon immédiat`,
                confidence: confidence,
                threshold: thresholds.ABORT
            };
        }
        
        // Cas critique : confiance très faible
        return {
            decision: 'PANIC',
            action: 'full_reset',
            reason: `Confiance critique (${Math.round(confidence * 100)}%) - Reset complet requis`,
            confidence: confidence,
            threshold: thresholds.PANIC
        };
    }

    /**
     * Journaliser une décision pour le monitoring
     * 
     * @param {Object} decision - Résultat de evaluateConfidence
     * @param {string} context - Contexte d'application
     */
    static logDecision(decision, context = 'default') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            context,
            decision: decision.decision,
            confidence: Math.round(decision.confidence * 100),
            reason: decision.reason,
            threshold: Math.round(decision.threshold * 100)
        };

        // Logging adapté selon la décision
        switch (decision.decision) {
            case 'CONTINUE':
                console.log(`✅ [${context}] DÉCISION: ${decision.decision} - ${decision.reason}`);
                break;
            case 'VALIDATE':
                console.warn(`🔍 [${context}] DÉCISION: ${decision.decision} - ${decision.reason}`);
                break;
            case 'ABORT':
                console.error(`❌ [${context}] DÉCISION: ${decision.decision} - ${decision.reason}`);
                break;
            case 'PANIC':
                console.error(`🚨 [${context}] DÉCISION: ${decision.decision} - ${decision.reason}`);
                break;
        }

        // Retourner l'entrée de log pour persistence si nécessaire
        return logEntry;
    }

    /**
     * Vérifier si une décision nécessite un abandon immédiat
     * 
     * @param {Object} decision - Résultat de evaluateConfidence
     * @returns {boolean} True si abandon requis
     */
    static requiresAbort(decision) {
        return decision.decision === 'ABORT' || decision.decision === 'PANIC';
    }

    /**
     * Vérifier si une décision nécessite des tests supplémentaires
     * 
     * @param {Object} decision - Résultat de evaluateConfidence
     * @returns {boolean} True si validation supplémentaire requise
     */
    static requiresValidation(decision) {
        return decision.decision === 'VALIDATE';
    }

    /**
     * Obtenir les statistiques d'utilisation pour monitoring
     * 
     * @returns {Object} Statistiques d'utilisation
     */
    static getStats() {
        return {
            thresholds: this.CONFIDENCE_THRESHOLDS,
            contextThresholds: this.CONTEXT_SPECIFIC_THRESHOLDS,
            version: 'SAUVETAGE-PHASE-1'
        };
    }
}

module.exports = { StrictDecisionEngine };