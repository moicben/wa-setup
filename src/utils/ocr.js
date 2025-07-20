/**
 * OCR Utility - Analyse simple de texte sur captures d'écran
 * Consolidé pour vérifier mots-clés d'acceptation/refus
 */

const Tesseract = require('tesseract.js'); // Assumé déjà installé ; sinon npm install tesseract.js
const fs = require('fs');

// Fonction principale d'extraction et analyse
async function analyzeScreenshot(filename, options = {}) {
  const { acceptKeywords = ['SMS', 'Verify by SMS', 'Continue', 'Receive code'], 
          rejectKeywords = ['can\'t receive SMS', 'invalid number', 'error', 'try again', 'blocked'] } = options;
  const lang = options.lang || 'eng';
  
  try {
    // Extraire le texte avec Tesseract
    const { data: { text } } = await Tesseract.recognize(filename, lang);
    const cleanedText = text.toLowerCase().replace(/\s+/g, ' ');
    
    console.log(`🔍 Texte extrait: ${cleanedText}`);
    
    // Vérifier les keywords
    const hasAccept = acceptKeywords.some(keyword => cleanedText.includes(keyword.toLowerCase()));
    const hasReject = rejectKeywords.some(keyword => cleanedText.includes(keyword.toLowerCase()));
    
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

// Export
module.exports = { analyzeScreenshot };