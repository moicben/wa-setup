/**
 * OCR Utility - Analyse simple de texte sur captures d'écran
 * Consolidé pour vérifier mots-clés d'acceptation/refus
 */

const Tesseract = require('tesseract.js'); // Assumé déjà installé ; sinon npm install tesseract.js
const fs = require('fs');

async function validateImage(imagePath) {
    try {
        const stats = fs.statSync(imagePath);
        if (stats.size < 1000) { // Image trop petite
            return false;
        }
        return true;
    } catch (error) {
        console.error('❌ Erreur validation image:', error.message);
        return false;
    }
}

// Fonction principale d'extraction et analyse
async function analyzeScreenshot(filename, options = {}) {
  const { acceptKeywords = ['SMS', 'Verify by SMS', 'Receive code'], 
          rejectKeywords = ['can\'t receive SMS', 'email', 'invalid number', 'error', 'continue', 'blocked', 'unavailable', 'unsupported', 'by phone'] } = options;
  const lang = options.lang || 'eng';
  
  try {
    // Vérifier si l'image est valide
    if (!await validateImage(filename)) {
      return { valid: false, text: '', reason: 'Image trop petite' };
    }
    
    // Extraire le texte avec Tesseract
    const { data: { text } } = await Tesseract.recognize(filename, lang);
    const cleanedText = text.toLowerCase().replace(/\s+/g, ' ');
    
    console.log(`🔍 Texte extrait: ${cleanedText}`);
    
    // Vérifier les keywords
    const hasAccept = acceptKeywords.some(keyword => cleanedText.includes(keyword.toLowerCase()));
    const hasReject = rejectKeywords.some(keyword => {
      if (cleanedText.includes(keyword.toLowerCase())) {
        console.log(`❌ Mot-clé de rejet trouvé: "${keyword}"`);
        return true;
      }
      return false;
    });
    
    if (hasAccept && !hasReject) {
      return { valid: true, text: cleanedText, reason: 'Numéro accepté (SMS disponible)' };
    } else if (hasReject) {
      return { valid: false, text: cleanedText, reason: 'Numéro refusé (erreur détectée)' };
    } else {
      return { valid: false, text: cleanedText, reason: 'Aucun mot-clé d\'acceptation détecté' };
    }
  } catch (error) {
    console.error('❌ Erreur OCR:', error.message);
    return { valid: false, text: '', reason: 'Erreur lors de l\'analyse OCR' };
  } finally {
    // Nettoyer le fichier temp
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
}

/**
 * Extraire le numéro de téléphone depuis l'écran de profil WhatsApp
 * @param {string} filename - Le fichier de capture d'écran
 * @returns {Promise<{success: boolean, phoneNumber?: string, error?: string}>}
 */
async function extractPhoneNumberFromProfile(filename) {
  try {
    // Extraire le texte avec Tesseract
    const { data: { text } } = await Tesseract.recognize(filename, 'eng');
    
    console.log('📄 Texte OCR brut:', text);
    
    // Patterns pour détecter les numéros de téléphone
    // Format international : +XX XXX XXX XXXX ou +XX XXXXXXXXX
    const phonePatterns = [
      /\+\d{1,3}\s?\d{3,4}\s?\d{3,4}\s?\d{3,4}/g,  // +33 6XX XXX XXX
      /\+\d{1,3}\s?\d{9,12}/g,                       // +33612345678
      /\+\d{1,3}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}/g, // Formats variés
      /\+\d{10,15}/g,                                 // Format compact
      /\+44\s?\d{3}\s?\d{3}\s?\d{3}/g,               // Format UK +44 1234 456789
    ];
    
    let phoneNumber = null;
    
    // Essayer chaque pattern
    for (const pattern of phonePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        // Prendre le premier match et nettoyer
        phoneNumber = matches[0]
          .replace(/[\s\-\(\)]/g, '')  // Enlever espaces et caractères spéciaux
          .replace(/[^\d+]/g, '');      // Garder uniquement les chiffres et le +
        
        // Vérifier que le numéro a une longueur valide (10-15 chiffres après le +)
        if (phoneNumber.length >= 11 && phoneNumber.length <= 16) {
          //console.log(`✅ Numéro de téléphone trouvé: ${phoneNumber}`);
          break;
        }
      }
    }
    
    if (!phoneNumber) {
      // Recherche alternative : chercher spécifiquement après des mots-clés
      const lowerText = text.toLowerCase();
      const keywords = ['phone', 'number', 'numéro', 'mobile'];
      
      for (const keyword of keywords) {
        const keywordIndex = lowerText.indexOf(keyword);
        if (keywordIndex !== -1) {
          // Chercher un numéro après le mot-clé
          const textAfterKeyword = text.substring(keywordIndex);
          for (const pattern of phonePatterns) {
            const matches = textAfterKeyword.match(pattern);
            if (matches && matches.length > 0) {
              phoneNumber = matches[0].replace(/[\s\-\(\)]/g, '').replace(/[^\d+]/g, '');
              if (phoneNumber.length >= 11 && phoneNumber.length <= 16) {
                console.log(`✅ Numéro trouvé après '${keyword}': ${phoneNumber}`);
                break;
              }
            }
          }
          if (phoneNumber) break;
        }
      }
    }
    
    if (phoneNumber) {
      return {
        success: true,
        phoneNumber: phoneNumber
      };
    } else {
      return {
        success: false,
        error: 'Aucun numéro de téléphone trouvé dans la capture'
      };
    }
    
  } catch (error) {
    console.error('❌ Erreur extraction numéro:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Nettoyer le fichier temporaire
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
  }
}


// Vérifier si le numéro est enregistré avec rapide scan OCR du conteun de l'écran
async function isPhoneWhatsApp(filename) {
  // Vérifier si l'image est valide
  if (!await validateImage(filename)) {
    return false;
  }

  // Extraire le texte avec Tesseract
  const { data: { text } } = await Tesseract.recognize(filename, 'eng');
  //console.log(`🔍 Texte OCR brut: ${text}`);

  // Vérifier si le texte contient le mot "WhatsApp" ou "Message" ou "New"
  return !text.includes('The phone number') && !text.includes("isn't on") && !text.includes("Le numéro de téléphone") && !text.includes("n'est pas") ; 
}

// Export
module.exports = { analyzeScreenshot,
  extractPhoneNumberFromProfile,
  isPhoneWhatsApp };