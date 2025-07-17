#!/usr/bin/env node

/**
 * Script pour créer un nouveau téléphone cloud MoreLogin (Model X)
 * Version refactorisée utilisant les librairies communes
 */

// Charger les variables d'environnement
require('dotenv').config();

// Importer les librairies communes
const { CLOUD_PHONE_MODELS } = require('../lib/constants');
const { validateConfiguration, findBestResidentialProxy } = require('../lib/utils');
const { 
    checkApiAvailability, 
    getCloudPhoneList, 
    getAvailableProxies,
    activateProxy,
    createCloudPhone
} = require('../lib/api');

/**
 * Trouve et active le meilleur proxy residential disponible
 */
async function findAndActivateBestProxy(proxies, apiType = 'local') {
    // D'abord chercher un proxy déjà actif
    let bestProxy = findBestResidentialProxy(proxies);
    
    if (bestProxy) {
        return bestProxy;
    }
    
    // Si aucun proxy actif, chercher un proxy inactif à activer
    const inactiveProxies = proxies.filter(proxy => 
        proxy.status === 0 && // Inactif
        (proxy.proxyName?.toLowerCase().includes('residential') || 
         proxy.proxyName?.toLowerCase().includes('résidentiel') ||
         proxy.proxyHost) // Ou qui a une configuration valide
    );
    
    if (inactiveProxies.length > 0) {
        const proxyToActivate = inactiveProxies[0];
        console.log(`🔄 Tentative d'activation du proxy: ${proxyToActivate.proxyName || 'Sans nom'}`);
        
        try {
            await activateProxy(proxyToActivate.id, apiType);
            // Marquer le proxy comme actif localement
            proxyToActivate.status = 1;
            return proxyToActivate;
        } catch (error) {
            console.warn(`⚠️ Impossible d'activer le proxy ${proxyToActivate.id}: ${error.message}`);
        }
    }
    
    // Si aucun proxy n'a pu être activé, prendre n'importe quel proxy
    if (proxies.length > 0) {
        console.log('⚠️ Utilisation du premier proxy disponible (même inactif)');
        return proxies[0];
    }
    
    return null;
}

/**
 * Crée un cloud phone avec assignation automatique de proxy
 */
async function createCloudPhoneWithProxy(quantity = 1, customName = null, autoAssignProxy = true, apiType = 'local') {
    console.log('\n🌐 Recherche du meilleur proxy disponible...');
    
    let selectedProxyId = null;
    
    if (autoAssignProxy) {
        try {
            // Récupérer les proxies disponibles
            const proxies = await getAvailableProxies(apiType);
            
            if (proxies.length === 0) {
                console.warn('⚠️ Aucun proxy disponible pour l\'assignation automatique');
            } else {
                // Trouver et activer le meilleur proxy residential
                const bestProxy = await findAndActivateBestProxy(proxies, apiType);
                
                if (bestProxy) {
                    selectedProxyId = bestProxy.id;
                    console.log(`🎯 Proxy sélectionné: ${bestProxy.proxyName || 'Sans nom'} (ID: ${bestProxy.id}) - ${bestProxy.status === 1 ? 'Actif' : 'Inactif'}`);
                } else {
                    console.warn('⚠️ Aucun proxy disponible pour l\'assignation');
                }
            }
        } catch (error) {
            console.warn(`⚠️ Erreur lors de la récupération des proxies: ${error.message}`);
            console.log('💡 Création du cloud phone sans proxy...');
        }
    }
    
    // Créer le cloud phone avec le proxy (si disponible)
    const envName = customName || `CloudPhone-${Date.now()}`;
    const newPhones = await createCloudPhone(quantity, CLOUD_PHONE_MODELS.MODEL_X, envName, selectedProxyId);
    
    console.log('\n📱 Informations du nouveau téléphone:');
    if (newPhones) {
        if (Array.isArray(newPhones)) {
            newPhones.forEach((phoneId, index) => {
                console.log(`   ${index + 1}. ID: ${phoneId} - ${envName}`);
            });
        } else {
            console.log(`   ID: ${newPhones.id || newPhones}`);
            console.log(`   Nom: ${newPhones.envName || envName}`);
        }
    }
    
    return newPhones;
}

/**
 * Fonction principale
 */
async function main() {
    try {
        console.log('🎯 Démarrage du script de création de cloud phone MoreLogin...\n');
        
        // Récupérer les paramètres depuis les arguments de ligne de commande
        const quantity = parseInt(process.argv[2]) || 1;
        const customName = process.argv[3] || null;
        
        // Validation de la configuration
        console.log('⚙️ Validation de la configuration...');
        if (!validateConfiguration()) {
            process.exit(1);
        }
        
        // Vérifier la disponibilité de l'API
        const apiType = await checkApiAvailability();
        
        // Récupérer la liste des téléphones existants
        console.log('\n📱 Téléphones existants:');
        const existingPhones = await getCloudPhoneList(apiType, 50);
        
        if (existingPhones.length === 0) {
            console.log('   Aucun téléphone existant trouvé');
        }
        
        console.log('\n==================================================\n');
        
        // Créer le(s) nouveau(x) téléphone(s)
        const newPhones = await createCloudPhoneWithProxy(quantity, customName, true, apiType);
        
        console.log('\n🎉 Création terminée avec succès !');
        console.log('\n💡 Prochaines étapes:');
        console.log('   1. Attendez que le(s) téléphone(s) soit(soient) prêt(s)');
        console.log('   2. Utilisez startPhone.js pour démarrer et connecter via ADB');
        console.log('   3. Exemple: npm start');
        
    } catch (error) {
        console.error('\n❌ Erreur lors de la création du cloud phone:');
        console.error(`   ${error.message}`);
        process.exit(1);
    }
}

// Exporter les fonctions pour utilisation en tant que module
module.exports = {
    createCloudPhoneWithProxy,
    findAndActivateBestProxy,
    main
};

// Exécuter le script principal si appelé directement
if (require.main === module) {
    main();
}
