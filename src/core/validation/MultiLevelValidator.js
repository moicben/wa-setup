/**
 * MultiLevelValidator - Système de validation multi-niveaux
 * 
 * OBJECTIF: Validation croisée sur 3 niveaux pour éliminer les faux positifs
 * - Niveau 1: OCR Standard avec seuils stricts
 * - Niveau 2: Pattern Analysis multiple
 * - Niveau 3: Context Coherence validation
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

const { StrictDecisionEngine } = require('../decision/StrictDecisionEngine');

class MultiLevelValidator {
    /**
     * Valider la disponibilité SMS avec validation triple
     * 
     * @param {string} screenshot - Chemin vers le screenshot
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat de validation agrégée
     */
    async validateSMSAvailability(screenshot, context) {
        console.log('🔍 ═══ VALIDATION MULTI-NIVEAUX ═══');
        const startTime = Date.now();
        
        const results = [];
        
        try {
            // Niveau 1: OCR Standard
            console.log('📊 Niveau 1: Validation OCR Standard...');
            const primaryResult = await this.primaryOCRValidation(screenshot);
            results.push(primaryResult);
            
            // Niveau 2: Pattern Analysis
            console.log('🔍 Niveau 2: Analyse des patterns...');
            const secondaryResult = await this.patternAnalysisValidation(screenshot);
            results.push(secondaryResult);
            
            // Niveau 3: Context Coherence
            console.log('🧠 Niveau 3: Cohérence contextuelle...');
            const tertiaryResult = await this.contextCoherenceValidation(context);
            results.push(tertiaryResult);
            
            // Agrégation STRICTE
            console.log('⚖️ Agrégation des résultats...');
            const aggregatedResult = this.aggregateWithStrictRules(results);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Validation multi-niveaux terminée en ${duration}ms`);
            
            return {
                ...aggregatedResult,
                duration,
                validationLevels: results.length,
                individualResults: results
            };
            
        } catch (error) {
            console.error(`❌ Erreur validation multi-niveaux: ${error.message}`);
            return {
                decision: 'PANIC',
                confidence: 0,
                reason: `Erreur validation: ${error.message}`,
                duration: Date.now() - startTime,
                error: error.message
            };
        }
    }

    /**
     * Niveau 1: Validation OCR Standard avec seuils stricts
     * 
     * @param {string} screenshot - Chemin vers le screenshot
     * @returns {Promise<Object>} Résultat de validation OCR
     */
    async primaryOCRValidation(screenshot) {
        try {
            const Tesseract = require('tesseract.js');
            
            const { data: { text, confidence } } = await Tesseract.recognize(screenshot, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        // Logs silencieux pour multi-level
                    }
                }
            });
            
            // Analyse du texte extrait
            const textLower = text.toLowerCase();
            let smsAvailable = false;
            let textConfidence = confidence / 100; // Tesseract donne 0-100
            
            // Patterns SMS positifs
            const smsPatterns = [
                /sms/i,
                /text.{0,10}message/i,
                /verification.{0,10}code/i,
                /send.{0,10}code/i
            ];
            
            // Patterns SMS négatifs
            const negativePatterns = [
                /not.{0,10}available/i,
                /unavailable/i,
                /can.{0,5}t.{0,5}send/i,
                /error/i
            ];
            
            let patternScore = 0;
            for (const pattern of smsPatterns) {
                if (pattern.test(textLower)) {
                    patternScore += 0.25;
                    smsAvailable = true;
                }
            }
            
            for (const pattern of negativePatterns) {
                if (pattern.test(textLower)) {
                    patternScore -= 0.3;
                    smsAvailable = false;
                }
            }
            
            const finalConfidence = Math.max(0, Math.min(1, textConfidence * 0.7 + patternScore * 0.3));
            
            return {
                level: 1,
                source: 'OCR_STANDARD',
                confidence: finalConfidence,
                smsAvailable,
                extractedText: text.substring(0, 200),
                ocrConfidence: textConfidence,
                patternScore: patternScore,
                reason: `OCR: ${Math.round(finalConfidence * 100)}% confiance, SMS ${smsAvailable ? 'disponible' : 'non disponible'}`
            };
            
        } catch (error) {
            return {
                level: 1,
                source: 'OCR_STANDARD',
                confidence: 0,
                smsAvailable: false,
                error: error.message,
                reason: `Erreur OCR: ${error.message}`
            };
        }
    }

    /**
     * Niveau 2: Analyse des patterns visuels
     * 
     * @param {string} screenshot - Chemin vers le screenshot
     * @returns {Promise<Object>} Résultat de l'analyse patterns
     */
    async patternAnalysisValidation(screenshot) {
        try {
            const fs = require('fs');
            
            if (!fs.existsSync(screenshot)) {
                return {
                    level: 2,
                    source: 'PATTERN_ANALYSIS',
                    confidence: 0,
                    smsAvailable: false,
                    reason: 'Screenshot inexistant pour analyse patterns'
                };
            }
            
            // Analyse basique de la taille et structure du fichier
            const stats = fs.statSync(screenshot);
            let structureScore = 0;
            
            // Taille raisonnable pour un screenshot WhatsApp
            if (stats.size > 50000 && stats.size < 500000) {
                structureScore += 0.3;
            }
            
            // Analyse OCR ciblée sur les patterns d'interface
            const Tesseract = require('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(screenshot, 'eng', {
                logger: () => {} // Silencieux
            });
            
            const textLower = text.toLowerCase();
            
            // Patterns d'interface WhatsApp
            const whatsappPatterns = [
                /whatsapp/i,
                /verify.{0,10}phone/i,
                /enter.{0,10}code/i,
                /choose.{0,10}method/i,
                /verification/i
            ];
            
            // Patterns d'interface active
            const activeInterfacePatterns = [
                /continue/i,
                /next/i,
                /send/i,
                /receive/i,
                /call/i
            ];
            
            let interfaceScore = 0;
            for (const pattern of whatsappPatterns) {
                if (pattern.test(textLower)) {
                    interfaceScore += 0.2;
                }
            }
            
            for (const pattern of activeInterfacePatterns) {
                if (pattern.test(textLower)) {
                    interfaceScore += 0.15;
                }
            }
            
            const finalConfidence = Math.max(0, Math.min(1, structureScore + interfaceScore));
            const smsAvailable = finalConfidence > 0.6;
            
            return {
                level: 2,
                source: 'PATTERN_ANALYSIS',
                confidence: finalConfidence,
                smsAvailable,
                structureScore,
                interfaceScore,
                fileSize: stats.size,
                reason: `Patterns: ${Math.round(finalConfidence * 100)}% confiance, interface ${smsAvailable ? 'active' : 'inactive'}`
            };
            
        } catch (error) {
            return {
                level: 2,
                source: 'PATTERN_ANALYSIS',
                confidence: 0,
                smsAvailable: false,
                error: error.message,
                reason: `Erreur analyse patterns: ${error.message}`
            };
        }
    }

    /**
     * Niveau 3: Validation de cohérence contextuelle
     * 
     * @param {Object} context - Contexte du workflow
     * @returns {Promise<Object>} Résultat de validation contextuelle
     */
    async contextCoherenceValidation(context) {
        try {
            let coherenceScore = 0;
            const checks = [];
            
            // Vérification session valide
            if (context.session) {
                coherenceScore += 0.2;
                checks.push('Session active');
                
                // Vérification pays cohérent
                if (context.session.country) {
                    coherenceScore += 0.1;
                    checks.push(`Pays: ${context.session.country}`);
                }
                
                // Vérification numéro acheté
                if (context.session.phone) {
                    coherenceScore += 0.2;
                    checks.push('Numéro acheté');
                }
                
                // Vérification SMS ID
                if (context.session.smsId) {
                    coherenceScore += 0.1;
                    checks.push('SMS ID assigné');
                }
            }
            
            // Vérification SMS Manager
            if (context.sms) {
                coherenceScore += 0.2;
                checks.push('SMS Manager actif');
            }
            
            // Vérification BlueStack
            if (context.bluestack) {
                coherenceScore += 0.2;
                checks.push('BlueStack connecté');
            }
            
            const finalConfidence = Math.max(0, Math.min(1, coherenceScore));
            const smsAvailable = finalConfidence > 0.7;
            
            return {
                level: 3,
                source: 'CONTEXT_COHERENCE',
                confidence: finalConfidence,
                smsAvailable,
                checks,
                coherenceScore,
                reason: `Contexte: ${Math.round(finalConfidence * 100)}% cohérence, ${checks.length} vérifications`
            };
            
        } catch (error) {
            return {
                level: 3,
                source: 'CONTEXT_COHERENCE',
                confidence: 0,
                smsAvailable: false,
                error: error.message,
                reason: `Erreur cohérence: ${error.message}`
            };
        }
    }

    /**
     * Agrégation stricte des résultats multi-niveaux
     * 
     * @param {Array} results - Résultats des 3 niveaux
     * @returns {Object} Décision finale agrégée
     */
    aggregateWithStrictRules(results) {
        console.log('⚖️ Application des règles d\'agrégation strictes...');
        
        if (results.length !== 3) {
            return {
                decision: 'PANIC',
                confidence: 0,
                reason: 'Nombre de niveaux de validation incorrect'
            };
        }
        
        // RÈGLE STRICTE: Tous les niveaux doivent être >= 85% pour CONTINUER
        const allAboveHighThreshold = results.every(r => r.confidence >= 0.85);
        
        if (allAboveHighThreshold) {
            const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            return {
                decision: 'CONTINUE',
                confidence: avgConfidence,
                reason: `Tous niveaux excellents (moyenne: ${Math.round(avgConfidence * 100)}%)`,
                validationLevels: results.length,
                allLevelsHigh: true
            };
        }
        
        // RÈGLE MODÉRÉE: Au moins 2 niveaux >= 75% pour VALIDATE
        const aboveModerateThreshold = results.filter(r => r.confidence >= 0.75);
        
        if (aboveModerateThreshold.length >= 2) {
            const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
            return {
                decision: 'VALIDATE',
                confidence: avgConfidence,
                reason: `${aboveModerateThreshold.length}/3 niveaux satisfaisants (moyenne: ${Math.round(avgConfidence * 100)}%)`,
                validationLevels: results.length,
                moderateLevels: aboveModerateThreshold.length
            };
        }
        
        // RÈGLE ABANDON: Si moins de 2 niveaux satisfaisants
        const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
        const minConfidence = Math.min(...results.map(r => r.confidence));
        
        if (minConfidence < 0.30) {
            return {
                decision: 'PANIC',
                confidence: avgConfidence,
                reason: `Niveau critique détecté (min: ${Math.round(minConfidence * 100)}%)`,
                validationLevels: results.length,
                minConfidence: minConfidence
            };
        }
        
        return {
            decision: 'ABORT',
            confidence: avgConfidence,
            reason: `Validation insuffisante (moyenne: ${Math.round(avgConfidence * 100)}%, satisfaisants: ${aboveModerateThreshold.length}/3)`,
            validationLevels: results.length,
            satisfactoryLevels: aboveModerateThreshold.length
        };
    }
}

module.exports = { MultiLevelValidator };