require('dotenv').config();
const axios = require('axios');

// Configuration
const SMS_API_URL = 'https://api.sms-activate.org/stubs/handler_api.php';
const WHATSAPP_SERVICE_ID = 'wa';

// Mapping des opérateurs UK (basé sur les préfixes mobiles UK)
const UK_OPERATORS = {
  '07700': 'Vodafone',
  '07701': 'Vodafone', 
  '07702': 'Vodafone',
  '07710': 'O2',
  '07711': 'O2',
  '07712': 'O2',
  '07720': 'EE',
  '07721': 'EE',
  '07722': 'EE',
  '07730': 'Three',
  '07731': 'Three',
  '07732': 'Three',
  '07740': 'Giffgaff',
  '07750': 'Tesco Mobile',
  '07760': 'Virgin Mobile',
  '07770': 'O2',
  '07780': 'EE',
  '07790': 'Vodafone',
  // Ajout de préfixes génériques
  '077': 'Mobile UK',
  '078': 'Mobile UK',
  '079': 'Mobile UK'
};

/**
 * Analyser le statut détaillé des numéros UK
 */
async function analyzeUKAvailability() {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) {
    console.error('❌ SMS_ACTIVATE_API_KEY manquante');
    return;
  }

  console.log('🇬🇧 ANALYSE DÉTAILLÉE UK - DISPONIBILITÉ NUMÉROS\n');
  console.log('═'.repeat(60));

  try {
    // 1. Solde
    console.log('💳 Vérification du solde...');
    const balanceResponse = await axios.get(SMS_API_URL, {
      params: { api_key: apiKey, action: 'getBalance' }
    });
    const balance = balanceResponse.data.replace('ACCESS_BALANCE:', '');
    console.log(`💰 Solde actuel: ${balance}₽\n`);

    // 2. Prix UK
    console.log('💵 Vérification des prix UK...');
    const pricesResponse = await axios.get(SMS_API_URL, {
      params: { api_key: apiKey, action: 'getPrices', service: 'wa', country: 16 }
    });
    
    const priceData = pricesResponse.data;
    if (priceData['16'] && priceData['16']['wa']) {
      const waData = priceData['16']['wa'];
      console.log(`💰 Prix: ${waData.cost}₽ par numéro`);
      console.log(`📊 Stock total: ${waData.count} numéros`);
      console.log(`📱 Stock physique: ${waData.physicalCount} numéros\n`);
    }

    // 3. Status détaillé
    console.log('📊 Status détaillé des services UK...');
    const statusResponse = await axios.get(SMS_API_URL, {
      params: { api_key: apiKey, action: 'getNumbersStatus', country: 16 }
    });

    const statusData = statusResponse.data;
    if (typeof statusData === 'object') {
      console.log(`\n📋 Services disponibles pour UK (${Object.keys(statusData).length} total):`);
      
      // WhatsApp spécifique
      if (statusData['wa']) {
        console.log(`🔥 WhatsApp (wa): ${statusData['wa']} numéros`);
      }
      
      // Top 10 services les plus populaires
      const sortedServices = Object.entries(statusData)
        .sort(([,a], [,b]) => parseInt(b) - parseInt(a))
        .slice(0, 10);
        
      console.log('\n🏆 Top 10 services les plus disponibles:');
      sortedServices.forEach(([service, count], index) => {
        const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📱';
        console.log(`${icon} ${service.padEnd(8)} | ${String(count).padStart(6)} numéros`);
      });
    }

    // 4. Test d'obtention de numéros
    console.log('\n🔄 Test d\'obtention de numéros UK...');
    await testNumberRetrieval(apiKey);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.response) {
      console.error('📡 Status:', error.response.status);
      console.error('📄 Data:', error.response.data);
    }
  }
}

/**
 * Tester l'obtention de numéros avec retry intelligent
 */
async function testNumberRetrieval(apiKey) {
  const MAX_ATTEMPTS = 10;
  let attempts = 0;
  let successful = 0;
  const obtainedNumbers = [];

  while (attempts < MAX_ATTEMPTS && successful < 3) {
    attempts++;
    
    try {
      console.log(`🔄 Tentative ${attempts}/${MAX_ATTEMPTS}...`);
      
      const response = await axios.get(SMS_API_URL, {
        params: {
          api_key: apiKey,
          action: 'getNumber',
          service: 'wa',
          country: 16
        }
      });

      if (response.data.includes('ACCESS_NUMBER')) {
        const [, activationId, phoneNumber] = response.data.split(':');
        successful++;
        
        console.log(`✅ Succès ${successful}: +${phoneNumber} (ID: ${activationId})`);
        
        // Analyser l'opérateur
        const operator = detectOperator(phoneNumber);
        console.log(`📡 Opérateur détecté: ${operator}`);
        
        obtainedNumbers.push({
          id: activationId,
          number: phoneNumber,
          operator: operator
        });

        // Annuler immédiatement pour test
        await axios.get(SMS_API_URL, {
          params: {
            api_key: apiKey,
            action: 'setStatus',
            id: activationId,
            status: 8
          }
        });
        console.log(`🗑️ Numéro ${activationId} annulé\n`);
        
      } else if (response.data === 'NO_NUMBERS') {
        console.log(`❌ Pas de numéros disponibles (tentative ${attempts})`);
      } else if (response.data === 'NO_BALANCE') {
        console.log('❌ Solde insuffisant - Arrêt des tests');
        break;
      } else {
        console.log(`❓ Réponse: ${response.data}`);
      }
      
      // Délai entre tentatives
      if (attempts < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`❌ Erreur tentative ${attempts}:`, error.message);
    }
  }

  // Résumé
  console.log('\n📊 RÉSUMÉ DU TEST:');
  console.log(`🔄 Tentatives: ${attempts}`);
  console.log(`✅ Réussites: ${successful}`);
  console.log(`📱 Taux de succès: ${((successful/attempts) * 100).toFixed(1)}%`);
  
  if (obtainedNumbers.length > 0) {
    console.log('\n📡 Opérateurs obtenus:');
    const operatorCounts = {};
    obtainedNumbers.forEach(num => {
      operatorCounts[num.operator] = (operatorCounts[num.operator] || 0) + 1;
    });
    
    Object.entries(operatorCounts).forEach(([op, count]) => {
      console.log(`  ${op}: ${count} numéro(s)`);
    });
  }
}

/**
 * Détecter l'opérateur basé sur le préfixe
 */
function detectOperator(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  
  // Vérifier les préfixes spécifiques
  for (const [prefix, operator] of Object.entries(UK_OPERATORS)) {
    if (cleanNumber.startsWith('44' + prefix.substring(1))) {
      return operator;
    }
  }
  
  // Vérifier si c'est un numéro mobile UK
  if (cleanNumber.startsWith('447')) {
    return 'Mobile UK (Inconnu)';
  } else if (cleanNumber.startsWith('44')) {
    return 'Fixe UK';
  }
  
  return 'Opérateur Inconnu';
}

/**
 * Comparaison avec d'autres pays
 */
async function compareWithOtherCountries() {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  const countries = {
    'UK': 16,
    'France': 1,
    'Indonesia': 6,
    'Philippines': 4,
    'Vietnam': 10,
    'Thailand': 52,
    'India': 22
  };

  console.log('\n🌍 COMPARAISON INTERNATIONALE:');
  console.log('═'.repeat(50));
  console.log('Pays          | Numéros  | Prix    | Status');
  console.log('─'.repeat(50));

  for (const [name, code] of Object.entries(countries)) {
    try {
      // Status
      const statusResponse = await axios.get(SMS_API_URL, {
        params: { api_key: apiKey, action: 'getNumbersStatus', country: code, service: 'wa' }
      });
      
      const waCount = statusResponse.data['wa'] || 0;
      
      // Prix
      let price = 'N/A';
      try {
        const priceResponse = await axios.get(SMS_API_URL, {
          params: { api_key: apiKey, action: 'getPrices', service: 'wa', country: code }
        });
        
        if (priceResponse.data[code] && priceResponse.data[code]['wa']) {
          price = `${priceResponse.data[code]['wa'].cost}₽`;
        }
      } catch (e) {
        // Prix non disponible
      }
      
      // Test d'obtention rapide
      let status = '❌';
      try {
        const testResponse = await axios.get(SMS_API_URL, {
          params: { api_key: apiKey, action: 'getNumber', service: 'wa', country: code }
        });
        
        if (testResponse.data.includes('ACCESS_NUMBER')) {
          status = '✅';
          // Annuler immédiatement
          const [, activationId] = testResponse.data.split(':');
          await axios.get(SMS_API_URL, {
            params: { api_key: apiKey, action: 'setStatus', id: activationId, status: 8 }
          });
        } else if (testResponse.data === 'NO_BALANCE') {
          status = '💰';
        }
      } catch (e) {
        status = '❌';
      }
      
      console.log(`${name.padEnd(12)} | ${String(waCount).padStart(7)} | ${price.padEnd(6)} | ${status}`);
      
      // Délai pour éviter rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`${name.padEnd(12)} | ERROR   | ERROR  | ❌`);
    }
  }
  
  console.log('─'.repeat(50));
  console.log('Légende: ✅=Disponible, ❌=Indisponible, 💰=Solde insuffisant');
}

// Fonction principale
async function main() {
  console.log('🔍 SMS-Activate UK Analysis Tool\n');
  
  await analyzeUKAvailability();
  await compareWithOtherCountries();
  
  console.log('\n🎯 ANALYSE TERMINÉE');
  console.log('═'.repeat(60));
}

// Export pour utilisation en module
module.exports = {
  analyzeUKAvailability,
  compareWithOtherCountries,
  detectOperator,
  UK_OPERATORS
};

// Lancement direct si appelé
if (require.main === module) {
  main().catch(console.error);
} 