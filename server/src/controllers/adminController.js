import { google } from 'googleapis';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { broadcast } from '../services/websocket.js';

// Initialize clients
const sqlAdmin = google.sql('v1beta4');
const docAiClient = new DocumentProcessorServiceClient({
    keyFilename: config.credentials
});

// Helper to get auth client for Google APIs
const getAuthClient = async () => {
    const auth = new google.auth.GoogleAuth({
        keyFile: config.credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    return await auth.getClient();
};

// --- Cloud SQL Management ---

export const getSqlStatus = async (req, res) => {
    try {
        const auth = await getAuthClient();
        // Parse instance string: project:region:instance
        // Env var DB_HOST might be /cloudsql/project:region:instance or localhost
        // We need the instance name from config or env. 
        // Assuming standard format "project:region:instance" is available or we parse it.
        // For simplicity, let's extract from DB_HOST if it starts with /cloudsql/
        let instanceConnectionName = config.dbHost.startsWith('/cloudsql/')
            ? config.dbHost.replace('/cloudsql/', '')
            : process.env.CLOUD_SQL_CONNECTION_NAME;

        if (!instanceConnectionName) {
            // Fallback: try to construct it or fail
            instanceConnectionName = `${config.projectId}:${config.location}:pdf2csv-instance`;
        }

        const [project, region, instance] = instanceConnectionName.split(':');

        const request = {
            project,
            instance,
            auth
        };

        const response = await sqlAdmin.instances.get(request);
        const status = response.data.state; // RUNNABLE, SUSPENDED, STOPPED, etc.

        res.json({ status, instance: instanceConnectionName });
    } catch (error) {
        logger.error('Error getting SQL status:', error);
        res.status(500).json({ error: error.message });
    }
};

export const startSql = async (req, res) => {
    try {
        const auth = await getAuthClient();
        let instanceConnectionName = config.dbHost.startsWith('/cloudsql/')
            ? config.dbHost.replace('/cloudsql/', '')
            : process.env.CLOUD_SQL_CONNECTION_NAME || `${config.projectId}:${config.location}:pdf2csv-instance`;

        const [project, region, instance] = instanceConnectionName.split(':');

        logger.info(`Starting Cloud SQL instance: ${instance}`);
        broadcast({ type: 'admin:status', message: `Starting Cloud SQL instance ${instance}...` });

        const request = {
            project,
            instance,
            resource: {
                settings: {
                    activationPolicy: 'ALWAYS'
                }
            },
            auth
        };

        const response = await sqlAdmin.instances.patch(request);

        // Poll for completion in background
        pollOperation(response.data.name, project, auth, 'SQL Start');

        res.json({ message: 'Start operation initiated', operation: response.data.name });
    } catch (error) {
        logger.error('Error starting SQL:', error);
        res.status(500).json({ error: error.message });
    }
};

export const stopSql = async (req, res) => {
    try {
        const auth = await getAuthClient();
        let instanceConnectionName = config.dbHost.startsWith('/cloudsql/')
            ? config.dbHost.replace('/cloudsql/', '')
            : process.env.CLOUD_SQL_CONNECTION_NAME || `${config.projectId}:${config.location}:pdf2csv-instance`;

        const [project, region, instance] = instanceConnectionName.split(':');

        logger.info(`Stopping Cloud SQL instance: ${instance}`);
        broadcast({ type: 'admin:status', message: `Stopping Cloud SQL instance ${instance}...` });

        const request = {
            project,
            instance,
            resource: {
                settings: {
                    activationPolicy: 'NEVER'
                }
            },
            auth
        };

        const response = await sqlAdmin.instances.patch(request);

        pollOperation(response.data.name, project, auth, 'SQL Stop');

        res.json({ message: 'Stop operation initiated', operation: response.data.name });
    } catch (error) {
        logger.error('Error stopping SQL:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Document AI Management ---

export const getDocAiStatus = async (req, res) => {
    try {
        const name = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
        const [processor] = await docAiClient.getProcessor({ name });

        // state: ENABLED, DISABLED, ENABLING, DISABLING
        res.json({ status: processor.state, name: processor.name });
    } catch (error) {
        logger.error('Error getting DocAI status:', error);
        res.status(500).json({ error: error.message });
    }
};

export const deployDocAi = async (req, res) => {
    try {
        const name = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;

        logger.info(`Deploying Document AI processor: ${config.processorId}`);
        broadcast({ type: 'admin:status', message: `Deploying Document AI processor...` });

        const [operation] = await docAiClient.enableProcessor({ name });

        // Background wait
        operation.promise().then(() => {
            logger.info('Document AI Deployed');
            broadcast({ type: 'admin:status', message: 'Document AI Deployed Successfully', status: 'ENABLED' });
        }).catch(err => {
            logger.error('Error deploying DocAI:', err);
            broadcast({ type: 'admin:status', message: `Error deploying DocAI: ${err.message}`, status: 'ERROR' });
        });

        res.json({ message: 'Deploy operation initiated', operation: operation.name });
    } catch (error) {
        logger.error('Error deploying DocAI:', error);
        res.status(500).json({ error: error.message });
    }
};

export const undeployDocAi = async (req, res) => {
    try {
        const name = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;

        logger.info(`Undeploying Document AI processor: ${config.processorId}`);
        broadcast({ type: 'admin:status', message: `Undeploying Document AI processor...` });

        const [operation] = await docAiClient.disableProcessor({ name });

        operation.promise().then(() => {
            logger.info('Document AI Undeployed');
            broadcast({ type: 'admin:status', message: 'Document AI Undeployed Successfully', status: 'DISABLED' });
        }).catch(err => {
            logger.error('Error undeploying DocAI:', err);
            broadcast({ type: 'admin:status', message: `Error undeploying DocAI: ${err.message}`, status: 'ERROR' });
        });

        res.json({ message: 'Undeploy operation initiated', operation: operation.name });
    } catch (error) {
        logger.error('Error undeploying DocAI:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Helpers ---

const pollOperation = async (operationName, project, auth, type) => {
    const checkInterval = 5000; // 5s
    const maxAttempts = 120; // 10 mins

    let attempts = 0;
    const check = async () => {
        try {
            const res = await sqlAdmin.operations.get({ project, operation: operationName, auth });
            const op = res.data;

            if (op.status === 'DONE') {
                if (op.error) {
                    logger.error(`${type} failed:`, op.error);
                    broadcast({ type: 'admin:status', message: `${type} Failed: ${op.error.message}`, status: 'ERROR' });
                } else {
                    logger.info(`${type} completed successfully`);
                    broadcast({ type: 'admin:status', message: `${type} Completed Successfully`, status: 'DONE' });
                }
                return;
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(check, checkInterval);
            } else {
                logger.warn(`${type} timed out polling`);
                broadcast({ type: 'admin:status', message: `${type} timed out polling (check console)`, status: 'TIMEOUT' });
            }
        } catch (err) {
            logger.error(`Error polling ${type}:`, err);
        }
    };

    setTimeout(check, checkInterval);
};
