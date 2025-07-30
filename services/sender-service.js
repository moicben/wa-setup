/* Service d'envoi de messages
    sur l'application WhatsApp        
*/

// Importer le service de WhatsApp
const { getWhatsAppService } = require('./whatsapp-service');
const { tap, press, sleep, randomSleep } = require('../utils/helpers');
const { executeCommand, takeScreenshot } = require('../utils/adb');
const { isPhoneWhatsApp } = require('../utils/ocr');

const UI_ELEMENTS = {
    searhInput: { x: 540, y: 205 },
    messageInput: { x: 540, y: 1840 },
    imageInput: { x: 820, y: 1840 },
    galleryMode: { x: 270, y: 1450 },
    firstImage: { x: 120, y: 1200 },
    sendButton: { x: 1020, y: 1840 },
    returnButton: { x: 30, y: 100 },
    preventNotWhatsApp: { x: 825, y: 1040 }
}

// Nettoyer le numéro du contact pour utilisation wa.me/
async function phoneWaCleaner(phone) {
    // Nettoyer le début du numéro du contact (pas le reste)
    let phoneNumber = phone.replace('+', '').replace(/ /g, '');
    if (phoneNumber.startsWith('06')) {
        phoneNumber = '336' + phoneNumber.slice(2);
    } else if (phoneNumber.startsWith('07')) {
        phoneNumber = '337' + phoneNumber.slice(2);
    }
    else if (phoneNumber.startsWith('0044')) {
        phoneNumber = '44' + phoneNumber.slice(4);
    }
    return phoneNumber;
}

// Sélectionner une version aléatoire du message
function selectRandomMessage(message) {
    // Si c'est un string simple, le retourner
    if (typeof message === 'string') {
        return message;
    }
    
    // Si c'est un objet avec plusieurs versions
    if (typeof message === 'object') {
        const versions = Object.values(message);
        if (versions.length === 1) {
            return versions[0];
        }
        // Sélection aléatoire
        const randomIndex = Math.floor(Math.random() * versions.length);
        return versions[randomIndex];
    }
    
    return message;
}

// Envoyer un message à un numéro WhatsApp
async function sendMessage(device, phone, message, campaign_id) {

    // Initialiser le statut du contact
    let contactedState = 'in_progress';

    // Sélectionner la version du message à envoyer
    const selectedMessage = selectRandomMessage(message);

    // Nettoyer le numéro du contact
    const phoneNumber = await phoneWaCleaner(phone);

    // Ouvrir le numéro dans WhatsApp
    await executeCommand(device, `shell am start -a android.intent.action.VIEW -d "https://wa.me/${phoneNumber}"`);    
    await sleep(3000);

    // Vérifier si numéro enregistré avec OCR
    //console.log('📸 Capture de l\'écran de profil...');
    const screenshotFilename = `send-${Date.now()}.png`;
    const screenshotPath = await takeScreenshot(device, screenshotFilename);
    await sleep(2000);
    const phoneExists = await isPhoneWhatsApp(screenshotPath);
    //console.log('phoneExists', phoneExists);

    // Envoyer ou non le message
    if (phoneExists) {
        // Envoyer le message
        await tap(device, UI_ELEMENTS.messageInput);
        await randomSleep(1000, 4000);
        // Traiter les retours à la ligne multiples
        const messageParts = selectedMessage
            .replace(/\n{2,}/g, '\n\n')  // Remplacer 3+ \n par seulement 2
            .split('\n')
            .map(part => part.trim());
            
        for (let i = 0; i < messageParts.length; i++) {
            // Diviser les longs messages en chunks de 100 caractères
            const messagePart = messageParts[i];
            const maxChunkSize = 100;
            
            for (let j = 0; j < messagePart.length; j += maxChunkSize) {
                const chunk = messagePart.substring(j, j + maxChunkSize);
                
                // Nettoyer et échapper le texte de manière plus robuste
                const cleanChunk = chunk
                    .replace(/[àáâãäå]/g, 'a')
                    .replace(/[èéêë]/g, 'e')
                    .replace(/[ìíîï]/g, 'i')
                    .replace(/[òóôõö]/g, 'o')
                    .replace(/[ùúûü]/g, 'u')
                    .replace(/[ç]/g, 'c')
                    .replace(/[ñ]/g, 'n')
                    .replace(/[æ]/g, 'ae')
                    .replace(/[œ]/g, 'oe')
                    .replace(/[À-ÿ]/g, ''); // Supprimer les autres caractères spéciaux
                
                // Échapper pour le shell de manière plus robuste
                const formattedChunk = cleanChunk
                    .replace(/\\/g, '\\\\')    // Échapper les backslashes
                    .replace(/"/g, '\\"')      // Échapper les guillemets
                    .replace(/'/g, "\\'")      // Échapper les apostrophes
                    .replace(/\(/g, '\\(')     // Échapper les parenthèses ouvrantes
                    .replace(/\)/g, '\\)')     // Échapper les parenthèses fermantes
                    .replace(/ /g, '\\ ');     // Échapper les espaces
                
                // Écrire le chunk du message
                if (formattedChunk.trim().length > 0) {
                    await executeCommand(device, `shell input text "${formattedChunk}"`);
                }
            }
            
            // Ajouter retour à la ligne sauf pour la dernière partie
            if (i < messageParts.length - 1) {
                await executeCommand(device, `shell input keyevent 66`); // ENTER
            }

            // Délai entre chaque partie du message
            await randomSleep(200, 500);
        }

        // Appuyer sur le bouton envoyer
        await randomSleep(2000, 4000);
        await tap(device, UI_ELEMENTS.sendButton);
        await randomSleep(1000, 4000);

        // Mettre à jour le statut du contact
        contactedState = 'contacted';
    }

    else {
        // Fermer la popup de numéro non-enregistré sur WhatsApp
        await tap(device, UI_ELEMENTS.preventNotWhatsApp);
        await randomSleep(1000, 4000);

        // Mettre à jour le statut du contact
        contactedState = 'not_registered';
    }

    return contactedState;
}

// Envoyer une image à un numéro WhatsApp
async function sendImage(device, phone) {

    // Nettoyer le numéro du contact
    const phoneNumber = await phoneWaCleaner(phone);

    // Ouvrir le numéro dans WhatsApp
    await executeCommand(device, `shell am start -a android.intent.action.VIEW -d "https://wa.me/${phoneNumber}"`);
    await sleep(3000);

    // Envoyer la dernière image du répertoire du Sender device à ce numéro
    await tap(device, UI_ELEMENTS.messageInput);
    await sleep(2000);
    await tap(device, UI_ELEMENTS.imageInput);
    await sleep(3000);
    await tap(device, UI_ELEMENTS.galleryMode);
    await sleep(2000);
    await tap(device, UI_ELEMENTS.firstImage);
    await sleep(4000);
    await tap(device, UI_ELEMENTS.sendButton);
    await sleep(5000);

}



// Export du service
module.exports = {
    sendMessage,
    sendImage,
    getSenderService: () => ({
        sendMessage,
        sendImage
    })
}