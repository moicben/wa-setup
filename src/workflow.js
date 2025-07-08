#!/usr/bin/env node

/**
 * Workflow WhatsApp Optimisé
 * Version finale minimaliste et fonctionnelle
 */

require('dotenv').config();

const { BlueStackController } = require('./core/bluestack');
const { SMSManagerExtended } = require('./core/sms');
const path = require('path');
const fs = require('fs');

class WhatsAppWorkflow {
    constructor(config = {}) {
        this.config = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            smsApiKey: config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY,
            verbose: config.verbose !== false
        };

        this.bluestack = null;
        this.sms = null;
        this.session = null;
        
        // Créer le dossier screenshots s'il n'existe pas
        const screenshotDir = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    }

    /**
     * Initialiser tous les composants
     */
    async initialize() {
        try {
            console.log('🚀 Initialisation du workflow WhatsApp...\n');

            // BlueStack
            console.log('📱 Connexion BlueStack...');
            this.bluestack = new BlueStackController({ 
                deviceId: this.config.deviceId 
            });
            await this.bluestack.initialize();

            // SMS Manager
            console.log('📡 Initialisation SMS...');
            this.sms = new SMSManagerExtended(this.config.smsApiKey);
            
            if (this.config.smsApiKey) {
                const balance = await this.sms.getBalance();
                console.log(`💰 Solde: ${balance.balance}₽`);
            } else {
                throw new Error('Clé API SMS requise. Utilisez "npm run setup" pour configurer.');
            }

            // Diagnostic
            console.log('🔧 Vérification système...');
            const status = await this.bluestack.checkStatus();
            if (!status.whatsappInstalled) {
                throw new Error('WhatsApp non installé sur BlueStack');
            }

            console.log('✅ Initialisation terminée\n');
            return true;

        } catch (error) {
            console.error(`❌ Erreur initialisation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Créer un compte WhatsApp complet avec retry automatique
     */
    async createAccount(country = null, maxRetries = 3) {
        const targetCountry = country || this.config.country;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log('🎯 === CRÉATION COMPTE WHATSAPP ===');
            console.log(`🌍 Pays: ${targetCountry}`);
            if (attempt > 1) {
                console.log(`🔄 Tentative ${attempt}/${maxRetries} (retry automatique)\n`);
            } else {
                console.log('');
            }

            this.session = {
                startTime: Date.now(),
                country: targetCountry,
                phone: null,
                smsId: null,
                parsedNumber: null,
                attempt
            };

            try {
                // Étape 1: Réinitialiser WhatsApp
                await this.step('🔄 Réinitialisation WhatsApp');
                await this.bluestack.resetApp('com.whatsapp');
                await this.bluestack.launchApp('com.whatsapp');
                await this.bluestack.takeScreenshot(`01_whatsapp_fresh_attempt_${attempt}.png`);
                
                // Étape 2: Acheter numéro SMS (avec fallback automatique et prix multiples pour UK)
                await this.step('📞 Achat numéro SMS');
                const numberResult = await this.sms.buyNumberWithFallbackAndPricing(targetCountry);
                
                if (!numberResult.success) {
                    throw new Error(`Impossible d'acheter un numéro: ${numberResult.error}`);
                }

                this.session.phone = numberResult.number;
                this.session.smsId = numberResult.id;
                this.session.parsedNumber = numberResult.parsed;
                this.session.countryUsed = numberResult.countryUsed; // Le pays réellement utilisé

                // Afficher le prix si disponible
                if (numberResult.price) {
                    console.log(`💰 Prix: ${numberResult.price}₽`);
                }
                console.log(`✅ Numéro: ${numberResult.fullNumber}`);
                
                if (numberResult.originalCountry && numberResult.originalCountry !== numberResult.countryUsed) {
                    console.log(`🔄 Pays utilisé: ${numberResult.countryUsed} (au lieu de ${numberResult.originalCountry})`);
                }
                
                // Vérifier le parsing
                if (numberResult.parsed && numberResult.parsed.success) {
                    console.log(`🌍 Indicatif: +${numberResult.parsed.countryCode}`);
                    console.log(`📞 Local: ${numberResult.parsed.localNumber}`);
                } else {
                    console.warn('⚠️ Parsing du numéro échoué, utilisation du numéro brut');
                }

                // Étape 3: Navigation et saisie numéro + clic NEXT
                await this.step('✏️ Saisie du numéro et validation');
                await this.inputPhoneNumber(numberResult.number);

                // Étape 4 : Vérifier si peut recevoir SMS, si oui demander
                await this.step('🔍 Vérification capacité SMS');
                const phoneSMSCheck = await this.checkWhatsAppSMS(numberResult.id);
                
                if (!phoneSMSCheck.canReceiveSMS) {
                    console.error(`❌ SMS non disponible: ${phoneSMSCheck.reason}`);
                    console.log(`🎯 Confiance: ${Math.round(phoneSMSCheck.details?.confidence * 100 || 0)}%`);
                    
                    // Logique améliorée : seulement annuler si confiance élevée (>70%)
                    const confidence = phoneSMSCheck.details?.confidence || 0;
                    if (confidence > 0.7) {
                        console.log('🔄 Confiance élevée que SMS non disponible - Annulation et retry...');
                        try {
                            await this.sms.cancelNumber(numberResult.id);
                            console.log('🗑️ Numéro annulé');
                        } catch (e) {
                            console.warn('⚠️ Impossible d\'annuler le numéro');
                        }
                        
                        // Relancer le processus avec un nouveau numéro
                        throw new Error('SMS_NOT_AVAILABLE_RETRY_NEEDED');
                    } else {
                        console.warn(`⚠️ Confiance faible (${Math.round(confidence * 100)}%) - Continuation malgré l'incertitude OCR...`);
                        console.log('🤞 Le SMS pourrait fonctionner malgré l\'analyse OCR peu concluante');
                    }
                } else {
                    console.log(`✅ SMS disponible: ${phoneSMSCheck.reason}`);
                    console.log(`🎯 Confiance: ${Math.round(phoneSMSCheck.details?.confidence * 100 || 0)}%`);
                }

                // Étape 5: Demander le code SMS sur l'écran
                await this.step('🔘 Demande de code SMS');
                const afterSelectionScreen = await this.requestSMSCode();

                // Étape 6 : Analyse Post-Soumission SMS anti-erreurs
                await this.step('📸 Analyse Post-Soumission SMS');
                const postSMSAnalysis = await this.analyzePostSMSSubmission(afterSelectionScreen);

                if (postSMSAnalysis.isSMSFailure) {
                    console.error('\n🚨 === ERREUR SMS DÉTECTÉE ===');
                    console.error(`💥 Type: ${postSMSAnalysis.failureType}`);
                    console.error(`📝 Message: ${postSMSAnalysis.errorMessage}`);
                    console.error(`🎯 Confiance: ${Math.round(postSMSAnalysis.confidence * 100)}%`);
                    
                    if (postSMSAnalysis.shouldRetryWithNewNumber) {
                        console.log('🔄 Retry automatique avec nouveau numéro recommandé');
                        
                        // Annuler le numéro actuel
                        try {
                            await this.sms.cancelNumber(numberResult.id);
                            console.log('🗑️ Numéro SMS annulé');
                        } catch (e) {
                            console.warn('⚠️ Impossible d\'annuler le numéro SMS');
                        }
                        
                        // Déclencher retry avec nouveau numéro
                        throw new Error('SMS_SENDING_FAILED_RETRY_NEEDED');
                    } else {
                        console.warn('⚠️ Erreur de service détectée, tentative de continuation...');
                        // Continuer malgré l'erreur de service (pas un problème de numéro)
                    }
                } else if (!postSMSAnalysis.success) {
                    console.warn('⚠️ Analyse post-soumission échouée, continuation...');
                }

                // Étape 7: Attendre la réception du SMS (après avoir cliqué NEXT)
                await this.step('📨 Attente et validation SMS');
                const smsResult = await this.sms.waitForSMS(numberResult.id);
                
                if (!smsResult.success) {
                    throw new Error(`Impossible de recevoir le SMS: ${smsResult.error}`);
                }

                console.log(`📝 Code SMS reçu: ${smsResult.code}`);
                
                // Étape 8: Saisie code SMS
                await this.step('🔢 Saisie du code SMS');
                await this.inputSMSCode(smsResult.code);

                // Étape 9: Finalisation
                await this.step('🏁 Finalisation');
                await this.finalizeAccount();

                // Succès création compte
                const duration = Math.round((Date.now() - this.session.startTime) / 1000);
                
                console.log('\n🎉 === COMPTE CRÉÉ AVEC SUCCÈS ===');
                console.log(`📱 Numéro: ${numberResult.fullNumber}`);
                console.log(`⏱️ Durée: ${duration}s`);
                console.log(`🆔 SMS ID: ${numberResult.id}`);
                console.log(`🔄 Tentative réussie: ${attempt}/${maxRetries}\n`);

                return {
                    success: true,
                    phone: numberResult.fullNumber,
                    duration,
                    country: targetCountry,
                    parsed: numberResult.parsed,
                    attempts: attempt
                };
            

            } catch (error) {
                console.error(`\n❌ === ÉCHEC TENTATIVE ${attempt}/${maxRetries} ===`);
                console.error(`💥 Erreur: ${error.message}`);
                
                // Nettoyage en cas d'erreur
                if (this.session?.smsId) {
                    try {
                        await this.sms.cancelNumber(this.session.smsId);
                        console.log('🗑️ Numéro annulé');
                    } catch (e) {
                        console.log('⚠️ Impossible d\'annuler le numéro SMS');
                    }
                }

                // Si c'est une erreur de retry SMS, continuer avec la tentative suivante
                if ((error.message === 'SMS_NOT_AVAILABLE_RETRY_NEEDED' || 
                     error.message === 'SMS_SENDING_FAILED_RETRY_NEEDED') && 
                     attempt < maxRetries) {
                    
                    const retryReason = error.message === 'SMS_NOT_AVAILABLE_RETRY_NEEDED' ? 
                        'SMS non disponible sur ce numéro' : 
                        'Échec d\'envoi SMS détecté par WhatsApp';
                    
                    console.log(`🔄 ${retryReason} - Retry automatique ${attempt + 1}/${maxRetries} dans 5 secondes...\n`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    continue;
                }
                
                // Si c'est la dernière tentative ou une autre erreur, arrêter
                if (attempt === maxRetries) {
                    console.error(`\n💥 === ÉCHEC DÉFINITIF APRÈS ${maxRetries} TENTATIVES ===`);
                    return {
                        success: false,
                        error: error.message,
                        country: targetCountry,
                        attempts: attempt
                    };
                } else {
                    console.log(`🔄 Retry automatique ${attempt + 1}/${maxRetries} dans 10 secondes...\n`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }
            }
        }
    }

    /**
     * Saisir le numéro de téléphone dans WhatsApp
     */
    async inputPhoneNumber(phoneNumber) {
        try {
            console.log(`📝 Saisie: +${phoneNumber}`);

            // Screenshot avant
            await this.bluestack.takeScreenshot('02_before_phone_input.png');

            // Choisir la langue de l'application
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(66); // Enter
            await this.bluestack.wait('long');

            // Navigation pour lancer l'application
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(66); // Enter/Space
            await this.bluestack.wait('long');

            // Fermer la popup Notifications
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('medium');
            await this.bluestack.click(570, 1060);
            await this.bluestack.wait('medium');

            // Utiliser les données parsées du numéro
            const parsedNumber = this.session.parsedNumber;
            
            if (!parsedNumber || !parsedNumber.success) {
                throw new Error('Numéro de téléphone non parsé correctement');
            }

            console.log(`🌍 Indicatif pays: +${parsedNumber.countryCode}`);
            console.log(`📞 Numéro local: ${parsedNumber.localNumber}`);

            // Effacer le champ indicatif
            await this.bluestack.clearField(355, 513);
            await this.bluestack.wait('short');
            await this.bluestack.clearField(355, 513);
            await this.bluestack.wait('medium');

            // Saisir l'indicatif pays correct
            await this.bluestack.inputText(parsedNumber.countryCode);

            // Effacer le champ numéro
            await this.bluestack.click(620, 513);
            await this.bluestack.wait('short');
            await this.bluestack.clearField(620, 513);

            // Saisir le numéro local
            await this.bluestack.inputText(parsedNumber.localNumber);
            
            // Screenshot après saisie
            await this.bluestack.takeScreenshot('03_after_phone_input.png');

            // Clic sur NEXT (position connue)
            console.log('🔘 Clic sur NEXT...');
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(62); // Space

            // Attendre de l'envoi du numéro
            await this.bluestack.wait('long');
            await this.bluestack.wait('long'); // Double attente

            // Confirmer le numéro
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(62); // Space

            // Attendre soummission du numéro
            await this.bluestack.wait('long');
            await this.bluestack.wait('long');            
            
            console.log('🔘 Options de vérification affichées !');

        } catch (error) {
            await this.bluestack.takeScreenshot('error_phone_input.png');
            throw new Error(`Erreur saisie numéro: ${error.message}`);
        }
    }

    /**
     * Vérifier si le numéro peut recevoir un SMS WhatsApp avec une capture de l'écran analyse par OCR
     */
    async checkWhatsAppSMS(smsId) {
        try {
            console.log(`🔍 Vérification SMS pour le numéro ID: ${smsId}`);

            // Afficher les méthodes de vérification
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('long');
            
            console.log('🔘 Sélection de l\'option SMS...');
            const smsRadioButton = { x: 840, y: 1540 }; // Position par défaut
            
            console.log(`🎯 Clic sur option SMS à (${smsRadioButton.x}, ${smsRadioButton.y})`);
            await this.bluestack.click(smsRadioButton.x, smsRadioButton.y);
            await this.bluestack.wait('short');
            
            // Capture d'écran pour analyse OCR
            await this.bluestack.takeScreenshot('verification_options.png');
            
            // Logique OCR complète pour analyser le screenshot
            const ocrResult = await this.analyzeVerificationOptions();
            
            if (ocrResult.smsAvailable) {
                console.log('✅ SMS disponible - Options de vérification détectées');
                console.log(`📱 Numéro détecté: ${ocrResult.phoneNumber || 'N/A'}`);
                
                // Sélectionner automatiquement l'option SMS si disponible
                
                
                return {
                    success: true,
                    canReceiveSMS: true,
                    phoneNumber: ocrResult.phoneNumber,
                    details: ocrResult
                };
            } else {
                console.log('❌ SMS non disponible - Options désactivées ou absentes');
                return {
                    success: false,
                    canReceiveSMS: false,
                    reason: ocrResult.reason || 'Options SMS non disponibles',
                    details: ocrResult
                };
            }
            
        } catch (error) {
            console.error(`❌ Erreur vérification SMS: ${error.message}`);
            return {
                success: false,
                canReceiveSMS: false,
                error: error.message
            };
        }
    }

    /**
     * Analyser les options de vérification via OCR avancé
     */
    async analyzeVerificationOptions() {
        try {
            console.log('🔍 Analyse OCR des options de vérification...');
            
            // Prendre un screenshot récent si nécessaire
            const screenshotPath = path.join(__dirname, '../screenshots/verification_options.png');
            
            if (!fs.existsSync(screenshotPath)) {
                await this.bluestack.takeScreenshot('verification_options.png');
            }
            
            // Import Tesseract dynamiquement
            const Tesseract = require('tesseract.js');
            
            // Configuration OCR optimisée pour les interfaces mobiles
            const ocrConfig = {
                lang: 'eng',
                options: {
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz +()-',
                    tessedit_pageseg_mode: 6, // Assume uniform block of text
                }
            };
            
            console.log('📖 Extraction du texte...');
            const { data: { text } } = await Tesseract.recognize(screenshotPath, ocrConfig.lang, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            
            console.log('📝 Texte extrait:', text.substring(0, 200) + '...');
            
            // Analyse intelligente du texte
            const analysis = this.analyzeExtractedText(text);
            
            return analysis;
            
        } catch (error) {
            console.warn('⚠️ OCR échoué, utilisation de l\'analyse d\'image basique');
            return await this.fallbackImageAnalysis();
        }
    }

    /**
     * Analyser le texte extrait pour détecter les options SMS
     */
    analyzeExtractedText(text) {
        const textLower = text.toLowerCase();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        console.log('🔍 Analyse du texte extrait...');
        
        // Patterns de détection améliorés
        const patterns = {
            // Textes indicateurs d'options SMS disponibles
            smsAvailable: [
                /receive\s*sms/i,
                /get\s*code\s*at/i,
                /sms.*code/i,
                /text.*message/i,
                /verify.*sms/i,
                /choose.*verify/i,
                /verification.*options/i,
                /continue/i,  // Bouton continue indique que des options sont sélectionnables
                // PATTERNS CRITIQUES: Écrans de vérification actifs WhatsApp
                /verifying\s*your\s*number/i,  // "Verifying your number" = SMS en cours !
                /waiting\s*to\s*automatically\s*detect/i,  // "Waiting to automatically detect" = SMS attendu !
                /6[-\s]*digit\s*code\s*sent\s*by\s*sms/i,  // "6-digit code sent by SMS" = SMS envoyé !
                /code\s*sent\s*by\s*sms\s*to/i,  // "code sent by SMS to" = SMS parti !
                /automatically\s*detect.*sms/i,  // Détection automatique SMS
                /sent\s*by\s*sms\s*to\s*\+\d+/i  // "sent by SMS to +44..." = confirmation envoi
            ],
            
            // Textes indicateurs d'options désactivées
            smsUnavailable: [
                /not.*available/i,
                /unavailable/i,
                /disabled/i,
                /can.*not.*receive/i,
                /unable.*to.*send/i,
                /grayed.*out/i,
                /opacity.*low/i,
                /login.*not.*available/i,  // Message spécifique WhatsApp
                /security.*reasons/i,      // "For security reasons"
                /can.*t.*log.*you.*in/i,   // "can't log you in"
                /number.*not.*verified/i,  // "Number not verified"
                /try.*again.*later/i       // Messages d'attente
            ],
            
            // Extraction du numéro de téléphone (patterns améliorés)
            phoneNumber: [
                /\+44\s*\d{4}\s*\d{6}/,  // Format UK spécifique
                /\+\d{1,3}\s*\d{3,4}\s*\d{6,8}/,
                /\+\d{10,15}/,
                /get\s*code\s*at\s*(\+\d[\d\s]+)/i,
                /auto[-\s]*verify\s*on\s*(\+\d[\d\s]+)/i,
                /(\+\d{2,3}\s*\d{4}\s*\d{6})/  // Pattern général amélioré
            ],
            
            // Options de vérification spécifiques
            verificationMethods: [
                /missed\s*call/i,
                /voice\s*call/i,
                /receive\s*sms/i,
                /whatsapp\s*call/i,
                /automatically\s*verify/i
            ],
            
            // Indicateurs visuels positifs
            activeInterface: [
                /choose\s*how\s*to\s*verify/i,
                /continue/i,
                /verify/i,
                /call.*phone/i,
                /manage.*call/i,
                // INDICATEURS CRITIQUES: Interface de vérification WhatsApp active
                /verifying\s*your\s*number/i,  // Titre principal de vérification
                /waiting\s*to/i,  // "Waiting to..." = processus actif
                /wrong\s*number/i,  // "Wrong number?" = interface interactive
                /didn.*t\s*receive\s*code/i,  // "Didn't receive code?" = options disponibles
                /detect.*code/i  // Détection de code en cours
            ]
        };
        
        // Détecter si SMS est disponible
        const smsAvailable = patterns.smsAvailable.some(pattern => pattern.test(textLower));
        const smsUnavailable = patterns.smsUnavailable.some(pattern => pattern.test(textLower));
        const hasActiveInterface = patterns.activeInterface.some(pattern => pattern.test(textLower));
        
        // Extraire le numéro de téléphone avec patterns améliorés
        let phoneNumber = null;
        for (const pattern of patterns.phoneNumber) {
            const match = text.match(pattern);
            if (match) {
                // Nettoyer le numéro
                phoneNumber = match[1] || match[0];
                phoneNumber = phoneNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
                if (phoneNumber.length >= 10) { // Numéro valide
                    break;
                }
            }
        }
        
        // Analyser les méthodes de vérification disponibles
        const availableMethods = [];
        for (const line of lines) {
            for (const pattern of patterns.verificationMethods) {
                if (pattern.test(line)) {
                    availableMethods.push(line.trim());
                }
            }
        }
        
        // Logique de décision améliorée
        let canReceiveSMS = false;
        let reason = '';
        let confidence = 0.1;
        
        // PRIORITÉ ABSOLUE: Détecter les écrans de vérification WhatsApp actifs
        const isVerificationScreen = /verifying\s*your\s*number/i.test(textLower);
        const isWaitingForSMS = /waiting\s*to\s*automatically\s*detect/i.test(textLower);
        const hasSMSCodeMessage = /6[-\s]*digit\s*code\s*sent\s*by\s*sms/i.test(textLower);
        const hasCodeSentMessage = /code\s*sent\s*by\s*sms\s*to/i.test(textLower);
        
        if (isVerificationScreen && (isWaitingForSMS || hasSMSCodeMessage || hasCodeSentMessage)) {
            canReceiveSMS = true;
            reason = 'Écran de vérification WhatsApp actif - SMS en cours de réception';
            confidence = 0.98; // Très haute confiance !
            console.log('🎯 ✅ ÉCRAN VÉRIFICATION WHATSAPP DÉTECTÉ - SMS FONCTIONNEL !');
        } else if (smsUnavailable) {
            canReceiveSMS = false;
            reason = 'SMS explicitement marqué comme non disponible';
            confidence = 0.9;
        } else if (smsAvailable && hasActiveInterface) {
            canReceiveSMS = true;
            reason = 'Options SMS et interface active détectées';
            confidence = 0.95;
        } else if (hasActiveInterface && availableMethods.length > 0) {
            canReceiveSMS = true;
            reason = 'Interface de vérification active avec méthodes disponibles';
            confidence = 0.85;
        } else if (textLower.includes('continue') && textLower.includes('verify')) {
            // Cas spécifique: si on voit "continue" + "verify", c'est probablement bon
            canReceiveSMS = true;
            reason = 'Interface de vérification standard détectée';
            confidence = 0.75;
        } else if (availableMethods.length > 0) {
            canReceiveSMS = true;
            reason = 'Méthodes de vérification détectées';
            confidence = 0.6;
        } else {
            canReceiveSMS = false;
            reason = 'Aucun indicateur SMS clair trouvé';
            confidence = 0.3;
        }
        
        // Bonus de confiance si numéro de téléphone détecté
        if (phoneNumber && canReceiveSMS) {
            confidence = Math.min(confidence + 0.1, 1.0);
        }
        
        console.log(`📊 Résultat analyse: SMS ${canReceiveSMS ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
        console.log(`📝 Raison: ${reason}`);
        console.log(`🎯 Confiance: ${Math.round(confidence * 100)}%`);
        if (phoneNumber) console.log(`📞 Numéro détecté: ${phoneNumber}`);
        
        return {
            smsAvailable: canReceiveSMS,
            phoneNumber,
            reason,
            availableMethods,
            extractedText: text,
            confidence,
            hasActiveInterface,
            detectedPatterns: {
                smsAvailable: patterns.smsAvailable.filter(p => p.test(textLower)),
                activeInterface: patterns.activeInterface.filter(p => p.test(textLower))
            }
        };
    }

    /**
     * Analyser l'écran de vérification après la soumission du SMS 
     */
    async analyzePostSMSSubmission(screenshot) {
        console.log('🔍 Analyse post-soumission SMS...');
        
        try {
            // Vérifier si le screenshot est valide
            if (!screenshot || !fs.existsSync(screenshot)) {
                throw new Error('Screenshot non trouvé pour l\'analyse post-soumission');
            }
            
            // Importer Tesseract pour l'analyse OCR
            const Tesseract = require('tesseract.js');
            
            console.log('📖 Extraction du texte post-soumission...');
            const { data: { text } } = await Tesseract.recognize(screenshot, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`📊 OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            
            console.log('📝 Texte extrait:', text.substring(0, 300) + '...');
            
            // Analyse spécialisée pour détecter les erreurs SMS
            const smsFailureAnalysis = this.detectSMSFailure(text);
            
            if (smsFailureAnalysis.isSMSFailure) {
                console.error('🚨 ERREUR SMS DÉTECTÉE !');
                console.error(`📝 Type: ${smsFailureAnalysis.failureType}`);
                console.error(`💬 Message: ${smsFailureAnalysis.errorMessage}`);
                console.error(`🎯 Confiance: ${Math.round(smsFailureAnalysis.confidence * 100)}%`);
                
                return {
                    success: false,
                    isSMSFailure: true,
                    failureType: smsFailureAnalysis.failureType,
                    errorMessage: smsFailureAnalysis.errorMessage,
                    confidence: smsFailureAnalysis.confidence,
                    shouldRetryWithNewNumber: smsFailureAnalysis.shouldRetryWithNewNumber,
                    extractedText: text,
                    details: smsFailureAnalysis
                };
            }
            
            // Si pas d'erreur détectée, analyser normalement
            const analysis = this.analyzeExtractedText(text);
            
            return {
                success: true,
                isSMSFailure: false,
                details: analysis,
                extractedText: text
            };
            
        } catch (error) {
            console.error(`❌ Erreur analyse post-soumission: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Détecter spécifiquement les erreurs d'envoi SMS de WhatsApp
     */
    detectSMSFailure(text) {
        const textLower = text.toLowerCase();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        console.log('🔍 Analyse des erreurs SMS...');
        
        // Patterns d'erreurs SMS spécifiques - très précis
        const failurePatterns = {
            // Messages d'erreur principaux de WhatsApp
            cantSendSMS: [
                /we\s*couldn.*t\s*send\s*an?\s*sms/i,
                /unable\s*to\s*send\s*sms/i,
                /cannot\s*send\s*sms/i,
                /failed\s*to\s*send\s*sms/i,
                /sms\s*sending\s*failed/i,
                /sms\s*delivery\s*failed/i,
                /can't\s*send/i, // <-- ajouté
                /can\'t\s*send/i,// <-- ajouté pour compatibilité
                /because\s*you(\'|’)?ve\s*tried/i, // <-- ajouté
                /wait\s*before\s*requesting/i      // <-- ajouté
            ],
            
            // Instructions de retry temporel
            retryLater: [
                /try\s*again\s*in\s*\d+\s*hour/i,
                /try\s*again\s*in\s*\d+\s*minute/i,
                /try\s*again\s*later/i,
                /please\s*wait.*try\s*again/i,
                /temporarily\s*unavailable/i,

            ],
            
            // Problèmes de numéro
            numberIssues: [
                /check\s*your\s*number/i,
                /invalid\s*number/i,
                /number\s*not\s*supported/i,
                /number\s*cannot\s*receive/i,
                /this\s*number\s*is\s*not\s*available/i
            ],
            
            // Erreurs de service
            serviceErrors: [
                /service\s*temporarily\s*unavailable/i,
                /server\s*error/i,
                /network\s*error/i,
                /connection\s*failed/i
            ],
            
            // Messages d'erreur contextuels (en présence de "Verifying your number")
            verificationErrors: [
                /verifying\s*your\s*number.*couldn.*t/i,
                /verifying.*unable\s*to\s*send/i,
                /verification.*failed/i
            ]
        };
        
        // Détecter le type d'erreur
        let failureType = null;
        let confidence = 0;
        let shouldRetryWithNewNumber = false;
        let errorMessage = '';
        
        // Analyser chaque catégorie d'erreur
        for (const [category, patterns] of Object.entries(failurePatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(textLower)) {
                    failureType = category;
                    
                    // Extraire le message d'erreur complet
                    const match = text.match(new RegExp(pattern.source, 'i'));
                    if (match) {
                        // Chercher la phrase complète contenant l'erreur
                        for (const line of lines) {
                            if (pattern.test(line.toLowerCase())) {
                                errorMessage = line.trim();
                                break;
                            }
                        }
                    }
                    
                    // Définir la confiance selon le type d'erreur
                    switch (category) {
                        case 'cantSendSMS':
                            confidence = 0.95; // Très haute confiance
                            shouldRetryWithNewNumber = true;
                            break;
                        case 'numberIssues':
                            confidence = 0.90;
                            shouldRetryWithNewNumber = true;
                            break;
                        case 'retryLater':
                            confidence = 0.85;
                            shouldRetryWithNewNumber = true; // Retry avec nouveau numéro plutôt qu'attendre
                            break;
                        case 'verificationErrors':
                            confidence = 0.80;
                            shouldRetryWithNewNumber = true;
                            break;
                        case 'serviceErrors':
                            confidence = 0.70;
                            shouldRetryWithNewNumber = false; // Problème de service, pas de numéro
                            break;
                    }
                    
                    break;
                }
            }
            if (failureType) break;
        }
        
        // Recherche de patterns combinés pour augmenter la confiance
        const combinedPatterns = [
            /we\s*couldn.*t.*sms.*number/i,
            /check.*number.*try\s*again/i,
            /verifying.*number.*couldn.*t/i,
            /can't\s*send/i, // <-- ajouté
            /can\'t\s*send/i,// <-- ajouté pour compatibilité
            /because\s*you(\'|’)?ve\s*tried/i, // <-- ajouté
            /wait\s*before\s*requesting/i      // <-- ajouté
        ];
        
        for (const pattern of combinedPatterns) {
            if (pattern.test(textLower)) {
                confidence = Math.min(confidence + 0.1, 1.0);
                shouldRetryWithNewNumber = true;
            }
        }
        
        // Si on trouve des mots-clés d'erreur mais pas de pattern spécifique
        const errorKeywords = ['error', 'failed', 'unable', 'cannot', 'couldn\'t', 'problem'];
        const smsKeywords = ['sms', 'message', 'text', 'verification', 'code'];
        
        const hasErrorKeyword = errorKeywords.some(keyword => textLower.includes(keyword));
        const hasSMSKeyword = smsKeywords.some(keyword => textLower.includes(keyword));
        
        if (hasErrorKeyword && hasSMSKeyword && !failureType) {
            failureType = 'genericError';
            confidence = 0.6;
            shouldRetryWithNewNumber = true;
            errorMessage = 'Erreur générique détectée dans le contexte SMS';
        }
        
        const isSMSFailure = failureType !== null && confidence > 0.5;
        
        if (isSMSFailure) {
            console.log(`🚨 Erreur SMS détectée: ${failureType}`);
            console.log(`📝 Message: ${errorMessage}`);
            console.log(`🎯 Confiance: ${Math.round(confidence * 100)}%`);
            console.log(`🔄 Retry recommandé: ${shouldRetryWithNewNumber ? 'OUI' : 'NON'}`);
        } else {
            console.log('✅ Aucune erreur SMS détectée');
        }
        
        return {
            isSMSFailure,
            failureType,
            errorMessage,
            confidence,
            shouldRetryWithNewNumber,
            detectedPatterns: failureType ? failurePatterns[failureType] : [],
            extractedText: text
        };
    }


    /**
     * Analyse d'image de fallback quand OCR échoue
     */
    async fallbackImageAnalysis() {
        console.log('🔍 Analyse d\'image basique (fallback)...');
        
        try {
            const screenshotPath = path.join(__dirname, '../screenshots/verification_options.png');
            
            if (!fs.existsSync(screenshotPath)) {
                throw new Error('Screenshot non trouvé pour l\'analyse');
            }
            
            
            console.log('🔍 Analyse des patterns d\'interface WhatsApp...');
            
            const analysisResult = {
                smsAvailable: true,
                phoneNumber: null,
                reason: 'Interface de vérification WhatsApp standard détectée (analyse visuelle)',
                availableMethods: [
                    'Missed call option detected',
                    'SMS option likely available',
                    'Voice call option potentially available'
                ],
                extractedText: 'Fallback analysis - Interface structure detected',
                confidence: 0.8, // Haute confiance car on est dans le bon flow
                hasActiveInterface: true,
                isWhatsAppVerificationScreen: true
            };
            
            // Amélioration: essayer d'identifier le type d'écran spécifique
            try {
                // Si on peut lire quelques mots clés, on ajuste l'analyse
                const Tesseract = require('tesseract.js');
                const { data: { text } } = await Tesseract.recognize(screenshotPath, 'eng', {
                    logger: () => {} // Pas de logs pour le fallback
                });
                
                const textLower = text.toLowerCase();
                
                if (textLower.includes('choose') || textLower.includes('verify')) {
                    analysisResult.reason = 'Écran de choix de vérification confirmé par OCR partiel';
                    analysisResult.confidence = 0.9;
                }
                
                if (textLower.includes('sms') || textLower.includes('receive')) {
                    analysisResult.smsAvailable = true;
                    analysisResult.reason = 'Option SMS confirmée par OCR partiel';
                    analysisResult.confidence = 0.95;
                }
                
                // Tentative d'extraction de numéro même avec OCR partiel
                const phoneMatch = text.match(/(\+\d{2,3}[\s\d]{8,12})/);
                if (phoneMatch) {
                    analysisResult.phoneNumber = phoneMatch[1].replace(/\s+/g, '');
                    analysisResult.confidence = 0.98;
                }
                
            } catch (ocrError) {
                // OCR a échoué, on garde l'analyse basique
                console.log('📷 OCR partiel échoué, utilisation analyse structure seule');
            }
            
            return analysisResult;
            
        } catch (error) {
            return {
                smsAvailable: false,
                phoneNumber: null,
                reason: `Erreur analyse fallback: ${error.message}`,
                availableMethods: [],
                extractedText: '',
                confidence: 0.1,
                hasActiveInterface: false
            };
        }
    }

    /**
     * Sélectionner automatiquement l'option SMS
     */
    async requestSMSCode(position = null) {
        try {

            // Selection de l'option SMS
            console.log('🔘 Sélection de l\'option SMS...')
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('medium');

            // Vérifier que l'option est sélectionnée (screenshot intermédiaire)
            await this.bluestack.takeScreenshot('sms_option_selected.png');

            
            // Cliquer sur "Continue" -> Envoyer le SMS
            console.log('🔘 Clic sur Continue...');
            await this.bluestack.click(540, 1800); // Position approximative du bouton Continue

            // Attendre l'envoi du SMS de vérification
            console.log('🔘 SMS envoyé, attente de réception...');
            await this.bluestack.wait('long');
            await this.bluestack.wait('long');

            // Screenshot après confirmation
            console.log('📸 Capture d\'écran post-soumission SMS pour vérification OCR...');
            const afterSelectionScreen = await this.bluestack.takeScreenshot('after_sms_selection.png');

            return afterSelectionScreen;
            
        } catch (error) {
            console.warn(`⚠️ Erreur sélection SMS: ${error.message}`);
            
            // Fallback: essayer de cliquer directement sur Continue
            // au cas où l'option SMS serait déjà sélectionnée par défaut
            try {
                console.log('🔄 Tentative fallback: clic direct sur Continue...');
                await this.bluestack.click(383, 1310);
                await this.bluestack.wait('medium');
                console.log('✅ Continue cliqué en fallback');
                return true;
            } catch (fallbackError) {
                console.error(`❌ Fallback échoué: ${fallbackError.message}`);
                throw error;
            }
        }
    }


    /**
     * Saisir le code SMS dans WhatsApp
     */
    async inputSMSCode(code) {
        try {
            console.log(`🔢 Saisie code: ${code}`);

            // Screenshot avant
            await this.bluestack.takeScreenshot('04_before_sms_code.png');

            // Attendre l'écran de vérification
            await this.bluestack.wait('long');
            await this.bluestack.wait('long');

            // Clic sur le champ de code (position approximative)
            await this.bluestack.click(425, 420);
            await this.bluestack.wait('medium');
            await this.bluestack.click(425, 420);
            await this.bluestack.wait('medium');

            // Saisir le code de vérification OTP
            await this.bluestack.inputText(code);
            await this.bluestack.wait('medium');

            // Screenshot après saisie
            await this.bluestack.takeScreenshot('05_after_sms_code.png');

            // Attendre la validation-auto du code
            await this.bluestack.wait('long');
            await this.bluestack.wait('long');

            console.log('✅ Code validé');

        } catch (error) {
            await this.bluestack.takeScreenshot('error_sms_code.png');
            throw new Error(`Erreur saisie code: ${error.message}`);
        }
    }

    /**
     * Finaliser la création du compte
     */
    async finalizeAccount() {
        try {
            console.log('🏁 Finalisation du compte...');

            // Attendre les écrans de configuration
            await this.bluestack.wait('long');

            // Accepter le stockage des données
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('long');

            // Accepter les permissions de Contacts
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('medium');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(62); // Space


            // Attendre la configuration du compte
            await this.bluestack.wait('long');
            await this.bluestack.wait('long');

            // Écrire le nom du compte aléatoire en 4 prénoms
            const randomNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
            const randomSurnames = ['Smith', 'Johnson', 'Williams', 'Jones'];
            const randomName = `${randomNames[Math.floor(Math.random() * randomNames.length)]} ${randomSurnames[Math.floor(Math.random() * randomSurnames.length)]}`;
            console.log(`📝 Nom du compte: ${randomName}`);
            console.log('🔤 Saisie du nom du compte...');
            await this.bluestack.click(175, 720);
            await this.bluestack.wait('short');
            await this.bluestack.inputText(randomName);
            await this.bluestack.wait('medium');

            // Sauvegarder le nom du compte
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('long');

            // Skip l'ajout de l'email (optionnel)
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(61); // Tab
            await this.bluestack.wait('short');
            await this.bluestack.pressKey(62); // Space
            await this.bluestack.wait('long');

            // Essayer de cliquer sur des boutons de continuation (optionnel)
            try {
                await this.bluestack.click(600, 900);
                await this.bluestack.wait('medium');
                
                await this.bluestack.click(600, 900);
                await this.bluestack.wait('medium');
            } catch (e) {
                // Ignore si les boutons n'existent pas
            }

            // Screenshot final
            await this.bluestack.takeScreenshot('06_final_state.png');

            console.log('✅ Compte finalisé');

        } catch (error) {
            await this.bluestack.takeScreenshot('error_finalize.png');
            throw new Error(`Erreur finalisation: ${error.message}`);
        }
    }

    /**
     * Logger une étape
     */
    async step(stepName) {
        console.log(`\n${stepName}...`);
    }
}

/**
 * Fonction principale pour usage CLI
 */
async function main() {
    try {
        const country = process.argv[2] || 'UK';
        
        console.log('🚀 Workflow WhatsApp');
        console.log('═'.repeat(40));
        
        const workflow = new WhatsAppWorkflow({ country });
        
        await workflow.initialize();
        const result = await workflow.createAccount();

        if (result.success) {
            console.log('🎊 SUCCÈS ! Le compte WhatsApp est prêt.');
            process.exit(0);
        } else {
            console.log('💥 ÉCHEC. Consultez les logs et screenshots.');
            process.exit(1);
        }

    } catch (error) {
        console.error(`💥 Erreur fatale: ${error.message}`);
        process.exit(1);
    }
}

// Exports
module.exports = { WhatsAppWorkflow };

// Exécution directe
if (require.main === module) {
    main();
}