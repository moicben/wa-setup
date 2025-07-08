/**
 * CloudPhoneNumberParser - Extension du PhoneNumberParser pour cloud phones
 * Gestion des formats numéros cloud, validation géo-cohérence et mapping pays-proxy
 */

const { PhoneNumberParser } = require('../core/sms/parsers');

class CloudPhoneNumberParser {
    constructor() {
        
        // Configuration cloud spécifique
        this.cloudConfig = {
            // Mapping des préfixes cloud vers les pays réels
            cloudPrefixes: {
                'C44': 'UK',  // Cloud UK prefix
                'C33': 'FR',  // Cloud FR prefix
                'CGB': 'UK',  // Alternative Cloud GB
                'CFR': 'FR'   // Alternative Cloud FR
            },
            
            // Validation des patterns cloud
            cloudPatterns: {
                UK: [
                    /^C44\d{10}$/,           // Format: C44 + 10 digits
                    /^CGB\d{10}$/,           // Format: CGB + 10 digits
                    /^UK_CLOUD_\d{10}$/      // Format: UK_CLOUD_ + 10 digits
                ],
                FR: [
                    /^C33\d{9}$/,            // Format: C33 + 9 digits
                    /^CFR\d{9}$/,            // Format: CFR + 9 digits
                    /^FR_CLOUD_\d{9}$/       // Format: FR_CLOUD_ + 9 digits
                ]
            },
            
            // Conversion des formats cloud vers standards
            cloudToStandard: {
                UK: (cloudNumber) => {
                    // Extraire les digits et convertir en format UK standard
                    const digits = cloudNumber.replace(/[^\d]/g, '');
                    return digits.length >= 10 ? `44${digits.slice(-10)}` : null;
                },
                FR: (cloudNumber) => {
                    // Extraire les digits et convertir en format FR standard
                    const digits = cloudNumber.replace(/[^\d]/g, '');
                    return digits.length >= 9 ? `33${digits.slice(-9)}` : null;
                }
            }
        };
    }

    /**
     * Déléguer au parser standard pour compatibilité
     */
    parseNumber(number, country) {
        return PhoneNumberParser.parseNumber(number, country);
    }

    /**
     * Parser un numéro cloud avec validation géo-cohérence
     */
    parseCloudNumber(cloudNumber, expectedCountry, proxyInfo = null) {
        try {
            // Validation des paramètres
            if (!cloudNumber || !expectedCountry) {
                return this._createFailureResult('Paramètres manquants pour parsing cloud');
            }

            // Étape 1: Détecter le type de numéro cloud
            const cloudType = this._detectCloudType(cloudNumber);
            
            // Étape 2: Valider le format cloud
            const formatValidation = this._validateCloudFormat(cloudNumber, expectedCountry);
            
            if (!formatValidation.valid) {
                return this._createFailureResult(`Format cloud invalide: ${formatValidation.reason}`);
            }

            // Étape 3: Convertir vers format standard
            const standardNumber = this._convertCloudToStandard(cloudNumber, expectedCountry);
            
            if (!standardNumber) {
                return this._createFailureResult('Conversion cloud vers standard échouée');
            }

            // Étape 4: Parser avec le parser standard
            const standardParsing = PhoneNumberParser.parseNumber(standardNumber, expectedCountry);
            
            if (!standardParsing.success) {
                return this._createFailureResult(`Parsing standard échoué: ${standardParsing.error}`);
            }

            // Étape 5: Validation géo-cohérence avec proxy
            const geoValidation = this._validateGeoCoherence(
                standardParsing, 
                expectedCountry, 
                proxyInfo
            );

            // Étape 6: Créer le résultat enrichi
            const result = {
                ...standardParsing,
                cloud: {
                    originalNumber: cloudNumber,
                    cloudType: cloudType,
                    formatValidation: formatValidation,
                    geoValidation: geoValidation,
                    proxyInfo: proxyInfo
                },
                metadata: {
                    ...standardParsing.metadata,
                    isCloudNumber: true,
                    cloudProvider: 'MoreLogin',
                    geoCoherent: geoValidation.coherent
                }
            };

            console.log(`✅ Cloud number parsed: ${cloudNumber} → ${standardNumber} (${expectedCountry})`);
            return result;

        } catch (error) {
            return this._createFailureResult(`Erreur parsing cloud: ${error.message}`);
        }
    }

    /**
     * Valider la cohérence géographique avec multiple proxies
     */
    validateGeoCoherenceWithProxies(parsedNumber, proxies) {
        try {
            const validations = [];
            
            for (const proxy of proxies) {
                const geoValidation = this._validateGeoCoherence(
                    parsedNumber,
                    parsedNumber.countryCode === '44' ? 'UK' : 'FR',
                    proxy
                );
                
                validations.push({
                    proxyId: proxy.id,
                    proxyCountry: proxy.expectedCountry,
                    coherent: geoValidation.coherent,
                    confidence: geoValidation.confidence,
                    details: geoValidation
                });
            }

            // Calculer la cohérence globale
            const coherentValidations = validations.filter(v => v.coherent);
            const overallCoherent = coherentValidations.length > 0;
            const averageConfidence = validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length;

            return {
                overallCoherent,
                averageConfidence,
                coherentProxies: coherentValidations.length,
                totalProxies: validations.length,
                validations
            };

        } catch (error) {
            return {
                overallCoherent: false,
                averageConfidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Détecter le type de numéro cloud
     */
    _detectCloudType(cloudNumber) {
        const str = cloudNumber.toString().toUpperCase();
        
        if (str.startsWith('C44') || str.startsWith('CGB')) {
            return 'UK_CLOUD';
        } else if (str.startsWith('C33') || str.startsWith('CFR')) {
            return 'FR_CLOUD';
        } else if (str.includes('UK_CLOUD_')) {
            return 'UK_NAMED_CLOUD';
        } else if (str.includes('FR_CLOUD_')) {
            return 'FR_NAMED_CLOUD';
        } else if (str.includes('CLOUD')) {
            return 'GENERIC_CLOUD';
        }
        
        return 'UNKNOWN';
    }

    /**
     * Valider le format cloud
     */
    _validateCloudFormat(cloudNumber, expectedCountry) {
        const patterns = this.cloudConfig.cloudPatterns[expectedCountry];
        
        if (!patterns) {
            return {
                valid: false,
                reason: `Pays non supporté pour cloud: ${expectedCountry}`
            };
        }

        for (const pattern of patterns) {
            if (pattern.test(cloudNumber)) {
                return {
                    valid: true,
                    pattern: pattern.toString(),
                    matchedPattern: pattern
                };
            }
        }

        return {
            valid: false,
            reason: `Aucun pattern cloud ne correspond pour ${expectedCountry}`,
            testedPatterns: patterns.map(p => p.toString())
        };
    }

    /**
     * Convertir un numéro cloud vers format standard
     */
    _convertCloudToStandard(cloudNumber, expectedCountry) {
        const converter = this.cloudConfig.cloudToStandard[expectedCountry];
        
        if (!converter) {
            return null;
        }

        try {
            return converter(cloudNumber);
        } catch (error) {
            console.warn(`Conversion cloud échouée: ${error.message}`);
            return null;
        }
    }

    /**
     * Valider la cohérence géographique
     */
    _validateGeoCoherence(parsedNumber, expectedCountry, proxyInfo) {
        if (!proxyInfo) {
            return {
                coherent: true,
                confidence: 0.5,
                reason: 'Pas de proxy pour validation'
            };
        }

        try {
            // Vérifier la cohérence pays
            const numberCountry = parsedNumber.countryCode === '44' ? 'UK' : 
                                 parsedNumber.countryCode === '33' ? 'FR' : 'UNKNOWN';
            
            const proxyCountry = proxyInfo.expectedCountry;
            const expectedNormalized = expectedCountry.toUpperCase();
            
            // Cohérence directe
            const directCoherent = numberCountry === proxyCountry && 
                                  numberCountry === expectedNormalized;
            
            if (directCoherent) {
                return {
                    coherent: true,
                    confidence: 0.95,
                    reason: 'Cohérence parfaite number-proxy-expected',
                    details: { numberCountry, proxyCountry, expectedNormalized }
                };
            }

            // Cohérence partielle (UK/GB)
            const ukVariants = ['UK', 'GB'];
            const partialCoherent = ukVariants.includes(numberCountry) && 
                                   ukVariants.includes(proxyCountry) && 
                                   ukVariants.includes(expectedNormalized);
            
            if (partialCoherent) {
                return {
                    coherent: true,
                    confidence: 0.85,
                    reason: 'Cohérence UK/GB variants',
                    details: { numberCountry, proxyCountry, expectedNormalized }
                };
            }

            // Incohérent
            return {
                coherent: false,
                confidence: 0.1,
                reason: 'Incohérence géographique détectée',
                details: { 
                    numberCountry, 
                    proxyCountry, 
                    expectedNormalized,
                    mismatch: true
                }
            };

        } catch (error) {
            return {
                coherent: false,
                confidence: 0,
                reason: `Erreur validation géo: ${error.message}`
            };
        }
    }

    /**
     * Générer des suggestions de proxy pour un numéro
     */
    suggestProxiesForNumber(parsedNumber, availableProxies) {
        try {
            const numberCountry = parsedNumber.countryCode === '44' ? 'UK' : 
                                 parsedNumber.countryCode === '33' ? 'FR' : 'UNKNOWN';
            
            if (numberCountry === 'UNKNOWN') {
                return {
                    suggestions: [],
                    reason: 'Pays du numéro non reconnu'
                };
            }

            // Filtrer les proxies compatibles
            const compatibleProxies = availableProxies.filter(proxy => {
                return proxy.expectedCountry === numberCountry || 
                       (numberCountry === 'UK' && proxy.expectedCountry === 'GB') ||
                       (numberCountry === 'GB' && proxy.expectedCountry === 'UK');
            });

            // Trier par performance (temps de réponse)
            compatibleProxies.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));

            return {
                suggestions: compatibleProxies.slice(0, 3), // Top 3
                totalCompatible: compatibleProxies.length,
                numberCountry,
                reason: `${compatibleProxies.length} proxies compatibles trouvés`
            };

        } catch (error) {
            return {
                suggestions: [],
                reason: `Erreur suggestions: ${error.message}`
            };
        }
    }

    /**
     * Analyser les patterns de numéros cloud pour debugging
     */
    analyzeCloudPatterns(cloudNumbers) {
        const analysis = {
            total: cloudNumbers.length,
            byType: {},
            byCountry: {},
            patterns: [],
            errors: []
        };

        for (const cloudNumber of cloudNumbers) {
            try {
                const type = this._detectCloudType(cloudNumber);
                analysis.byType[type] = (analysis.byType[type] || 0) + 1;

                // Essayer de détecter le pays
                for (const [country, patterns] of Object.entries(this.cloudConfig.cloudPatterns)) {
                    const validation = this._validateCloudFormat(cloudNumber, country);
                    if (validation.valid) {
                        analysis.byCountry[country] = (analysis.byCountry[country] || 0) + 1;
                        break;
                    }
                }

                // Extraire les patterns
                const pattern = this._extractPattern(cloudNumber);
                if (pattern && !analysis.patterns.includes(pattern)) {
                    analysis.patterns.push(pattern);
                }

            } catch (error) {
                analysis.errors.push({
                    number: cloudNumber,
                    error: error.message
                });
            }
        }

        return analysis;
    }

    /**
     * Extraire un pattern générique d'un numéro
     */
    _extractPattern(number) {
        return number.toString()
            .replace(/\d/g, 'D')  // Remplacer les chiffres par D
            .replace(/[a-z]/gi, 'L'); // Remplacer les lettres par L
    }

    /**
     * Créer un résultat d'échec
     */
    _createFailureResult(reason) {
        return {
            success: false,
            error: reason,
            cloud: {
                originalNumber: null,
                cloudType: 'UNKNOWN',
                geoValidation: { coherent: false, confidence: 0 }
            },
            metadata: {
                isCloudNumber: true,
                cloudProvider: 'MoreLogin',
                geoCoherent: false
            }
        };
    }
}

module.exports = { CloudPhoneNumberParser }; 