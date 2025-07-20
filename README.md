 
# WA-Setup : Outil Simplifié pour Créer des Comptes WhatsApp en Parallèle

## Description
Ce projet permet de créer des comptes WhatsApp en parallèle, de manière modulaire et flexible, sur différents environnements (MoreLogin, BlueStacks local, ou API cloud). Il est minimaliste, configurable via CLI ou fichier config, et focalisé sur l'essentiel : gestion de devices, SMS, et workflow WhatsApp.

## Structure des Fichiers
- package.json : Dépendances essentielles.
- config.js : Configuration par défaut (ex. env, country, parallel).
- run.js : Script principal pour lancer les workflows en parallèle.
- src/
  - workflow.js : Workflow principal configurable.
  - services/ : device-service.js, sms-service.js, whatsapp-service.js.
  - utils/ : helpers.js, logger.js.
- tests/ : test-workflow.js (tests basiques).

## Installation
```bash
npm install
```

## Utilisation
Lancer via CLI avec options personnalisées :

- Basique : `node run.js` (utilise config par défaut, ex. 3 comptes UK sur MoreLogin).
- Personnalisé : `node run.js --env bluestacks --country FR --parallel 5 --useExistingDevice true`.
- Autres options : --phonePrefix +33, --customLaunch 'adb shell ...'.

Pour plus de détails, éditez config.js.

## Configuration
Dans config.js :
```js
module.exports = {
  env: 'morelogin', // morelogin, bluestacks, cloud
  country: 'UK',
  parallel: 3,
  useExistingDevice: false,
  // etc.
};
```

## Logs et Screenshots
- Logs en console (option pour fichiers).
- Screenshots optionnels dans screenshots/ (activables via config).

## Résolution de Problèmes
- Vérifiez les ports pour BlueStacks (ex. adb connect 127.0.0.1:5555).
- Pour ADB : Utilisez des commandes comme `adb shell input tap x y` pour interactions.

## Notes
- Parallelisation via Promise.all dans run.js.
- Extensible : Ajoutez de nouveaux services dans src/services/. 