#!/usr/bin/env node

/**
 * Script principal pour lancer les workflows WhatsApp
 * Usage: node run.js [options]
 */

const { mainWorkflow } = require('./src/workflow');
const defaultConfig = require('./config');

// Parser les arguments CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    
    switch (arg) {
      case '--env':
        config.env = value;
        i++;
        break;
      case '--country':
        config.country = value;
        i++;
        break;
      case '--parallel':
        config.parallel = parseInt(value) || 1;
        i++;
        break;
      case '--useExistingDevice':
        config.useExistingDevice = value === 'true';
        i++;
        break;
      case '--phonePrefix':
        config.phonePrefix = value;
        i++;
        break;
      case '--customLaunch':
        config.customLaunch = value;
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  return config;
}

// Afficher l'aide
function printHelp() {
  console.log(`
WA-Setup - Création de comptes WhatsApp en parallèle

Usage: node run.js [options]

Options:
  --env <env>              Environnement: morelogin, bluestacks, cloud (défaut: ${defaultConfig.env})
  --country <code>         Code pays: FR, UK, US, etc. (défaut: ${defaultConfig.country})
  --parallel <n>           Nombre de comptes en parallèle (défaut: ${defaultConfig.parallel})
  --useExistingDevice      Utiliser un device existant (défaut: false)
  --phonePrefix <prefix>   Préfixe téléphone personnalisé (ex: +33)
  --customLaunch <script>  Script JavaScript personnalisé à exécuter
  --help, -h               Afficher cette aide

Exemples:
  node run.js                                    # Utilise la config par défaut
  node run.js --env bluestacks --country UK     # BlueStacks avec numéros UK
  node run.js --parallel 5 --phonePrefix +33    # 5 comptes avec préfixe FR
`);
}

// Lancer plusieurs workflows en parallèle
async function runParallel(config) {
  const { parallel, ...workflowConfig } = config;
  
  console.log(`🚀 Lancement de ${parallel} workflow(s) en parallèle`);
  console.log(`📋 Configuration:`, {
    env: workflowConfig.env,
    country: workflowConfig.country,
    useExistingDevice: workflowConfig.useExistingDevice
  });
  console.log('═'.repeat(50));
  
  // Créer les promesses pour chaque workflow
  const promises = [];
  for (let i = 0; i < parallel; i++) {
    const instanceConfig = {
      ...workflowConfig,
      instanceId: i + 1,
      devicePort: config.device?.bluestacksPorts?.[i] // Port différent pour chaque instance
    };
    
    promises.push(
      mainWorkflow(instanceConfig)
        .then(result => ({
          instanceId: i + 1,
          success: true,
          result
        }))
        .catch(error => ({
          instanceId: i + 1,
          success: false,
          error: error.message
        }))
    );
    
    // Délai entre les lancements pour éviter les conflits
    if (i < parallel - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Attendre tous les workflows
  const results = await Promise.all(promises);
  
  // Afficher le résumé
  console.log('\n' + '═'.repeat(50));
  console.log('📊 RÉSUMÉ DES WORKFLOWS:');
  
  let successCount = 0;
  results.forEach(({ instanceId, success, result, error }) => {
    if (success) {
      successCount++;
      console.log(`✅ Instance ${instanceId}: Succès (${result.phoneNumber})`);
    } else {
      console.log(`❌ Instance ${instanceId}: Échec (${error})`);
    }
  });
  
  console.log(`\n🎯 Total: ${successCount}/${parallel} réussis`);
  console.log('═'.repeat(50));
  
  return results;
}

// Point d'entrée principal
async function main() {
  try {
    const config = parseArgs();
    await runParallel(config);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Lancer si exécuté directement
if (require.main === module) {
  main();
}

module.exports = { runParallel, parseArgs }; 