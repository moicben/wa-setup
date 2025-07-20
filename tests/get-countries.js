const axios = require('axios');
require('dotenv').config();

async function getCountriesList() {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) {
    console.error('❌ SMS_ACTIVATE_API_KEY manquante');
    return;
  }

  try {
    console.log('🌍 Récupération de la liste des pays SMS-Activate...\n');
    
    const response = await axios.get('https://api.sms-activate.org/stubs/handler_api.php', {
      params: {
        api_key: apiKey,
        action: 'getCountries'
      }
    });

    console.log('📋 Liste des pays disponibles:');
    // Affiche les 20 premiers résultats avec nom lisible
    if (typeof response.data === 'object') {
      const entries = Object.entries(response.data).slice(0, 20);
      entries.forEach(([code, countryObj]) => {
        // countryObj est un objet, on affiche le nom s'il existe
        if (countryObj && typeof countryObj === 'object' && countryObj.hasOwnProperty('name')) {
          console.log(`${code} : ${countryObj.name}`);
        } else {
          console.log(`${code} : ${JSON.stringify(countryObj)}`);
        }
      });
    } else {
      console.log(response.data);
    }
    
    // Si c'est du JSON, on l'affiche proprement
    if (typeof response.data === 'object') {
      Object.entries(response.data).forEach(([code, name]) => {
        if (name.toLowerCase().includes('kingdom') || 
            name.toLowerCase().includes('britain') || 
            name.toLowerCase().includes('uk') ||
            name.toLowerCase().includes('england')) {
          console.log(`🇬🇧 TROUVÉ UK: ${code} = ${name}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

getCountriesList().catch(console.error); 