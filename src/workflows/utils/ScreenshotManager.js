/**
 * ScreenshotManager - Gestionnaire de captures d'écran pour workflows
 * Extrait et amélioré de workflow.js
 */

const path = require('path');
const fs = require('fs');

class ScreenshotManager {
    constructor(baseDir = '../screenshots') {
        this.baseDir = path.join(__dirname, baseDir);
        this.ensureScreenshotDirectory();
    }

    /**
     * Créer le dossier screenshots s'il n'existe pas
     */
    ensureScreenshotDirectory() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    /**
     * Générer un nom de fichier de screenshot avec convention
     * @param {string} stepName - Nom de l'étape
     * @param {string} phase - Phase du screenshot (before/after/error)
     * @param {number} attempt - Numéro de tentative (optionnel)
     * @returns {string} Nom du fichier
     */
    generateScreenshotName(stepName, phase = 'main', attempt = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const attemptSuffix = attempt ? `_attempt_${attempt}` : '';
        const stepSlug = stepName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        return `${stepSlug}_${phase}${attemptSuffix}_${timestamp}.png`;
    }

    /**
     * Générer un nom de screenshot pour une étape de workflow
     * @param {string} stepName - Nom de l'étape
     * @param {string} phase - Phase (before/after/error)
     * @param {object} context - Contexte du workflow
     * @returns {string} Nom du fichier
     */
    generateStepScreenshot(stepName, phase, context = null) {
        const attempt = context?.session?.attempt || null;
        const stepNumber = context?.currentStepNumber || '';
        
        const prefix = stepNumber ? `${stepNumber.toString().padStart(2, '0')}_` : '';
        const stepSlug = stepName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const attemptSuffix = attempt ? `_attempt_${attempt}` : '';
        
        return `${prefix}${stepSlug}_${phase}${attemptSuffix}.png`;
    }

    /**
     * Générer des noms de screenshots conventionnels (compatibilité workflow.js)
     * @param {string} baseName - Nom de base
     * @param {number} attempt - Numéro de tentative
     * @returns {string} Nom du fichier
     */
    generateLegacyScreenshotName(baseName, attempt = null) {
        const attemptSuffix = attempt ? `_attempt_${attempt}` : '';
        return `${baseName}${attemptSuffix}.png`;
    }

    /**
     * Obtenir le chemin complet d'un screenshot
     * @param {string} filename - Nom du fichier
     * @returns {string} Chemin complet
     */
    getScreenshotPath(filename) {
        return path.join(this.baseDir, filename);
    }

    /**
     * Vérifier si un screenshot existe
     * @param {string} filename - Nom du fichier
     * @returns {boolean} True si le fichier existe
     */
    screenshotExists(filename) {
        return fs.existsSync(this.getScreenshotPath(filename));
    }

    /**
     * Nettoyer les anciens screenshots
     * @param {number} maxAge - Âge maximum en millisecondes
     */
    cleanupOldScreenshots(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const files = fs.readdirSync(this.baseDir);
            const now = Date.now();
            
            files.forEach(file => {
                const filePath = path.join(this.baseDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage screenshots:', error.message);
        }
    }

    /**
     * Obtenir la liste des screenshots d'une session
     * @param {string} sessionId - ID de session
     * @returns {Array} Liste des screenshots
     */
    getSessionScreenshots(sessionId) {
        try {
            const files = fs.readdirSync(this.baseDir);
            return files.filter(file => file.includes(sessionId));
        } catch (error) {
            console.warn('⚠️ Erreur lecture screenshots:', error.message);
            return [];
        }
    }
}

// Instance singleton pour compatibilité
let screenshotManager = null;

/**
 * Obtenir l'instance singleton du ScreenshotManager
 * @returns {ScreenshotManager} Instance du gestionnaire
 */
function getScreenshotManager() {
    if (!screenshotManager) {
        screenshotManager = new ScreenshotManager();
    }
    return screenshotManager;
}

module.exports = {
    ScreenshotManager,
    getScreenshotManager
};