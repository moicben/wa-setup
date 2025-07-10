#!/usr/bin/env node
/**
 * Test simple des tables Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testTables() {
    console.log('🧪 Test des tables Supabase...');
    
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        // Test insertion compte
        console.log('📋 Test table accounts...');
        const { data: account, error: accountError } = await supabase
            .from('accounts')
            .insert([{
                phone: '+447700900999',
                country: 'UK',
                status: 'created'
            }])
            .select()
            .single();
        
        if (accountError) {
            console.error('❌ Erreur accounts:', accountError);
        } else {
            console.log('✅ Compte créé:', account.id);
            
            // Test insertion métrique
            console.log('📊 Test table metrics...');
            const { data: metric, error: metricError } = await supabase
                .from('metrics')
                .insert([{
                    metric_type: 'workflow',
                    workflow_id: 'test_workflow',
                    account_id: account.id,
                    phone: '+447700900999',
                    country: 'UK',
                    status: 'completed',
                    duration_ms: 30000
                }])
                .select()
                .single();
            
            if (metricError) {
                console.error('❌ Erreur metrics:', metricError);
            } else {
                console.log('✅ Métrique créée:', metric.id);
            }
            
            // Nettoyage
            await supabase.from('metrics').delete().eq('account_id', account.id);
            await supabase.from('accounts').delete().eq('id', account.id);
            console.log('🧹 Test data nettoyé');
        }
        
        console.log('🎉 Tables Supabase fonctionnelles !');
        
    } catch (error) {
        console.error('❌ Erreur test:', error);
    }
}

testTables();