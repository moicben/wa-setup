#!/usr/bin/env node
/**
 * Script pour créer les tables Supabase via connexion directe
 * Phase 4: Supabase Integration
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createTables() {
    try {
        console.log('🗄️ Création des tables Supabase...');
        
        // Créer le client admin
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        
        // Test de connexion
        console.log('🔍 Test de connexion...');
        const { data, error } = await supabase.from('accounts').select('count', { count: 'exact', head: true });
        
        if (error && error.code === 'PGRST106') {
            console.log('📋 Les tables n\'existent pas encore. Création via l\'interface Supabase requise.');
            console.log('💡 Veuillez créer les tables manuellement dans le tableau de bord Supabase :');
            console.log('');
            console.log('=== SQL pour table accounts ===');
            console.log(`
CREATE TABLE IF NOT EXISTS accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    country VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'created',
    sms_provider VARCHAR(50) DEFAULT 'sms-activate',
    sms_number_id VARCHAR(100),
    creation_attempts INTEGER DEFAULT 1,
    last_sms_code VARCHAR(10),
    verification_status VARCHAR(20) DEFAULT 'pending',
    error_messages TEXT[],
    workflow_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_country ON accounts(country);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at);
`);
            
            console.log('=== SQL pour table metrics ===');
            console.log(`
CREATE TABLE IF NOT EXISTS metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    workflow_id VARCHAR(100),
    account_id UUID REFERENCES accounts(id),
    phone VARCHAR(20),
    country VARCHAR(3),
    status VARCHAR(20),
    component VARCHAR(50),
    operation VARCHAR(50),
    metric_name VARCHAR(100),
    metric_value DECIMAL,
    unit VARCHAR(20),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    sms_provider VARCHAR(50),
    error_type VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    ocr_confidence DECIMAL(3,2),
    decision_engine_used BOOLEAN DEFAULT false,
    cleanup_performed BOOLEAN DEFAULT false,
    success BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_workflow_id ON metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_metrics_account_id ON metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_country ON metrics(country);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
`);
            
            console.log('');
            console.log('🌐 Accédez à votre tableau de bord Supabase :');
            console.log('   ' + process.env.SUPABASE_URL.replace('.supabase.co', '.supabase.co/project/') + '/editor');
            console.log('');
            console.log('📝 Copiez-collez le SQL ci-dessus dans l\'éditeur SQL et exécutez-le.');
            console.log('');
            console.log('⚡ Ou créez un script qui utilise les méthodes Supabase directement...');
            
        } else if (error) {
            console.error('❌ Erreur connexion:', error);
        } else {
            console.log('✅ Tables déjà créées, test réussi !');
        }
        
        // Créer les tables via les méthodes Supabase (insert avec données vides pour déclencher la création)
        console.log('🔄 Tentative de création via méthodes Supabase...');
        
        // Test avec un insert vide pour forcer la création
        const { error: insertError } = await supabase
            .from('accounts')
            .insert([])
            .select();
        
        if (insertError) {
            console.log('ℹ️  Erreur insert (normal si tables pas créées):', insertError.message);
        }
        
        console.log('');
        console.log('🏁 Pour continuer, créez les tables manuellement dans Supabase !');
        
    } catch (error) {
        console.error('❌ Erreur script:', error);
    }
}

createTables();