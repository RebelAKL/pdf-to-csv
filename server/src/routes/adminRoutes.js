import express from 'express';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// SQL Routes
router.get('/sql/status', adminController.getSqlStatus);
router.post('/sql/start', adminController.startSql);
router.post('/sql/stop', adminController.stopSql);

// DocAI Routes
router.get('/docai/status', adminController.getDocAiStatus);
router.post('/docai/deploy', adminController.deployDocAi);
router.post('/docai/undeploy', adminController.undeployDocAi);

export default router;
