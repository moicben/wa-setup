/**
 * Test de création réelle d'un profil Phone Cloud Model X
 * Teste si on arrive vraiment à créer un profil dans MoreLogin
 */

require('dotenv').config();

const { MoreLoginApiClient } = require('./src/services/device/providers/MoreLoginApiClient');

async function testRealProfileCreation() {
    console.log('🧪 TEST CRÉATION RÉELLE PROFIL PHONE CLOUD MODEL X');
    console.log('================================================');
    
    const client = new MoreLoginApiClient();
    
    // 1. Vérifier état initial
    console.log('\n📋 1. État initial des profils');
    const initialProfiles = await client.getProfiles();
    console.log(`   Profils existants: ${initialProfiles.length}`);
    
    if (initialProfiles.length > 0) {
        console.log('   Profils actuels:');
        initialProfiles.forEach((profile, index) => {
            console.log(`     ${index + 1}. ${profile.name || profile.id || 'Sans nom'} - ${profile.status || 'Statut inconnu'}`);
        });
    }
    
    // 2. Créer un nouveau profil
    console.log('\n📋 2. Création nouveau profil Phone Cloud Model X');
    let newProfile = null;
    let profileId = null;
    
    try {
        console.log('   Tentative de création...');
        newProfile = await client.createPhoneCloudProfile({
            name: `TestPhoneCloud_${Date.now()}`,
            country: 'UK'
        });
        
        console.log('   ✅ Réponse API:');
        console.log(JSON.stringify(newProfile, null, 2));
        
        if (newProfile.id) {
            profileId = newProfile.id;
            console.log(`   ✅ ID profil créé: ${profileId}`);
        } else if (newProfile.data && newProfile.data.id) {
            profileId = newProfile.data.id;
            console.log(`   ✅ ID profil créé: ${profileId}`);
        }
        
    } catch (error) {
        console.log('   ❌ Erreur création:', error.message);
        console.log('   📋 Détails erreur:');
        console.log(error);
    }
    
    // 3. Vérifier la liste après création
    console.log('\n📋 3. Vérification liste après création');
    const updatedProfiles = await client.getProfiles();
    console.log(`   Profils après création: ${updatedProfiles.length}`);
    
    if (updatedProfiles.length > initialProfiles.length) {
        console.log('   ✅ Nouveau profil détecté!');
        const newProfiles = updatedProfiles.filter(p => 
            !initialProfiles.some(initial => initial.id === p.id)
        );
        console.log('   Nouveaux profils:');
        newProfiles.forEach((profile, index) => {
            console.log(`     ${index + 1}. ${profile.name || profile.id || 'Sans nom'}`);
            console.log(`        Status: ${profile.status || 'Inconnu'}`);
            console.log(`        Type: ${profile.phoneType || profile.type || 'Inconnu'}`);
        });
    } else {
        console.log('   ❌ Aucun nouveau profil détecté');
    }
    
    // 4. Si on a un ID, tester le statut
    if (profileId) {
        console.log('\n📋 4. Vérification statut profil créé');
        try {
            const status = await client.getProfileStatus(profileId);
            console.log('   ✅ Statut profil:');
            console.log(JSON.stringify(status, null, 2));
        } catch (error) {
            console.log('   ❌ Erreur statut:', error.message);
        }
    }
    
    // 5. Nettoyage optionnel
    if (profileId) {
        console.log('\n📋 5. Nettoyage (optionnel)');
        console.log('   ℹ️  Profil créé avec ID:', profileId);
        console.log('   ℹ️  Vous pouvez le supprimer manuellement si nécessaire');
        
        // Optionnel: suppression automatique
        // try {
        //     await client.deleteProfile(profileId);
        //     console.log('   ✅ Profil supprimé');
        // } catch (error) {
        //     console.log('   ❌ Erreur suppression:', error.message);
        // }
    }
    
    console.log('\n================================================');
    console.log('🎯 RÉSUMÉ DU TEST');
    console.log(`   Profils initiaux: ${initialProfiles.length}`);
    console.log(`   Profils finaux: ${updatedProfiles.length}`);
    console.log(`   Différence: ${updatedProfiles.length - initialProfiles.length}`);
    
    if (updatedProfiles.length > initialProfiles.length) {
        console.log('   ✅ SUCCESS: Profil créé avec succès!');
        return true;
    } else {
        console.log('   ❌ ÉCHEC: Aucun profil créé');
        return false;
    }
}

// Exécuter le test
if (require.main === module) {
    testRealProfileCreation().catch(console.error);
}

module.exports = { testRealProfileCreation };