/**
 * Point d'entrée principal pour les modules core
 * 
 * SAUVETAGE-PHASE-1: Exports des nouveaux composants stricts
 * - StrictDecisionEngine: Système de décision binaire strict
 * - CleanupManager: Nettoyage automatique après échec
 * - MultiLevelValidator: Validation multi-niveaux
 * 
 * Version: SAUVETAGE-PHASE-1
 * Date: 2025-01-08
 */

// Modules existants
const { BlueStackController } = require('./bluestack');
const { SMSManagerExtended } = require('./sms');

// Modules SAUVETAGE-PHASE-1
const { StrictDecisionEngine } = require('./decision/StrictDecisionEngine');
const { CleanupManager } = require('./cleanup/CleanupManager');
const { MultiLevelValidator } = require('./validation/MultiLevelValidator');

module.exports = {
    // Modules existants
    BlueStackController,
    SMSManagerExtended,
    
    // Modules SAUVETAGE-PHASE-1
    StrictDecisionEngine,
    CleanupManager,
    MultiLevelValidator
};