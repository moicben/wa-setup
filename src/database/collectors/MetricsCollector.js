/**
 * MetricsCollector - Collecteur de métriques temps réel
 * Phase 4: Supabase Integration
 * 
 * Collecte et agrège les métriques de performance du workflow
 * avec stockage temps réel et système d'alertes
 */

const { getDatabaseManager } = require('../DatabaseManager');
const { EventEmitter } = require('events');

/**
 * MetricsCollector - Collecteur principal de métriques
 */
class MetricsCollector extends EventEmitter {
    constructor() {
        super();
        this.tableName = 'metrics';
        this.buffer = [];
        this.bufferSize = 100;
        this.flushInterval = 30000; // 30 secondes
        this.flushTimer = null;
        this.isFlushingBuffer = false;
        
        // Métriques en mémoire pour agrégations rapides
        this.memoryMetrics = {
            totalWorkflows: 0,
            successfulWorkflows: 0,
            failedWorkflows: 0,
            totalDuration: 0,
            averageDuration: 0,
            countryCounts: {},
            statusCounts: {},
            errorCounts: {},
            hourlyStats: {}
        };
        
        // Démarrer le flush automatique
        this.startAutoFlush();
    }

    /**
     * Enregistrer une métrique de workflow
     */
    async recordWorkflowMetric(workflowData) {
        const metric = {
            metric_type: 'workflow',
            workflow_id: workflowData.workflow_id,
            account_id: workflowData.account_id,
            phone: workflowData.phone,
            country: workflowData.country,
            status: workflowData.status,
            start_time: workflowData.start_time,
            end_time: workflowData.end_time,
            duration_ms: workflowData.duration_ms,
            sms_provider: workflowData.sms_provider,
            error_type: workflowData.error_type,
            error_message: workflowData.error_message,
            retry_count: workflowData.retry_count || 0,
            ocr_confidence: workflowData.ocr_confidence,
            decision_engine_used: workflowData.decision_engine_used || false,
            cleanup_performed: workflowData.cleanup_performed || false,
            metadata: workflowData.metadata || {},
            created_at: new Date().toISOString()
        };

        // Ajouter au buffer
        this.buffer.push(metric);
        
        // Mise à jour métriques mémoire
        this.updateMemoryMetrics(metric);
        
        // Émettre événement pour monitoring temps réel
        this.emit('workflowMetric', metric);
        
        // Flush si buffer plein
        if (this.buffer.length >= this.bufferSize) {
            await this.flushBuffer();
        }
        
        console.log(`📊 Métrique workflow enregistrée: ${metric.status} (${metric.duration_ms}ms)`);
    }

    /**
     * Enregistrer une métrique de performance
     */
    async recordPerformanceMetric(performanceData) {
        const metric = {
            metric_type: 'performance',
            component: performanceData.component,
            operation: performanceData.operation,
            duration_ms: performanceData.duration_ms,
            success: performanceData.success,
            error_type: performanceData.error_type,
            error_message: performanceData.error_message,
            metadata: performanceData.metadata || {},
            created_at: new Date().toISOString()
        };

        // Ajouter au buffer
        this.buffer.push(metric);
        
        // Émettre événement
        this.emit('performanceMetric', metric);
        
        console.log(`⚡ Métrique performance: ${metric.component}.${metric.operation} (${metric.duration_ms}ms)`);
    }

    /**
     * Enregistrer une métrique système
     */
    async recordSystemMetric(systemData) {
        const metric = {
            metric_type: 'system',
            component: systemData.component,
            metric_name: systemData.metric_name,
            metric_value: systemData.metric_value,
            unit: systemData.unit,
            metadata: systemData.metadata || {},
            created_at: new Date().toISOString()
        };

        // Ajouter au buffer
        this.buffer.push(metric);
        
        // Émettre événement
        this.emit('systemMetric', metric);
        
        console.log(`💻 Métrique système: ${metric.component}.${metric.metric_name} = ${metric.metric_value} ${metric.unit}`);
    }

    /**
     * Obtenir les métriques en temps réel
     */
    getRealTimeMetrics() {
        const now = new Date();
        const currentHour = now.getHours();
        
        return {
            ...this.memoryMetrics,
            bufferSize: this.buffer.length,
            lastUpdated: now.toISOString(),
            currentHour: currentHour,
            currentHourStats: this.memoryMetrics.hourlyStats[currentHour] || {}
        };
    }

    /**
     * Obtenir les métriques par période
     */
    async getMetricsByPeriod(period = '24h', metricType = null) {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Calculer la date de début
            const endTime = new Date();
            const startTime = new Date();
            
            switch (period) {
                case '1h':
                    startTime.setHours(startTime.getHours() - 1);
                    break;
                case '24h':
                    startTime.setHours(startTime.getHours() - 24);
                    break;
                case '7d':
                    startTime.setDate(startTime.getDate() - 7);
                    break;
                case '30d':
                    startTime.setDate(startTime.getDate() - 30);
                    break;
                default:
                    startTime.setHours(startTime.getHours() - 24);
            }
            
            // Construire la requête
            let query = supabase
                .from(this.tableName)
                .select('*')
                .gte('created_at', startTime.toISOString())
                .lte('created_at', endTime.toISOString())
                .order('created_at', { ascending: false });
            
            if (metricType) {
                query = query.eq('metric_type', metricType);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error('❌ Erreur récupération métriques:', error);
                throw error;
            }
            
            // Agréger les données
            const aggregated = this.aggregateMetrics(data);
            
            console.log(`✅ ${data.length} métriques récupérées pour ${period}`);
            
            return {
                period,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                totalMetrics: data.length,
                rawData: data,
                aggregated
            };
            
        } catch (error) {
            console.error('❌ Erreur MetricsCollector.getMetricsByPeriod:', error);
            throw error;
        }
    }

    /**
     * Obtenir les statistiques détaillées
     */
    async getDetailedStats() {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Statistiques générales
            const { data: allMetrics, error } = await supabase
                .from(this.tableName)
                .select('*')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
            
            if (error) throw error;
            
            // Métriques par type
            const workflowMetrics = allMetrics.filter(m => m.metric_type === 'workflow');
            const performanceMetrics = allMetrics.filter(m => m.metric_type === 'performance');
            const systemMetrics = allMetrics.filter(m => m.metric_type === 'system');
            
            // Calculs détaillés
            const stats = {
                overview: {
                    totalMetrics: allMetrics.length,
                    workflowMetrics: workflowMetrics.length,
                    performanceMetrics: performanceMetrics.length,
                    systemMetrics: systemMetrics.length
                },
                
                workflow: this.calculateWorkflowStats(workflowMetrics),
                performance: this.calculatePerformanceStats(performanceMetrics),
                system: this.calculateSystemStats(systemMetrics),
                
                realTime: this.getRealTimeMetrics(),
                
                generatedAt: new Date().toISOString()
            };
            
            console.log('✅ Statistiques détaillées générées');
            return stats;
            
        } catch (error) {
            console.error('❌ Erreur MetricsCollector.getDetailedStats:', error);
            throw error;
        }
    }

    /**
     * Détecter les anomalies et alertes
     */
    async detectAnomalies() {
        const alerts = [];
        const metrics = this.getRealTimeMetrics();
        
        // Taux d'échec élevé
        const failureRate = metrics.totalWorkflows > 0 ? 
            (metrics.failedWorkflows / metrics.totalWorkflows) * 100 : 0;
        
        if (failureRate > 50) {
            alerts.push({
                type: 'high_failure_rate',
                severity: 'critical',
                message: `Taux d'échec élevé: ${failureRate.toFixed(1)}%`,
                value: failureRate,
                threshold: 50
            });
        }
        
        // Durée moyenne élevée
        if (metrics.averageDuration > 300000) { // 5 minutes
            alerts.push({
                type: 'high_duration',
                severity: 'warning',
                message: `Durée moyenne élevée: ${(metrics.averageDuration / 1000).toFixed(1)}s`,
                value: metrics.averageDuration,
                threshold: 300000
            });
        }
        
        // Buffer plein
        if (this.buffer.length >= this.bufferSize * 0.8) {
            alerts.push({
                type: 'buffer_full',
                severity: 'warning',
                message: `Buffer presque plein: ${this.buffer.length}/${this.bufferSize}`,
                value: this.buffer.length,
                threshold: this.bufferSize * 0.8
            });
        }
        
        // Émettre les alertes
        if (alerts.length > 0) {
            this.emit('alerts', alerts);
            console.log(`🚨 ${alerts.length} alertes détectées`);
        }
        
        return alerts;
    }

    /**
     * Flush du buffer vers la base de données
     */
    async flushBuffer() {
        if (this.isFlushingBuffer || this.buffer.length === 0) {
            return;
        }
        
        this.isFlushingBuffer = true;
        
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Copier et vider le buffer
            const metricsToFlush = [...this.buffer];
            this.buffer = [];
            
            // Insertion batch
            const { error } = await supabase
                .from(this.tableName)
                .insert(metricsToFlush);
            
            if (error) {
                console.error('❌ Erreur flush buffer:', error);
                // Remettre les métriques dans le buffer
                this.buffer.unshift(...metricsToFlush);
                throw error;
            }
            
            console.log(`✅ ${metricsToFlush.length} métriques sauvegardées`);
            
        } catch (error) {
            console.error('❌ Erreur MetricsCollector.flushBuffer:', error);
            throw error;
            
        } finally {
            this.isFlushingBuffer = false;
        }
    }

    /**
     * Démarrer le flush automatique
     */
    startAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        this.flushTimer = setInterval(async () => {
            try {
                await this.flushBuffer();
            } catch (error) {
                console.error('❌ Erreur flush automatique:', error);
            }
        }, this.flushInterval);
        
        console.log(`⏰ Flush automatique démarré (${this.flushInterval}ms)`);
    }

    /**
     * Arrêter le flush automatique
     */
    stopAutoFlush() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        console.log('⏹️ Flush automatique arrêté');
    }

    /**
     * Mise à jour des métriques mémoire
     */
    updateMemoryMetrics(metric) {
        if (metric.metric_type === 'workflow') {
            this.memoryMetrics.totalWorkflows++;
            
            if (metric.status === 'completed') {
                this.memoryMetrics.successfulWorkflows++;
            } else if (metric.status === 'failed') {
                this.memoryMetrics.failedWorkflows++;
            }
            
            if (metric.duration_ms) {
                this.memoryMetrics.totalDuration += metric.duration_ms;
                this.memoryMetrics.averageDuration = 
                    this.memoryMetrics.totalDuration / this.memoryMetrics.totalWorkflows;
            }
            
            // Compter par pays
            if (metric.country) {
                this.memoryMetrics.countryCounts[metric.country] = 
                    (this.memoryMetrics.countryCounts[metric.country] || 0) + 1;
            }
            
            // Compter par statut
            if (metric.status) {
                this.memoryMetrics.statusCounts[metric.status] = 
                    (this.memoryMetrics.statusCounts[metric.status] || 0) + 1;
            }
            
            // Compter par erreur
            if (metric.error_type) {
                this.memoryMetrics.errorCounts[metric.error_type] = 
                    (this.memoryMetrics.errorCounts[metric.error_type] || 0) + 1;
            }
            
            // Statistiques horaires
            const hour = new Date().getHours();
            if (!this.memoryMetrics.hourlyStats[hour]) {
                this.memoryMetrics.hourlyStats[hour] = {
                    total: 0,
                    successful: 0,
                    failed: 0
                };
            }
            
            this.memoryMetrics.hourlyStats[hour].total++;
            if (metric.status === 'completed') {
                this.memoryMetrics.hourlyStats[hour].successful++;
            } else if (metric.status === 'failed') {
                this.memoryMetrics.hourlyStats[hour].failed++;
            }
        }
    }

    /**
     * Agréger les métriques
     */
    aggregateMetrics(metrics) {
        const aggregated = {
            byType: {},
            byStatus: {},
            byCountry: {},
            byHour: {},
            performance: {
                totalDuration: 0,
                averageDuration: 0,
                successRate: 0
            }
        };
        
        metrics.forEach(metric => {
            // Par type
            aggregated.byType[metric.metric_type] = 
                (aggregated.byType[metric.metric_type] || 0) + 1;
            
            // Par statut (pour les workflows)
            if (metric.status) {
                aggregated.byStatus[metric.status] = 
                    (aggregated.byStatus[metric.status] || 0) + 1;
            }
            
            // Par pays
            if (metric.country) {
                aggregated.byCountry[metric.country] = 
                    (aggregated.byCountry[metric.country] || 0) + 1;
            }
            
            // Par heure
            const hour = new Date(metric.created_at).getHours();
            aggregated.byHour[hour] = (aggregated.byHour[hour] || 0) + 1;
            
            // Performance
            if (metric.duration_ms) {
                aggregated.performance.totalDuration += metric.duration_ms;
            }
        });
        
        // Calculs finaux
        const workflowMetrics = metrics.filter(m => m.metric_type === 'workflow');
        if (workflowMetrics.length > 0) {
            aggregated.performance.averageDuration = 
                aggregated.performance.totalDuration / workflowMetrics.length;
            
            const successful = workflowMetrics.filter(m => m.status === 'completed').length;
            aggregated.performance.successRate = (successful / workflowMetrics.length) * 100;
        }
        
        return aggregated;
    }

    /**
     * Calculer les statistiques workflow
     */
    calculateWorkflowStats(workflowMetrics) {
        if (workflowMetrics.length === 0) return {};
        
        const stats = {
            total: workflowMetrics.length,
            successful: workflowMetrics.filter(m => m.status === 'completed').length,
            failed: workflowMetrics.filter(m => m.status === 'failed').length,
            avgDuration: 0,
            byCountry: {},
            byProvider: {}
        };
        
        stats.successRate = (stats.successful / stats.total) * 100;
        
        let totalDuration = 0;
        workflowMetrics.forEach(metric => {
            if (metric.duration_ms) {
                totalDuration += metric.duration_ms;
            }
            
            if (metric.country) {
                stats.byCountry[metric.country] = (stats.byCountry[metric.country] || 0) + 1;
            }
            
            if (metric.sms_provider) {
                stats.byProvider[metric.sms_provider] = (stats.byProvider[metric.sms_provider] || 0) + 1;
            }
        });
        
        stats.avgDuration = totalDuration / workflowMetrics.length;
        
        return stats;
    }

    /**
     * Calculer les statistiques performance
     */
    calculatePerformanceStats(performanceMetrics) {
        if (performanceMetrics.length === 0) return {};
        
        const stats = {
            total: performanceMetrics.length,
            byComponent: {},
            byOperation: {},
            avgDuration: 0
        };
        
        let totalDuration = 0;
        performanceMetrics.forEach(metric => {
            if (metric.duration_ms) {
                totalDuration += metric.duration_ms;
            }
            
            if (metric.component) {
                stats.byComponent[metric.component] = (stats.byComponent[metric.component] || 0) + 1;
            }
            
            if (metric.operation) {
                stats.byOperation[metric.operation] = (stats.byOperation[metric.operation] || 0) + 1;
            }
        });
        
        stats.avgDuration = totalDuration / performanceMetrics.length;
        
        return stats;
    }

    /**
     * Calculer les statistiques système
     */
    calculateSystemStats(systemMetrics) {
        if (systemMetrics.length === 0) return {};
        
        const stats = {
            total: systemMetrics.length,
            byComponent: {},
            byMetric: {}
        };
        
        systemMetrics.forEach(metric => {
            if (metric.component) {
                stats.byComponent[metric.component] = (stats.byComponent[metric.component] || 0) + 1;
            }
            
            if (metric.metric_name) {
                stats.byMetric[metric.metric_name] = (stats.byMetric[metric.metric_name] || 0) + 1;
            }
        });
        
        return stats;
    }

    /**
     * Arrêter le collecteur
     */
    async shutdown() {
        console.log('🔄 Arrêt MetricsCollector...');
        
        try {
            // Arrêter le flush automatique
            this.stopAutoFlush();
            
            // Flush final
            await this.flushBuffer();
            
            // Vider les métriques mémoire
            this.memoryMetrics = {
                totalWorkflows: 0,
                successfulWorkflows: 0,
                failedWorkflows: 0,
                totalDuration: 0,
                averageDuration: 0,
                countryCounts: {},
                statusCounts: {},
                errorCounts: {},
                hourlyStats: {}
            };
            
            console.log('✅ MetricsCollector arrêté');
            
        } catch (error) {
            console.error('❌ Erreur arrêt MetricsCollector:', error);
            throw error;
        }
    }
}

// Instance singleton
let metricsCollector = null;

/**
 * Obtenir l'instance singleton du MetricsCollector
 */
function getMetricsCollector() {
    if (!metricsCollector) {
        metricsCollector = new MetricsCollector();
    }
    return metricsCollector;
}

module.exports = {
    MetricsCollector,
    getMetricsCollector
};