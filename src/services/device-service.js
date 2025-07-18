/**
 * Device Service minimaliste
 * Gère les environnements : morelogin, bluestacks, cloud
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// État global des devices
const devices = new Map();

/**
 * Créer un nouveau device selon l'environnement
 */
async function createNewDevice(env, config = {}) {
  switch (env) {
    case 'morelogin':
      return await createMoreLoginDevice(config);
    
    case 'bluestacks':
      return await createBlueStacksDevice(config);
    
    case 'cloud':
      return await createCloudDevice(config);
    
    default:
      throw new Error(`Environnement non supporté: ${env}`);
  }
}

/**
 * Lancer un device existant
 */
async function launchExistingDevice(env, deviceId, config = {}) {
  switch (env) {
    case 'morelogin':
      return await launchMoreLoginDevice(deviceId, config);
    
    case 'bluestacks':
      return await launchBlueStacksDevice(deviceId, config);
    
    case 'cloud':
      return await launchCloudDevice(deviceId, config);
    
    default:
      throw new Error(`Environnement non supporté: ${env}`);
  }
}

// Implémentations MoreLogin
async function createMoreLoginDevice(config) {
  // Simulation simple pour MoreLogin
  const deviceId = `morelogin-${Date.now()}`;
  const device = {
    id: deviceId,
    type: 'morelogin',
    status: 'created',
    config
  };
  
  devices.set(deviceId, device);
  console.log(`📱 Device MoreLogin créé: ${deviceId}`);
  return device;
}

async function launchMoreLoginDevice(deviceId, config) {
  const device = devices.get(deviceId) || { id: deviceId, type: 'morelogin' };
  device.status = 'running';
  console.log(`🚀 Device MoreLogin lancé: ${deviceId}`);
  return device;
}

// Implémentations BlueStacks
async function createBlueStacksDevice(config) {
  const port = config.devicePort || 5555;
  const deviceId = `127.0.0.1:${port}`;
  
  // Connecter via ADB
  try {
    await execAsync(`adb connect ${deviceId}`);
    console.log(`📱 Device BlueStacks connecté: ${deviceId}`);
  } catch (error) {
    console.warn(`⚠️ Connexion ADB: ${error.message}`);
  }
  
  const device = {
    id: deviceId,
    type: 'bluestacks',
    port,
    status: 'connected'
  };
  
  devices.set(deviceId, device);
  return device;
}

async function launchBlueStacksDevice(deviceId, config) {
  const device = devices.get(deviceId) || { id: deviceId, type: 'bluestacks' };
  
  // Vérifier la connexion
  try {
    await execAsync(`adb -s ${deviceId} shell echo "test"`);
    device.status = 'running';
    console.log(`🚀 Device BlueStacks actif: ${deviceId}`);
  } catch (error) {
    throw new Error(`Device non connecté: ${deviceId}`);
  }
  
  return device;
}

// Implémentations Cloud (API générique)
async function createCloudDevice(config) {
  // Simulation pour cloud API
  const deviceId = `cloud-${Date.now()}`;
  const device = {
    id: deviceId,
    type: 'cloud',
    apiUrl: config.apiUrl || 'https://api.cloudphones.com',
    status: 'created'
  };
  
  devices.set(deviceId, device);
  console.log(`☁️ Device Cloud créé: ${deviceId}`);
  return device;
}

async function launchCloudDevice(deviceId, config) {
  const device = devices.get(deviceId) || { id: deviceId, type: 'cloud' };
  device.status = 'running';
  console.log(`☁️ Device Cloud lancé: ${deviceId}`);
  return device;
}

// Fonctions utilitaires
async function executeCommand(device, command) {
  switch (device.type) {
    case 'bluestacks':
      return await execAsync(`adb -s ${device.id} ${command}`);
    
    case 'morelogin':
    case 'cloud':
      // Simulation pour les environnements cloud
      console.log(`Commande simulée sur ${device.type}: ${command}`);
      return { stdout: 'OK', stderr: '' };
    
    default:
      throw new Error(`Type de device non supporté: ${device.type}`);
  }
}

async function takeScreenshot(device, filename) {
  if (device.type === 'bluestacks') {
    const remotePath = '/sdcard/screenshot.png';
    await executeCommand(device, `shell screencap -p ${remotePath}`);
    await executeCommand(device, `pull ${remotePath} ${filename}`);
    await executeCommand(device, `shell rm ${remotePath}`);
  } else {
    console.log(`Screenshot simulé pour ${device.type}: ${filename}`);
  }
}

// Export du service
module.exports = {
  createNewDevice,
  launchExistingDevice,
  executeCommand,
  takeScreenshot,
  getDeviceService: () => ({
    createNewDevice,
    launchExistingDevice,
    executeCommand,
    takeScreenshot
  })
};