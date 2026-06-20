// routes/global/router.js
const express = require('express');
const router = express.Router();
const globalController = require('./controller');

// 🔍 DEBUG CHECK: Verify controller functions exist before using them
if (typeof globalController.ping !== 'function') {
  console.error('❌ ERROR: globalController.ping is not a function!');
  console.error('   Received:', typeof globalController.ping);
  console.error('   Full controller export:', Object.keys(globalController));
}

/**
 * @swagger
 * /api/ping:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Global]
 */
router.get('/ping', globalController.ping);

/**
 * @swagger
 * /api/version:
 *   get:
 *     summary: Get API version
 *     tags: [Global]
 */
router.get('/version', globalController.getVersion);

module.exports = router;