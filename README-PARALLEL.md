# Guide d'utilisation Multi-Devices BlueStacks

## Configuration requise

1. **BlueStacks** avec plusieurs instances actives sur des ports différents :
   - Instance 1 : `127.0.0.1:5585` (défaut)
   - Instance 2 : `127.0.0.1:5586`
   - Instance 3 : `127.0.0.1:5587`
   - etc.

2. **ADB** doit pouvoir se connecter à toutes les instances

## Utilisation simple

### Lancer 3 devices en parallèle (défaut)
```bash
npm run parallel
```

### Lancer un nombre spécifique de devices
```bash
# 2 devices
npm run parallel-2

# 5 devices  
npm run parallel-5

# Nombre personnalisé
DEVICE_COUNT=4 npm run parallel
```

### Choisir le pays
```bash
# UK (défaut)
npm run parallel-uk

# France
npm run parallel-fr

# USA
npm run parallel-us

# Combinaison
DEVICE_COUNT=2 COUNTRY=FR npm run parallel
```

### Ports personnalisés
```bash
# Utiliser des ports spécifiques
DEVICE_PORTS="5585,5605" npm run parallel
```

## Structure des logs

Les logs sont organisés par device :
```
logs/
├── device1/
│   ├── workflow.log
│   └── errors.log
├── device2/
│   ├── workflow.log
│   └── errors.log
└── device3/
    ├── workflow.log
    └── errors.log
```

Screenshots également organisés par device :
```
screenshots/
├── device1/
├── device2/
└── device3/
```

## Monitoring

Pendant l'exécution, chaque log est préfixé par l'ID du device :
```
[Device1] 🚀 Initialisation Device Service (127.0.0.1:5585)...
[Device2] 🚀 Initialisation Device Service (127.0.0.1:5586)...
[Device3] 🚀 Initialisation Device Service (127.0.0.1:5587)...
```

## Arrêt propre

Utilisez `Ctrl+C` pour arrêter tous les workflows proprement.

## Résolution de problèmes

### Erreur "more than one device/emulator"
Cette erreur a été corrigée. Le système spécifie maintenant automatiquement le device pour chaque commande ADB.

### Un device ne se connecte pas
Vérifiez que le port est correct et que BlueStacks est bien lancé sur ce port :
```bash
adb connect 127.0.0.1:5586
adb devices
```

### Performance
- Recommandé : Maximum 3-4 devices simultanés
- Laissez 2 secondes entre chaque lancement (automatique)
- Surveillez l'utilisation CPU/RAM

## Variables d'environnement

- `DEVICE_COUNT` : Nombre de devices (défaut: 3)
- `COUNTRY` : Pays pour les comptes (UK/FR/US, défaut: UK)
- `DEVICE_PORTS` : Liste de ports séparés par virgules
- `DEVICE_PORT` : Port pour un seul device
- `DEVICE_ID` : Identifiant du device pour les logs
- `DEVICE_HOST` : Adresse complète du device