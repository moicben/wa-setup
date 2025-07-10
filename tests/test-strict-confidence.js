#!/usr/bin/env node

/**
 * Tests pour le système strict de confiance OCR
 * 
 * OBJECTIF: Valider que le StrictDecisionEngine fonctionne correctement
 * et que les seuils éliminent les "peut-être"
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

const { StrictDecisionEngine } = require('../src/core/decision/StrictDecisionEngine');
const { CleanupManager } = require('../src/core/cleanup/CleanupManager');
const { MultiLevelValidator } = require('../src/core/validation/MultiLevelValidator');

// Couleurs pour les logs
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

/**
 * Assertion simple pour les tests
 */
function assert(condition, message) {
    if (!condition) {
        console.error(`${colors.red}❌ ÉCHEC: ${message}${colors.reset}`);
        throw new Error(`Assertion échouée: ${message}`);
    } else {
        console.log(`${colors.green}✅ SUCCÈS: ${message}${colors.reset}`);
    }
}

/**
 * Test 1: Seuils de confiance stricts
 */
async function testStrictConfidenceThresholds() {
    console.log(`${colors.blue}🧪 Test 1: Seuils de confiance stricts${colors.reset}`);
    
    const testCases = [
        { confidence: 0.95, expectedDecision: 'CONTINUE', context: 'default' },
        { confidence: 0.87, expectedDecision: 'VALIDATE', context: 'default' },
        { confidence: 0.72, expectedDecision: 'ABORT', context: 'default' },
        { confidence: 0.45, expectedDecision: 'PANIC', context: 'default' },
        
        // Tests spécifiques SMS
        { confidence: 0.94, expectedDecision: 'CONTINUE', context: 'SMS_CHECK' },
        { confidence: 0.89, expectedDecision: 'VALIDATE', context: 'SMS_CHECK' },
        { confidence: 0.76, expectedDecision: 'ABORT', context: 'SMS_CHECK' },
        { confidence: 0.40, expectedDecision: 'PANIC', context: 'SMS_CHECK' },
        
        // Tests spécifiques WhatsApp
        { confidence: 0.96, expectedDecision: 'CONTINUE', context: 'WHATSAPP_VERIFICATION' },
        { confidence: 0.91, expectedDecision: 'VALIDATE', context: 'WHATSAPP_VERIFICATION' },
        { confidence: 0.82, expectedDecision: 'ABORT', context: 'WHATSAPP_VERIFICATION' },
        { confidence: 0.55, expectedDecision: 'PANIC', context: 'WHATSAPP_VERIFICATION' }
    ];
    
    for (const testCase of testCases) {
        const decision = StrictDecisionEngine.evaluateConfidence(testCase.confidence, testCase.context);
        assert(
            decision.decision === testCase.expectedDecision,
            `Confiance ${testCase.confidence} (${testCase.context}) doit donner ${testCase.expectedDecision}, obtenu ${decision.decision}`
        );
    }
    
    console.log(`${colors.green}✅ Test 1 terminé - Tous les seuils fonctionnent correctement${colors.reset}\n`);
}

/**
 * Test 2: Validation des actions d'abandon
 */
async function testAbortActions() {
    console.log(`${colors.blue}🧪 Test 2: Actions d'abandon${colors.reset}`);
    
    const testCases = [
        { confidence: 0.95, shouldAbort: false },
        { confidence: 0.85, shouldAbort: false },
        { confidence: 0.70, shouldAbort: true },
        { confidence: 0.30, shouldAbort: true }
    ];
    
    for (const testCase of testCases) {
        const decision = StrictDecisionEngine.evaluateConfidence(testCase.confidence);
        const requiresAbort = StrictDecisionEngine.requiresAbort(decision);
        
        assert(
            requiresAbort === testCase.shouldAbort,
            `Confiance ${testCase.confidence} - Abandon requis: ${testCase.shouldAbort}, obtenu: ${requiresAbort}`
        );
    }
    
    console.log(`${colors.green}✅ Test 2 terminé - Actions d'abandon correctes${colors.reset}\n`);
}

/**
 * Test 3: Validation des cas limites
 */
async function testEdgeCases() {
    console.log(`${colors.blue}🧪 Test 3: Cas limites${colors.reset}`);
    
    // Cas limites
    const edgeCases = [
        { confidence: 0, expectedDecision: 'PANIC' },
        { confidence: 1, expectedDecision: 'CONTINUE' },
        { confidence: -0.1, expectedDecision: 'PANIC' },
        { confidence: 1.1, expectedDecision: 'PANIC' },
        { confidence: 'invalid', expectedDecision: 'PANIC' },
        { confidence: null, expectedDecision: 'PANIC' },
        { confidence: undefined, expectedDecision: 'PANIC' }
    ];
    
    for (const testCase of edgeCases) {
        const decision = StrictDecisionEngine.evaluateConfidence(testCase.confidence);
        assert(
            decision.decision === testCase.expectedDecision,
            `Cas limite ${testCase.confidence} doit donner ${testCase.expectedDecision}, obtenu ${decision.decision}`
        );
    }
    
    console.log(`${colors.green}✅ Test 3 terminé - Cas limites gérés correctement${colors.reset}\n`);
}

/**
 * Test 4: Logging des décisions
 */
async function testDecisionLogging() {
    console.log(`${colors.blue}🧪 Test 4: Logging des décisions${colors.reset}`);
    
    const testCases = [
        { confidence: 0.95, context: 'SMS_CHECK' },
        { confidence: 0.80, context: 'WHATSAPP_VERIFICATION' },
        { confidence: 0.60, context: 'default' }
    ];
    
    for (const testCase of testCases) {
        const decision = StrictDecisionEngine.evaluateConfidence(testCase.confidence, testCase.context);
        const logEntry = StrictDecisionEngine.logDecision(decision, testCase.context);
        
        assert(
            logEntry.context === testCase.context,
            `Log contexte doit être ${testCase.context}, obtenu ${logEntry.context}`
        );
        
        assert(
            logEntry.confidence === Math.round(testCase.confidence * 100),
            `Log confiance doit être ${Math.round(testCase.confidence * 100)}, obtenu ${logEntry.confidence}`
        );
    }
    
    console.log(`${colors.green}✅ Test 4 terminé - Logging fonctionne correctement${colors.reset}\n`);
}

/**
 * Test 5: CleanupManager basique
 */
async function testCleanupManager() {
    console.log(`${colors.blue}🧪 Test 5: CleanupManager${colors.reset}`);
    
    // Test avec contexte vide
    const emptyContext = { session: null };
    const isCleanupNeeded = CleanupManager.isCleanupNeeded(emptyContext);
    assert(
        !isCleanupNeeded,
        'Contexte vide ne doit pas nécessiter de nettoyage'
    );
    
    // Test avec contexte nécessitant nettoyage
    const fullContext = { 
        session: { 
            smsId: 'test123', 
            phone: '+1234567890',
            lastError: 'test error'
        } 
    };
    const needsCleanup = CleanupManager.isCleanupNeeded(fullContext);
    assert(
        needsCleanup,
        'Contexte avec session doit nécessiter nettoyage'
    );
    
    console.log(`${colors.green}✅ Test 5 terminé - CleanupManager basique fonctionne${colors.reset}\n`);
}

/**
 * Test 6: MultiLevelValidator - Agrégation stricte
 */
async function testMultiLevelValidator() {
    console.log(`${colors.blue}🧪 Test 6: MultiLevelValidator${colors.reset}`);
    
    const validator = new MultiLevelValidator();
    
    // Test avec résultats excellents (tous >= 85%)
    const excellentResults = [
        { confidence: 0.92, source: 'OCR_STANDARD' },
        { confidence: 0.87, source: 'PATTERN_ANALYSIS' },
        { confidence: 0.89, source: 'CONTEXT_COHERENCE' }
    ];
    
    const excellentDecision = validator.aggregateWithStrictRules(excellentResults);
    assert(
        excellentDecision.decision === 'CONTINUE',
        'Tous niveaux excellents doivent donner CONTINUE'
    );
    
    // Test avec résultats mixtes
    const mixedResults = [
        { confidence: 0.78, source: 'OCR_STANDARD' },
        { confidence: 0.82, source: 'PATTERN_ANALYSIS' },
        { confidence: 0.65, source: 'CONTEXT_COHERENCE' }
    ];
    
    const mixedDecision = validator.aggregateWithStrictRules(mixedResults);
    assert(
        mixedDecision.decision === 'VALIDATE',
        'Résultats mixtes avec 2 niveaux satisfaisants doivent donner VALIDATE'
    );
    
    // Test avec résultats faibles
    const poorResults = [
        { confidence: 0.45, source: 'OCR_STANDARD' },
        { confidence: 0.52, source: 'PATTERN_ANALYSIS' },
        { confidence: 0.38, source: 'CONTEXT_COHERENCE' }
    ];
    
    const poorDecision = validator.aggregateWithStrictRules(poorResults);
    assert(
        poorDecision.decision === 'ABORT' || poorDecision.decision === 'PANIC',
        'Résultats faibles doivent donner ABORT ou PANIC'
    );
    
    console.log(`${colors.green}✅ Test 6 terminé - MultiLevelValidator fonctionne correctement${colors.reset}\n`);
}

/**
 * Test 7: Intégration - Scénario complet
 */
async function testIntegrationScenario() {
    console.log(`${colors.blue}🧪 Test 7: Scénario d'intégration${colors.reset}`);
    
    // Scénario: Confiance faible → Décision ABORT → Nettoyage requis
    const lowConfidence = 0.76;
    const decision = StrictDecisionEngine.evaluateConfidence(lowConfidence, 'SMS_CHECK');
    
    assert(
        decision.decision === 'ABORT',
        `Confiance ${lowConfidence} doit donner ABORT`
    );
    
    const requiresAbort = StrictDecisionEngine.requiresAbort(decision);
    assert(
        requiresAbort,
        'Décision ABORT doit nécessiter abandon'
    );
    
    // Vérifier que le contexte nécessite nettoyage
    const contextAfterError = {
        session: {
            smsId: 'test123',
            phone: '+1234567890',
            lastError: 'SMS_CONFIDENCE_TOO_LOW'
        }
    };
    
    const needsCleanup = CleanupManager.isCleanupNeeded(contextAfterError);
    assert(
        needsCleanup,
        'Contexte après erreur doit nécessiter nettoyage'
    );
    
    console.log(`${colors.green}✅ Test 7 terminé - Scénario d'intégration fonctionne${colors.reset}\n`);
}

/**
 * Exécution de tous les tests
 */
async function runAllTests() {
    console.log(`${colors.yellow}🚀 ═══ TESTS SYSTÈME STRICT - SAUVETAGE-PHASE-1 ═══${colors.reset}\n`);
    
    const startTime = Date.now();
    let testsPassed = 0;
    let testsTotal = 7;
    
    try {
        await testStrictConfidenceThresholds();
        testsPassed++;
        
        await testAbortActions();
        testsPassed++;
        
        await testEdgeCases();
        testsPassed++;
        
        await testDecisionLogging();
        testsPassed++;
        
        await testCleanupManager();
        testsPassed++;
        
        await testMultiLevelValidator();
        testsPassed++;
        
        await testIntegrationScenario();
        testsPassed++;
        
        const duration = Date.now() - startTime;
        console.log(`${colors.green}🎉 ═══ TOUS LES TESTS RÉUSSIS ═══${colors.reset}`);
        console.log(`${colors.green}✅ ${testsPassed}/${testsTotal} tests passés en ${duration}ms${colors.reset}`);
        console.log(`${colors.green}🎯 Le système strict est prêt pour éliminer les hésitations OCR !${colors.reset}`);
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`${colors.red}💥 ═══ ÉCHEC DES TESTS ═══${colors.reset}`);
        console.error(`${colors.red}❌ ${testsPassed}/${testsTotal} tests passés en ${duration}ms${colors.reset}`);
        console.error(`${colors.red}🚨 Erreur: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Exécution si appelé directement
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests };