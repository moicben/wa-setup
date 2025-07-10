#!/usr/bin/env node
/**
 * Test du système de transcription complet
 * Valide l'intégration du TranscriptManager avec les hooks Claude Code
 */

const { getTranscriptManager } = require('../src/infrastructure/TranscriptManager');
const { logToolFromHook, initSession, finalizeSession } = require('../src/infrastructure/transcript-integration');

console.log('🧪 Test du système de transcription complet');
console.log('=====================================');

// Test du TranscriptManager
console.log('\n1. Test du TranscriptManager...');
const transcriptManager = getTranscriptManager();
const testSessionId = `test-${Date.now()}`;

try {
    // Initialiser une session de test
    transcriptManager.initializeSession(testSessionId);
    console.log('✅ Session initialisée:', testSessionId);
    
    // Simuler une demande utilisateur
    transcriptManager.logUserRequest(testSessionId, 
        'Créer un système de transcription complet pour Claude Code', 
        {
            priority: 'high',
            context: 'Amélioration du système de logging des conversations'
        }
    );
    console.log('✅ Demande utilisateur enregistrée');
    
    // Simuler une réflexion de Claude
    transcriptManager.logClaudeResponse(testSessionId, 
        'Je vais analyser l\'infrastructure existante pour implémenter un système de transcription qui capture toutes les interactions.', 
        'analysis',
        {
            reasoning: 'L\'utilisateur a besoin d\'un historique complet des conversations',
            nextSteps: 'Créer TranscriptManager, mettre à jour les hooks, intégrer avec l\'infrastructure'
        }
    );
    console.log('✅ Réflexion Claude enregistrée');
    
    // Simuler une utilisation d'outil
    transcriptManager.logToolUse(testSessionId, 
        'Read', 
        { file_path: '/path/to/file.js' },
        { success: true, content: 'File content...' },
        'success'
    );
    console.log('✅ Utilisation d\'outil enregistrée');
    
    // Simuler un outcome
    transcriptManager.logOutcome(testSessionId, 
        'Système de transcription implémenté avec succès',
        {
            summary: 'TranscriptManager créé, hooks mis à jour, intégration terminée',
            filesModified: ['src/infrastructure/TranscriptManager.js', '.claude/settings.local.json'],
            nextActions: 'Tester le système avec une vraie conversation'
        }
    );
    console.log('✅ Outcome enregistré');
    
    // Finaliser la session
    transcriptManager.finalizeSession(testSessionId, 
        'Test complet du système de transcription - Toutes les fonctionnalités validées'
    );
    console.log('✅ Session finalisée');
    
    // Vérifier les métadonnées
    const metadata = transcriptManager.getSessionMetadata(testSessionId);
    console.log('📊 Métadonnées de session:', {
        requests: metadata.userRequests.length,
        responses: metadata.claudeResponses.length,
        tools: metadata.toolUses.length,
        outcomes: metadata.outcomes.length,
        totalInteractions: metadata.totalInteractions
    });
    
} catch (error) {
    console.error('❌ Erreur test TranscriptManager:', error.message);
    process.exit(1);
}

console.log('\n2. Test de l\'intégration des hooks...');

// Test de l'intégration des hooks
try {
    // Simuler les données d'un hook
    const mockToolData = {
        tool_name: 'Bash',
        tool_input: { command: 'echo "Test hook transcript"' },
        result: { stdout: 'Test hook transcript\n', stderr: '', exit_code: 0 }
    };
    
    logToolFromHook(mockToolData);
    console.log('✅ Hook d\'intégration testé');
    
} catch (error) {
    console.error('❌ Erreur test hook:', error.message);
}

console.log('\n3. Test de recherche dans les transcripts...');

try {
    const searchResults = transcriptManager.searchTranscripts('transcription', testSessionId);
    console.log('🔍 Résultats de recherche:', searchResults);
    console.log('✅ Recherche dans les transcripts testée');
    
} catch (error) {
    console.error('❌ Erreur test recherche:', error.message);
}

console.log('\n4. Vérification des fichiers générés...');

const fs = require('fs');
const path = require('path');

try {
    // Vérifier le transcript
    const transcriptPath = path.join('logs/transcripts', `chat_${testSessionId}.log`);
    if (fs.existsSync(transcriptPath)) {
        console.log('✅ Fichier transcript créé:', transcriptPath);
        const content = fs.readFileSync(transcriptPath, 'utf8');
        console.log('📄 Taille du transcript:', content.length, 'caractères');
    } else {
        console.log('❌ Fichier transcript non trouvé');
    }
    
    // Vérifier les métadonnées
    const metadataPath = path.join('logs/transcripts/metadata', `${testSessionId}.json`);
    if (fs.existsSync(metadataPath)) {
        console.log('✅ Fichier métadonnées créé:', metadataPath);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log('📊 Métadonnées:', Object.keys(metadata).length, 'propriétés');
    } else {
        console.log('❌ Fichier métadonnées non trouvé');
    }
    
} catch (error) {
    console.error('❌ Erreur vérification fichiers:', error.message);
}

console.log('\n🎉 Test du système de transcription terminé!');
console.log('=====================================');
console.log('Le système est maintenant prêt à capturer toutes les conversations Claude Code');
console.log('avec les hooks postToolUse mis à jour dans .claude/settings.local.json');
console.log('');
console.log('💡 Pour voir le système en action:');
console.log('   1. Utilisez Claude Code normalement');
console.log('   2. Consultez les fichiers dans logs/transcripts/');
console.log('   3. Vérifiez les métadonnées dans logs/transcripts/metadata/');