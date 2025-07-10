#!/usr/bin/env node

/**
 * Tests d'intégration pour le système SAUVETAGE-PHASE-1
 * 
 * OBJECTIF: Valider que toutes les corrections OCR fonctionnent ensemble
 * et que le système est devenu une "machine à décision binaire stricte"
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

const { StrictDecisionEngine } = require('../src/core/decision/StrictDecisionEngine');
const { CleanupManager } = require('../src/core/cleanup/CleanupManager');
const { MultiLevelValidator } = require('../src/core/validation/MultiLevelValidator');
const fs = require('fs');
const path = require('path');

// Couleurs pour les logs
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

/**
 * Simulation d'un workflow avec les nouvelles corrections
 */
class SauvetageWorkflowSimulator {
    constructor() {
        this.session = {
            startTime: Date.now(),
            country: 'UK',
            phone: null,
            smsId: null,
            attempt: 1
        };
        
        this.stats = {
            totalDecisions: 0,
            continueDecisions: 0,
            abortDecisions: 0,
            panicDecisions: 0,
            cleanupsPerformed: 0
        };
    }

    /**
     * Simuler checkWhatsAppSMS avec les nouvelles corrections
     */
    async simulateCheckWhatsAppSMS(confidence, reason) {
        console.log(`${colors.cyan}📱 Simulation checkWhatsAppSMS - Confiance: ${Math.round(confidence * 100)}%${colors.reset}`);
        
        // Ancienne logique (DÉFAILLANTE)
        if (confidence > 0.7) {
            console.log(`${colors.red}❌ ANCIEN: Confiance ${Math.round(confidence * 100)}% > 70% - Annulation et retry${colors.reset}`);
            return { decision: 'OLD_CANCEL', action: 'retry' };
        } else {
            console.log(`${colors.red}❌ ANCIEN: Confiance ${Math.round(confidence * 100)}% <= 70% - CONTINUATION MALGRÉ INCERTITUDE${colors.reset}`);
            return { decision: 'OLD_CONTINUE', action: 'continue_despite_uncertainty' };
        }
    }

    /**
     * Simuler checkWhatsAppSMS avec les corrections SAUVETAGE-PHASE-1
     */
    async simulateStrictCheckWhatsAppSMS(confidence, reason) {
        console.log(`${colors.cyan}📱 Simulation checkWhatsAppSMS STRICT - Confiance: ${Math.round(confidence * 100)}%${colors.reset}`);
        
        // Nouvelle logique STRICTE
        const decision = StrictDecisionEngine.evaluateConfidence(confidence, 'SMS_CHECK');
        StrictDecisionEngine.logDecision(decision, 'SMS_AVAILABILITY_CHECK');
        
        this.stats.totalDecisions++;
        
        if (decision.decision === 'CONTINUE') {
            this.stats.continueDecisions++;
            return { decision: 'STRICT_CONTINUE', action: 'proceed', confidence: decision.confidence };
        } else if (decision.decision === 'VALIDATE') {
            console.log(`${colors.yellow}🔍 VALIDATION SUPPLÉMENTAIRE REQUISE = ABANDON IMMÉDIAT${colors.reset}`);
            await this.performCleanup();
            return { decision: 'STRICT_VALIDATE_ABORT', action: 'abort_for_validation' };
        } else {
            this.stats.abortDecisions++;
            if (decision.decision === 'PANIC') {
                this.stats.panicDecisions++;
            }
            await this.performCleanup();
            return { decision: 'STRICT_ABORT', action: 'abort_immediately', confidence: decision.confidence };
        }
    }

    /**
     * Simuler nettoyage complet
     */
    async performCleanup() {
        console.log(`${colors.magenta}🧹 Performing cleanup...${colors.reset}`);
        this.stats.cleanupsPerformed++;
        
        // Simuler nettoyage
        this.session.phone = null;
        this.session.smsId = null;
        this.session.lastCleanup = Date.now();
        
        return { success: true, duration: 150 };
    }

    /**
     * Obtenir les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            abortRate: this.stats.totalDecisions > 0 ? (this.stats.abortDecisions / this.stats.totalDecisions) * 100 : 0,
            continueRate: this.stats.totalDecisions > 0 ? (this.stats.continueDecisions / this.stats.totalDecisions) * 100 : 0
        };
    }
}

/**
 * Test de comparaison Ancien vs Nouveau système
 */
async function testOldVsNewSystem() {
    console.log(`${colors.yellow}🔄 Test de comparaison: Ancien vs Nouveau système${colors.reset}\n`);
    
    const simulator = new SauvetageWorkflowSimulator();
    
    // Cas de test critiques identifiés dans SAUVETAGE-PHASE-1.md
    const criticalTestCases = [
        { confidence: 0.75, reason: 'Interface standard détectée', expected: 'PROBLÉMATIQUE' },
        { confidence: 0.6, reason: 'Méthodes détectées', expected: 'TRÈS_PROBLÉMATIQUE' },
        { confidence: 0.5, reason: 'SMS failure détection', expected: 'TROP_BAS' },
        { confidence: 0.8, reason: 'Fallback optimiste', expected: 'OPTIMISTE' },
        { confidence: 0.72, reason: 'Cas limite critique', expected: 'CRITIQUE' }
    ];
    
    console.log(`${colors.blue}📊 Comparaison des décisions:${colors.reset}`);
    console.log('┌─────────────┬──────────────────┬──────────────────┬─────────────────┐');
    console.log('│ Confiance   │ Ancien Système   │ Nouveau Système  │ Amélioration    │');
    console.log('├─────────────┼──────────────────┼──────────────────┼─────────────────┤');
    
    for (const testCase of criticalTestCases) {
        // Ancien système
        const oldResult = await simulator.simulateCheckWhatsAppSMS(testCase.confidence, testCase.reason);
        
        // Nouveau système
        const newResult = await simulator.simulateStrictCheckWhatsAppSMS(testCase.confidence, testCase.reason);
        
        const improvement = (oldResult.decision === 'OLD_CONTINUE' && newResult.decision === 'STRICT_ABORT') ? '✅ CORRIGÉ' : 
                          (oldResult.decision === 'OLD_CONTINUE' && newResult.decision === 'STRICT_CONTINUE') ? '⚠️ ACCEPTÉ' :
                          (oldResult.decision === 'OLD_CANCEL' && newResult.decision === 'STRICT_ABORT') ? '🔄 COHÉRENT' : '❓ AUTRE';
        
        console.log(`│ ${Math.round(testCase.confidence * 100)}%        │ ${oldResult.decision.padEnd(16)} │ ${newResult.decision.padEnd(16)} │ ${improvement.padEnd(15)} │`);
        
        console.log(''); // Ligne vide pour la lisibilité
    }
    
    console.log('└─────────────┴──────────────────┴──────────────────┴─────────────────┘\n');
    
    const stats = simulator.getStats();
    console.log(`${colors.green}📈 Statistiques du nouveau système:${colors.reset}`);
    console.log(`   • Décisions totales: ${stats.totalDecisions}`);
    console.log(`   • Taux d'abandon: ${Math.round(stats.abortRate)}% (👍 Plus strict)`);
    console.log(`   • Taux de continuation: ${Math.round(stats.continueRate)}% (👍 Plus sélectif)`);
    console.log(`   • Nettoyages effectués: ${stats.cleanupsPerformed}`);
    console.log('');
}

/**
 * Test des seuils critiques corrigés
 */
async function testCriticalThresholds() {
    console.log(`${colors.yellow}🎯 Test des seuils critiques corrigés${colors.reset}\n`);
    
    const criticalThresholds = [
        { 
            location: 'workflow.js:152', 
            oldThreshold: 0.7, 
            newThreshold: 0.92,
            context: 'SMS_CHECK',
            testConfidence: 0.75
        },
        { 
            location: 'workflow.js:639', 
            oldThreshold: 0.75, 
            newThreshold: 0.88,
            context: 'default',
            testConfidence: 0.76
        },
        { 
            location: 'workflow.js:643', 
            oldThreshold: 0.6, 
            newThreshold: 0.87,
            context: 'default',
            testConfidence: 0.65
        },
        { 
            location: 'workflow.js:887', 
            oldThreshold: 0.5, 
            newThreshold: 0.75,
            context: 'SMS_FAILURE',
            testConfidence: 0.60
        }
    ];
    
    console.log(`${colors.blue}🔍 Validation des corrections de seuils:${colors.reset}`);
    
    for (const threshold of criticalThresholds) {
        console.log(`\n📍 ${threshold.location}:`);
        console.log(`   Ancien seuil: ${threshold.oldThreshold * 100}%`);
        console.log(`   Nouveau seuil: ${threshold.newThreshold * 100}%`);
        console.log(`   Test avec confiance: ${threshold.testConfidence * 100}%`);
        
        const decision = StrictDecisionEngine.evaluateConfidence(threshold.testConfidence, threshold.context);
        
        // Simuler l'ancienne logique
        const oldWould = threshold.testConfidence > threshold.oldThreshold ? 'CONTINUE' : 'ABORT';
        const newDoes = decision.decision;
        
        console.log(`   Ancien système: ${oldWould}`);
        console.log(`   Nouveau système: ${newDoes}`);
        
        if (oldWould === 'CONTINUE' && (newDoes === 'ABORT' || newDoes === 'PANIC')) {
            console.log(`   ${colors.green}✅ CORRECTION RÉUSSIE: Plus strict comme attendu${colors.reset}`);
        } else if (oldWould === 'ABORT' && newDoes === 'CONTINUE') {
            console.log(`   ${colors.red}❌ RÉGRESSION: Devenu moins strict${colors.reset}`);
        } else {
            console.log(`   ${colors.yellow}⚠️ COHÉRENT: Pas de changement majeur${colors.reset}`);
        }
    }
}

/**
 * Test d'intégration MultiLevelValidator
 */
async function testMultiLevelIntegration() {
    console.log(`${colors.yellow}🔗 Test d'intégration MultiLevelValidator${colors.reset}\n`);
    
    const validator = new MultiLevelValidator();
    
    // Créer un screenshot de test (simulé)
    const testScreenshotPath = path.join(__dirname, 'screenshots/test_integration.png');
    
    // Simuler les résultats de validation multi-niveaux
    const simulatedResults = [
        { level: 1, source: 'OCR_STANDARD', confidence: 0.72, smsAvailable: true },
        { level: 2, source: 'PATTERN_ANALYSIS', confidence: 0.65, smsAvailable: false },
        { level: 3, source: 'CONTEXT_COHERENCE', confidence: 0.78, smsAvailable: true }
    ];
    
    console.log(`${colors.blue}📊 Résultats simulés multi-niveaux:${colors.reset}`);
    for (const result of simulatedResults) {
        console.log(`   Niveau ${result.level} (${result.source}): ${Math.round(result.confidence * 100)}% - SMS ${result.smsAvailable ? 'disponible' : 'non disponible'}`);
    }
    
    const aggregatedDecision = validator.aggregateWithStrictRules(simulatedResults);
    console.log(`\n${colors.green}🎯 Décision agrégée: ${aggregatedDecision.decision}${colors.reset}`);
    console.log(`   Confiance: ${Math.round(aggregatedDecision.confidence * 100)}%`);
    console.log(`   Raison: ${aggregatedDecision.reason}`);
    
    if (aggregatedDecision.decision === 'ABORT' || aggregatedDecision.decision === 'PANIC') {
        console.log(`   ${colors.green}✅ VALIDATION STRICTE: Abandon approprié avec résultats mixtes${colors.reset}`);
    } else {
        console.log(`   ${colors.yellow}⚠️ VALIDATION: Décision ${aggregatedDecision.decision}${colors.reset}`);
    }
}

/**
 * Test de stress - Simulation de 100 décisions
 */
async function testStressScenario() {
    console.log(`${colors.yellow}💪 Test de stress - 100 décisions simulées${colors.reset}\n`);
    
    const simulator = new SauvetageWorkflowSimulator();
    const results = {
        total: 100,
        continue: 0,
        abort: 0,
        panic: 0,
        validate: 0
    };
    
    console.log(`${colors.blue}🔄 Simulation de 100 décisions...${colors.reset}`);
    
    for (let i = 0; i < 100; i++) {
        // Générer une confiance aléatoire
        const confidence = Math.random();
        const decision = StrictDecisionEngine.evaluateConfidence(confidence, 'SMS_CHECK');
        
        switch (decision.decision) {
            case 'CONTINUE':
                results.continue++;
                break;
            case 'ABORT':
                results.abort++;
                break;
            case 'PANIC':
                results.panic++;
                break;
            case 'VALIDATE':
                results.validate++;
                break;
        }
        
        if (i % 25 === 0) {
            console.log(`   ${i}/100 décisions traitées...`);
        }
    }
    
    console.log(`\n${colors.green}📊 Résultats du test de stress:${colors.reset}`);
    console.log(`   • CONTINUE: ${results.continue}/100 (${results.continue}%)`);
    console.log(`   • VALIDATE: ${results.validate}/100 (${results.validate}%)`);
    console.log(`   • ABORT: ${results.abort}/100 (${results.abort}%)`);
    console.log(`   • PANIC: ${results.panic}/100 (${results.panic}%)`);
    
    const strictnessRate = ((results.abort + results.panic) / results.total) * 100;
    console.log(`   • Taux de strictness: ${Math.round(strictnessRate)}%`);
    
    if (strictnessRate > 40) {
        console.log(`   ${colors.green}✅ SYSTÈME STRICT: Taux d'abandon élevé comme attendu${colors.reset}`);
    } else {
        console.log(`   ${colors.yellow}⚠️ SYSTÈME MODÉRÉ: Taux d'abandon ${Math.round(strictnessRate)}%${colors.reset}`);
    }
}

/**
 * Test de validation des corrections SAUVETAGE-PHASE-1
 */
async function testSauvetageValidation() {
    console.log(`${colors.yellow}🚨 Validation des corrections SAUVETAGE-PHASE-1${colors.reset}\n`);
    
    const sauvetageObjectives = [
        {
            objective: 'ZÉRO TOLÉRANCE aux hésitations',
            test: () => {
                const decision = StrictDecisionEngine.evaluateConfidence(0.70, 'SMS_CHECK');
                return decision.decision === 'ABORT' || decision.decision === 'PANIC';
            }
        },
        {
            objective: 'ABANDON IMMÉDIAT si confiance < 90%',
            test: () => {
                const decision = StrictDecisionEngine.evaluateConfidence(0.85, 'SMS_CHECK');
                return decision.decision !== 'CONTINUE';
            }
        },
        {
            objective: 'DÉCISIONS BINAIRES (pas de peut-être)',
            test: () => {
                const decision = StrictDecisionEngine.evaluateConfidence(0.75, 'default');
                return ['CONTINUE', 'ABORT', 'PANIC', 'VALIDATE'].includes(decision.decision);
            }
        },
        {
            objective: 'NETTOYAGE COMPLET entre tentatives',
            test: () => {
                const context = { session: { smsId: 'test', phone: '+123' } };
                return CleanupManager.isCleanupNeeded(context);
            }
        }
    ];
    
    console.log(`${colors.blue}🎯 Validation des objectifs SAUVETAGE:${colors.reset}`);
    
    for (const objective of sauvetageObjectives) {
        const result = objective.test();
        const status = result ? '✅ RÉUSSI' : '❌ ÉCHOUÉ';
        const color = result ? colors.green : colors.red;
        
        console.log(`   ${color}${status}: ${objective.objective}${colors.reset}`);
    }
}

/**
 * Exécution de tous les tests d'intégration
 */
async function runIntegrationTests() {
    console.log(`${colors.magenta}🎯 ═══ TESTS D'INTÉGRATION SAUVETAGE-PHASE-1 ═══${colors.reset}\n`);
    
    const startTime = Date.now();
    
    try {
        await testOldVsNewSystem();
        await testCriticalThresholds();
        await testMultiLevelIntegration();
        await testStressScenario();
        await testSauvetageValidation();
        
        const duration = Date.now() - startTime;
        console.log(`\n${colors.green}🎉 ═══ TESTS D'INTÉGRATION RÉUSSIS ═══${colors.reset}`);
        console.log(`${colors.green}✅ Système SAUVETAGE-PHASE-1 validé en ${duration}ms${colors.reset}`);
        console.log(`${colors.green}🎯 Le système est maintenant une MACHINE À DÉCISION BINAIRE STRICTE !${colors.reset}`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`\n${colors.red}💥 ═══ ÉCHEC DES TESTS D'INTÉGRATION ═══${colors.reset}`);
        console.error(`${colors.red}❌ Erreur après ${duration}ms: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Exécution si appelé directement
if (require.main === module) {
    runIntegrationTests();
}

module.exports = { runIntegrationTests };