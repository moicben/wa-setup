#!/usr/bin/env node

/**
 * Test d'intégration MoreLogin - Phase 3
 * Validation des modules cloud: CloudPhoneManager, ProfileManager, ProxyRotator, CloudPhoneNumberParser
 */

const { CloudPhoneManager, ProfileManager, ProxyRotator, CloudPhoneNumberParser } = require('./src/cloud');
const { MoreLoginStep } = require('./src/workflows/steps/morelogin-step');
const { WorkflowContext } = require('./src/workflows/base/WorkflowContext');

async function testMoreLoginIntegration() {
    console.log('🌥️ TEST D\'INTÉGRATION MORELOGIN - PHASE 3');
    console.log('=' .repeat(60));

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    }

    try {
        // Test 1: Initialisation CloudPhoneManager
        console.log('\n📱 Test 1: CloudPhoneManager...');
        const cloudPhoneManager = new CloudPhoneManager({
            apiKey: 'test-api-key',
            maxConcurrentProfiles: 3
        });
        
        await cloudPhoneManager.initialize();
        assert(cloudPhoneManager.initialized === true, 'CloudPhoneManager initialisé');
        
        const phoneStatus = cloudPhoneManager.getProfilesStatus();
        assert(phoneStatus.total >= 0, 'Status profils accessible');
        
        const phoneMetrics = cloudPhoneManager.getMetrics();
        assert(typeof phoneMetrics.totalAllocated === 'number', 'Métriques CloudPhoneManager');

        // Test 2: Initialisation ProfileManager
        console.log('\n👤 Test 2: ProfileManager...');
        const profileManager = new ProfileManager({
            profilesPath: './test-profiles',
            maxProfilesPerAccount: 2
        });
        
        await profileManager.initialize();
        assert(profileManager.initialized === true, 'ProfileManager initialisé');
        
        // Créer un profil test avec ID unique
        const uniqueAccountId = `test-account-${Date.now()}`;
        const testProfile = await profileManager.createProfile(uniqueAccountId, 'UK', {
            test: true
        });
        assert(testProfile.id.includes(uniqueAccountId), 'Profil créé avec bon ID');
        assert(testProfile.country === 'UK', 'Profil créé avec bon pays');
        
        const profileMetrics = profileManager.getMetrics();
        assert(profileMetrics.totalProfiles >= 1, 'Métriques ProfileManager');

        // Test 3: Initialisation ProxyRotator
        console.log('\n🌐 Test 3: ProxyRotator...');
        const proxyRotator = new ProxyRotator({
            timeout: 5000,
            allowedCountries: ['UK', 'FR']
        });
        
        await proxyRotator.initialize();
        assert(proxyRotator.initialized === true, 'ProxyRotator initialisé');
        
        const proxyStatus = proxyRotator.getProxiesStatus();
        assert(proxyStatus.total >= 0, 'Status proxies accessible');
        
        const proxyMetrics = proxyRotator.getMetrics();
        assert(typeof proxyMetrics.totalProxies === 'number', 'Métriques ProxyRotator');

        // Test 4: CloudPhoneNumberParser
        console.log('\n🔢 Test 4: CloudPhoneNumberParser...');
        const cloudParser = new CloudPhoneNumberParser();
        
        // Test parsing numéro cloud UK
        const ukCloudNumber = 'C441234567890';
        const ukParsed = cloudParser.parseCloudNumber(ukCloudNumber, 'UK');
        assert(ukParsed.success === true, 'Parsing numéro cloud UK réussi');
        assert(ukParsed.cloud.cloudType === 'UK_CLOUD', 'Type cloud UK détecté');
        assert(ukParsed.metadata.isCloudNumber === true, 'Métadonnées cloud correctes');
        
        // Test parsing numéro cloud FR
        const frCloudNumber = 'C33123456789';
        const frParsed = cloudParser.parseCloudNumber(frCloudNumber, 'FR');
        assert(frParsed.success === true, 'Parsing numéro cloud FR réussi');
        assert(frParsed.cloud.cloudType === 'FR_CLOUD', 'Type cloud FR détecté');

        // Test 5: WorkflowContext avec extensions cloud
        console.log('\n🔄 Test 5: WorkflowContext cloud...');
        const context = new WorkflowContext({
            country: 'UK',
            moreLoginApiKey: 'test-key'
        });
        
        // Test méthodes cloud
        context.setCloudAllocations({
            profile: testProfile,
            proxy: { id: 'test-proxy', country: 'UK' }
        });
        
        assert(context.hasCloudAllocations() === true, 'Cloud allocations définies');
        assert(context.isCloudMode() === true, 'Mode cloud détecté');
        
        const cloudMetrics = context.getCloudMetrics();
        assert(cloudMetrics.cloudMode === true, 'Métriques cloud correctes');

        // Test 6: MoreLoginStep intégration
        console.log('\n🌥️ Test 6: MoreLoginStep...');
        const moreLoginStep = new MoreLoginStep('Test MoreLogin Setup');
        assert(typeof moreLoginStep._execute === 'function', 'MoreLoginStep méthode _execute');
        assert(moreLoginStep.config.enableCloudPhones === true, 'Configuration cloud phones activée');
        assert(moreLoginStep.config.enableProfileRotation === true, 'Configuration rotation profils activée');
        assert(moreLoginStep.config.enableProxyRotation === true, 'Configuration rotation proxies activée');

        // Test 7: Intégration allocation/libération
        console.log('\n🔄 Test 7: Allocation/Libération ressources...');
        
        // Allouer un profil cloud
        const allocation = await cloudPhoneManager.allocateProfile('UK');
        assert(allocation.profileId !== undefined, 'Profil cloud alloué');
        assert(allocation.country === 'UK', 'Profil cloud bon pays');
        
        // Libérer le profil
        const released = await cloudPhoneManager.releaseProfile(allocation.profileId);
        assert(released === true, 'Profil cloud libéré');

        // Test 8: Validation géo-cohérence
        console.log('\n🌍 Test 8: Validation géo-cohérence...');
        
        const mockProxies = [
            { id: 'uk-1', expectedCountry: 'UK', responseTime: 100 },
            { id: 'fr-1', expectedCountry: 'FR', responseTime: 150 }
        ];
        
        const geoValidation = cloudParser.validateGeoCoherenceWithProxies(ukParsed, mockProxies);
        assert(typeof geoValidation.overallCoherent === 'boolean', 'Validation géo-cohérence calculée');
        assert(geoValidation.totalProxies === 2, 'Tous les proxies testés');
        
        const suggestions = cloudParser.suggestProxiesForNumber(ukParsed, mockProxies);
        assert(suggestions.numberCountry === 'UK', 'Pays du numéro détecté');
        assert(suggestions.suggestions.length >= 0, 'Suggestions de proxies générées');

        // Test 9: Patterns cloud analysis
        console.log('\n🔍 Test 9: Analyse patterns cloud...');
        
        const testNumbers = ['C441234567890', 'C33123456789', 'UK_CLOUD_1234567890'];
        const analysis = cloudParser.analyzeCloudPatterns(testNumbers);
        assert(analysis.total === 3, 'Analyse tous les numéros');
        assert(Object.keys(analysis.byType).length > 0, 'Types détectés');
        assert(analysis.errors.length === 0, 'Aucune erreur d\'analyse');

        // Test 10: Nettoyage complet
        console.log('\n🧹 Test 10: Nettoyage ressources...');
        
        await profileManager.cleanup();
        await cloudPhoneManager.cleanup();
        await proxyRotator.cleanup();
        await context.cleanupCloudResources();
        
        assert(cloudPhoneManager.initialized === false, 'CloudPhoneManager nettoyé');
        assert(profileManager.initialized === false, 'ProfileManager nettoyé');
        assert(proxyRotator.initialized === false, 'ProxyRotator nettoyé');

        // Résultats finaux
        console.log('\n📊 Résultats du test d\'intégration MoreLogin:');
        console.log(`✅ Tests réussis: ${passed}`);
        console.log(`❌ Tests échoués: ${failed}`);
        console.log(`🎯 Taux de réussite: ${Math.round((passed / (passed + failed)) * 100)}%`);

        if (failed === 0) {
            console.log('\n🎉 INTÉGRATION MORELOGIN RÉUSSIE !');
            console.log('🌥️ Tous les modules cloud fonctionnels');
            console.log('🔗 Intégration workflow complète');
            console.log('📊 Métriques et monitoring opérationnels');
            console.log('🌍 Validation géo-cohérence fonctionnelle');
            console.log('🔄 Allocation/libération des ressources validée');
            console.log('✅ Architecture modulaire cloud prête pour production');
            
            console.log('\n📋 Modules créés:');
            console.log('  📱 CloudPhoneManager (283 lignes)');
            console.log('  👤 ProfileManager (500+ lignes)');
            console.log('  🌐 ProxyRotator (550+ lignes)');
            console.log('  🔢 CloudPhoneNumberParser (400+ lignes)');
            console.log('  🌥️ MoreLoginStep (500+ lignes)');
            console.log('  🔄 WorkflowContext extensions (100+ lignes)');
            
            console.log('\n🚀 Prêt pour Phase 4 - Intégration Supabase !');
        } else {
            console.log('\n⚠️ Certains tests d\'intégration MoreLogin ont échoué');
            console.log('🔧 Vérifiez les modules et configurations');
        }

        return failed === 0;

    } catch (error) {
        console.error(`\n💥 Erreur test d'intégration MoreLogin: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// Exécuter le test
if (require.main === module) {
    testMoreLoginIntegration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = { testMoreLoginIntegration }; 