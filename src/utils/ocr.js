/**
 * OCR Service minimaliste pour WhatsApp
 */

class OCRService {
    constructor() {
        this.tesseract = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        try {
            this.tesseract = require('tesseract.js');
            this.initialized = true;
        } catch (e) {
            console.warn('OCR non disponible, mode fallback');
            this.initialized = true;
        }
    }

    async analyzeScreen(screenshotPath) {
        await this.initialize();
        
        if (!this.tesseract) {
            // Mode fallback simple
            return { smsAvailable: true, confidence: 0.5 };
        }

        try {
            const { data: { text } } = await this.tesseract.recognize(screenshotPath, 'eng');
            const textLower = text.toLowerCase();
            
            return {
                smsAvailable: textLower.includes('sms') || textLower.includes('code'),
                hasError: textLower.includes('error') || textLower.includes('fail'),
                text: text.substring(0, 200),
                confidence: 0.8
            };
        } catch (e) {
            return { smsAvailable: true, confidence: 0.3 };
        }
    }
}

const ocrService = new OCRService();

module.exports = { 
    getOCRService: () => ocrService,
    analyzeWhatsAppScreen: (path) => ocrService.analyzeScreen(path)
};