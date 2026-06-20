const express = require('express');
const router = express.Router();
const controller = require('./controller');

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Get leaderboard ranking data
 *     description: Fetches ranking data from the external API or returns dummy data.
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: dummy
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Set to true to use dummy data instead of the live API
 *     responses:
 *       200:
 *         description: Successful response with ranking data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 8
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank:
 *                         type: integer
 *                         example: 1
 *                       key:
 *                         type: string
 *                         example: "iml-aaa"
 *                       point:
 *                         type: integer
 *                         example: 150
 *       500:
 *         description: Server error
 */
router.get('/', controller.getData);

module.exports = router;