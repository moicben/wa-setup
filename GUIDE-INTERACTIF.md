# 📱 Guide du Mode Interactif WhatsApp

## 🚀 Démarrage rapide

### 1. Lancer le mode interactif
```bash
# Avec npm (recommandé)
npm run interactive <phone_id>

# Directement avec node
node scripts/interactive-phone.js <phone_id>
```

**Exemples :**
```bash
npm run interactive 1646814214559087     # Avec l'ID exact
npm run interactive "CP-1"               # Avec le nom du téléphone
npm run interactive 1                    # Avec l'index (1er téléphone)
```

### 2. Une fois connecté

Le script va :
1. ✅ Se connecter à ton téléphone MoreLogin
2. ✅ Activer ADB si nécessaire  
3. ✅ Lancer WhatsApp
4. ✅ Ouvrir un terminal interactif

Tu verras quelque chose comme :
```
📱 CP-1 > 
```

### 3. Commandes de base

```javascript
// Voir toutes les commandes disponibles
info()
help()

// Tests rapides
await click(100, 200)           // Cliquer à une position
await text("Hello World")       // Saisir du texte
await screenshot()              // Prendre une capture
await wait(2000)                // Attendre 2 secondes

// État de la connexion
status()
```

## 🎯 Commandes principales

### **Navigation de base**
```javascript
await click(x, y)                     // Cliquer
await swipe(x1, y1, x2, y2, ms)      // Glisser
await key(3)                         // Touche HOME
await key(4)                         // Touche RETOUR
await key(66)                        // Touche ENTRÉE
```

### **WhatsApp spécifique**
```javascript
await whatsapp.open()                // Ouvrir WhatsApp
await whatsapp.business()            // Ouvrir WhatsApp Business
await whatsapp.close()               // Fermer (retour accueil)

// Workflow complet d'envoi de message
await whatsapp.sendMessage("0123456789", "Salut depuis le script!")
```

### **Système**
```javascript
await apps()                         // Lister toutes les apps
await findApp("whatsapp")           // Chercher une app
await launch("com.whatsapp")        // Lancer une app
await shell("pm list packages")     // Commande shell
await screenshot("capture.png")     // Capture avec nom
```

### **Tests intégrés**
```javascript
await test.click()                   // Test de clic
await test.swipe()                   // Test de glissement  
await test.screenshot()              // Test de capture
await test.whatsapp()               // Test complet WhatsApp
```

## 🧪 Exemples d'utilisation

### Exemple 1: Test simple
```javascript
// Prendre une capture de l'état actuel
await screenshot("etat-initial.png")

// Cliquer au centre de l'écran
await click(360, 640)

// Attendre 2 secondes
await wait(2000)

// Nouvelle capture
await screenshot("apres-clic.png")
```

### Exemple 2: Automatiser WhatsApp
```javascript
// Ouvrir WhatsApp
await whatsapp.open()
await wait(3000)

// Prendre une capture de WhatsApp ouvert
await screenshot("whatsapp-ouvert.png")

// Envoyer un message complet
await whatsapp.sendMessage("0123456789", "Message de test depuis le script!")
```

### Exemple 3: Explorer les applications
```javascript
// Voir toutes les apps installées
const apps = await apps()

// Chercher WhatsApp spécifiquement
const whatsappApps = await findApp("whatsapp")
console.log(whatsappApps)

// Lancer une app spécifique
await launch("com.whatsapp.w4b")
```

## 🔧 Tips & Astuces

### **Coordonnées d'écran**
- La plupart des téléphones cloud ont une résolution de **720x1280**
- Centre de l'écran : `(360, 640)`
- Pour trouver des coordonnées précises, utilise `await screenshot()` puis analyse l'image

### **Touches utiles**
```javascript
key(3)   // HOME - Retour à l'accueil
key(4)   // BACK - Bouton retour
key(66)  // ENTER - Valider
key(67)  // DELETE - Supprimer
key(26)  // VOLUME UP
key(25)  // VOLUME DOWN
```

### **Gestion des erreurs**
```javascript
try {
    await whatsapp.sendMessage("123", "test")
} catch (error) {
    console.log("Erreur:", error.message)
    await screenshot("erreur.png")
}
```

### **Workflows avancés**
```javascript
// Séquence complexe avec vérifications
await whatsapp.open()
await wait(3000)
await screenshot("step1.png")

await whatsapp.clickNewChat()
await wait(1000)
await screenshot("step2.png")

await text("0123456789")
await wait(500)
await key(66) // ENTER
await wait(2000)
await screenshot("step3.png")
```

## 🚪 Sortir du mode interactif

```bash
.exit          # Quitter le mode interactif
# ou Ctrl+C    # Forcer la sortie
```

## ⚠️ Important

1. **Toujours utiliser `await`** devant les commandes asynchrones
2. **Prendre des captures** régulièrement pour diagnostiquer
3. **Utiliser `wait()`** entre les actions pour laisser le temps au téléphone
4. **Tester les coordonnées** avec `click()` avant d'automatiser

## 🆘 En cas de problème

```javascript
// Vérifier l'état de la connexion
status()

// Prendre une capture pour voir l'état actuel
await screenshot("debug.png")

// Revenir à l'accueil si bloqué
await key(3)
await wait(2000)

// Relancer WhatsApp
await whatsapp.open()
```

---

🎉 **Tu es maintenant prêt à tester des commandes en live !**

Commence par `npm run interactive <ton_phone_id>` puis `info()` pour voir toutes les commandes disponibles. 