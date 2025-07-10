/**
 * Debug de l'authentification MoreLogin
 * Teste différentes méthodes d'authentification
 */

require('dotenv').config();

const { MoreLoginApiClient } = require('./src/services/device/providers/MoreLoginApiClient');

async function debugAuthentication() {
    console.log('🔍 DEBUG AUTHENTIFICATION MORELOGIN');
    console.log('===================================');
    
    console.log('Configuration actuelle:');
    console.log(`   API URL: ${process.env.MORELOGIN_API_URL}`);
    console.log(`   API ID: ${process.env.MORELOGIN_API_ID}`);
    console.log(`   API Key: ${process.env.MORELOGIN_API_KEY?.substring(0, 8)}...`);
    
    const client = new MoreLoginApiClient();
    
    // Test 1: Health check (qui fonctionne)
    console.log('\n📋 1. Health check (endpoint qui fonctionne)');
    try {
        const health = await client.healthCheck();
        console.log('   ✅ Health check réussi:', health);
    } catch (error) {
        console.log('   ❌ Health check échoué:', error.message);
    }
    
    // Test 2: Profiles list (qui fonctionne)
    console.log('\n📋 2. Liste profils (endpoint qui fonctionne)');
    try {
        const profiles = await client.getProfiles();
        console.log('   ✅ Liste profils réussie:', profiles);
    } catch (error) {
        console.log('   ❌ Liste profils échouée:', error.message);
    }
    
    // Test 3: Test authentification différente
    console.log('\n📋 3. Test authentification alternative');
    try {
        // Tenter une requête POST simple
        const response = await client.request('POST', '/api/test', { test: true });
        console.log('   ✅ POST test réussi:', response);
    } catch (error) {
        console.log('   ❌ POST test échoué:', error.message);
    }
    
    // Test 4: Debug des headers
    console.log('\n📋 4. Debug headers authentification');
    console.log('   Headers envoyés:');
    console.log(`     Authorization: Bearer ${process.env.MORELOGIN_API_KEY}`);
    console.log(`     X-API-ID: ${process.env.MORELOGIN_API_ID}`);
    console.log(`     Content-Type: application/json`);
    
    // Test 5: Tester avec curl équivalent
    console.log('\n📋 5. Commande curl équivalente:');
    console.log(`curl -X POST "${process.env.MORELOGIN_API_URL}/api/profile/create" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "Authorization: Bearer ${process.env.MORELOGIN_API_KEY}" \\`);
    console.log(`  -H "X-API-ID: ${process.env.MORELOGIN_API_ID}" \\`);
    console.log(`  -d '{"name":"test","phoneType":"PhoneCloudModelX"}'`);
    
    // Test 6: Analyser les métriques
    console.log('\n📋 6. Métriques client');
    const metrics = client.getMetrics();
    console.log('   Métriques:');
    console.log(`     Total requêtes: ${metrics.totalRequests}`);
    console.log(`     Succès: ${metrics.successfulRequests}`);
    console.log(`     Échecs: ${metrics.failedRequests}`);
    console.log(`     Taux succès: ${metrics.successRate.toFixed(2)}%`);
    
    console.log('\n===================================');
    console.log('🎯 DIAGNOSTIC');
    console.log('   - Health check et liste profils fonctionnent');
    console.log('   - Authentification échoue sur les endpoints POST');
    console.log('   - Possible différence d\'authentification entre GET et POST');
    console.log('   - Vérifier si l\'API MoreLogin locale nécessite une authentification spécifique');
}

// Exécuter le debug
if (require.main === module) {
    debugAuthentication().catch(console.error);
}

module.exports = { debugAuthentication };