/**
 * StrictValidationEngine - Moteur de validation stricte pour l'interface
 * Extrait de workflow.js lignes 1096-1190
 */

class StrictValidationEngine {
    /**
     * Validation stricte de l'interface continue+verify
     * @param {string} text - Texte extrait par OCR
     * @returns {Object} Résultat de validation stricte
     */
    static performStrictInterfaceValidation(text) {
        console.log('🔍 Validation stricte interface continue+verify...');
        
        const textLower = text.toLowerCase();
        let score = 0;
        const checks = [];
        
        // Vérifications strictes
        if (textLower.includes('continue') && textLower.includes('verify')) {
            score += 0.3;
            checks.push('continue+verify présents');
        }
        
        if (textLower.includes('whatsapp')) {
            score += 0.2;
            checks.push('contexte WhatsApp confirmé');
        }
        
        if (textLower.includes('phone') || textLower.includes('number')) {
            score += 0.2;
            checks.push('référence téléphone détectée');
        }
        
        if (textLower.includes('send') || textLower.includes('receive')) {
            score += 0.2;
            checks.push('action SMS détectée');
        }
        
        if (textLower.includes('code') || textLower.includes('message')) {
            score += 0.1;
            checks.push('référence code/message détectée');
        }
        
        const isValid = score >= 0.8;
        console.log(`📊 Score validation: ${Math.round(score * 100)}% (${isValid ? 'VALIDE' : 'INVALIDE'})`);
        
        return {
            isValid,
            confidence: score,
            checks,
            reason: isValid ? 'Interface validée par contrôles stricts' : 'Interface échouée aux contrôles stricts'
        };
    }

    /**
     * Validation stricte des méthodes de vérification
     * @param {Array} availableMethods - Méthodes disponibles détectées
     * @returns {Object} Résultat de validation des méthodes
     */
    static validateVerificationMethods(availableMethods) {
        console.log('🔍 Validation stricte des méthodes de vérification...');
        
        if (!availableMethods || availableMethods.length === 0) {
            return {
                confidence: 0.0,
                reason: 'Aucune méthode à valider',
                validMethods: []
            };
        }
        
        const validMethods = [];
        let totalScore = 0;
        
        for (const method of availableMethods) {
            const methodLower = method.toLowerCase();
            let methodScore = 0;
            
            // Scoring strict des méthodes
            if (methodLower.includes('sms') || methodLower.includes('text')) {
                methodScore = 0.9;
                validMethods.push({ method, score: methodScore, type: 'sms' });
            } else if (methodLower.includes('call') || methodLower.includes('voice')) {
                methodScore = 0.7;
                validMethods.push({ method, score: methodScore, type: 'call' });
            } else if (methodLower.includes('whatsapp')) {
                methodScore = 0.8;
                validMethods.push({ method, score: methodScore, type: 'whatsapp' });
            } else {
                methodScore = 0.3;
                validMethods.push({ method, score: methodScore, type: 'unknown' });
            }
            
            totalScore += methodScore;
        }
        
        const avgConfidence = totalScore / availableMethods.length;
        console.log(`📊 ${validMethods.length} méthodes validées, score moyen: ${Math.round(avgConfidence * 100)}%`);
        
        return {
            confidence: avgConfidence,
            validMethods,
            reason: `${validMethods.length} méthodes validées avec score moyen ${Math.round(avgConfidence * 100)}%`
        };
    }

    /**
     * Validation combinée interface + méthodes
     * @param {string} text - Texte extrait par OCR
     * @param {Array} availableMethods - Méthodes disponibles
     * @returns {Object} Résultat de validation combinée
     */
    static validateInterfaceAndMethods(text, availableMethods) {
        const interfaceValidation = this.performStrictInterfaceValidation(text);
        const methodsValidation = this.validateVerificationMethods(availableMethods);
        
        // Score combiné avec pondération
        const combinedScore = (interfaceValidation.confidence * 0.6) + (methodsValidation.confidence * 0.4);
        
        return {
            isValid: combinedScore >= 0.8,
            confidence: combinedScore,
            interfaceValidation,
            methodsValidation,
            reason: `Validation combinée: ${Math.round(combinedScore * 100)}%`
        };
    }

    /**
     * Validation de seuil de confiance avec actions recommandées
     * @param {number} confidence - Score de confiance
     * @param {string} context - Contexte de la validation
     * @returns {Object} Résultat avec action recommandée
     */
    static evaluateConfidenceThreshold(confidence, context = 'generic') {
        let action = 'CONTINUE';
        let reason = '';
        
        if (confidence >= 0.9) {
            action = 'CONTINUE';
            reason = 'Confiance très élevée - Continuation sûre';
        } else if (confidence >= 0.8) {
            action = 'CONTINUE';
            reason = 'Confiance élevée - Continuation autorisée';
        } else if (confidence >= 0.7) {
            action = 'VALIDATE';
            reason = 'Confiance modérée - Validation supplémentaire recommandée';
        } else if (confidence >= 0.5) {
            action = 'RETRY';
            reason = 'Confiance faible - Retry recommandé';
        } else {
            action = 'ABORT';
            reason = 'Confiance trop faible - Abandon recommandé';
        }
        
        return {
            action,
            reason,
            confidence,
            context,
            threshold: this._getThresholdForContext(context)
        };
    }

    /**
     * Obtenir le seuil de confiance pour un contexte donné
     * @param {string} context - Contexte de validation
     * @returns {number} Seuil de confiance
     */
    static _getThresholdForContext(context) {
        const thresholds = {
            'SMS_CHECK': 0.8,
            'INTERFACE_VALIDATION': 0.85,
            'METHOD_VALIDATION': 0.7,
            'COMBINED_VALIDATION': 0.8,
            'generic': 0.75
        };
        
        return thresholds[context] || thresholds.generic;
    }
}

module.exports = {
    StrictValidationEngine
};