// Fichier utilitaire pour la connexion à Supabase
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction complète récupèration de nouveaux contacts
async function getNewContacts(query, count) {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('source_query', query)
        .eq('status', 'new')
        .limit(count)
        .order('created_at', { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

// Mise à jour du statut d'un contact après traitement
async function updateContactStatus(id, status, campaign) {
    const { data, error } = await supabase
        .from('contacts')
        .update({ 
            status: status,
            last_campaign: campaign.name,
            last_contacted_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        throw error;
    }

    return data;
}

// Export de l'utilitaire
module.exports = {
    getNewContacts,
    updateContactStatus
};