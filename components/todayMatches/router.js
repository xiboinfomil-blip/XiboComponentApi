const express = require('express');
const router = express.Router();
const controller = require('./controller');

/**
 * @swagger
 * /api/todayMatches:
 *   get:
 *     summary: Get today's matches
 *     description: Fetches matches from the external API and filters for today's date.
 *     tags: [TodayMatches]
 *     parameters:
 *       - in: query
 *         name: dummy
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Set to true to use dummy data
 *     responses:
 *       200:
 *         description: Successful response with today's matches
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
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         example: "2026-06-19 18:00:00"
 *                       group:
 *                         type: string
 *                         example: "Groupe A"
 *                       stadium:
 *                         type: string
 *                         example: "Olympiastadion"
 *                       team_a:
 *                         type: string
 *                         example: "Allemagne"
 *                       team_b:
 *                         type: string
 *                         example: "Écosse"
 *                       fulltime:
 *                         type: boolean
 *                         example: false
 *                       fulltime_a:
 *                         type: integer
 *                         nullable: true
 *                       fulltime_b:
 *                         type: integer
 *                         nullable: true
 *       500:
 *         description: Server error
 */
router.get('/', controller.getData);

module.exports = router;