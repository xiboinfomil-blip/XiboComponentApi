// components/leaderboard/controller.js
const leaderboardService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        // Allow forcing dummy data via query param: /api/leaderboard?dummy=true
        const useDummyData = req.query.dummy === 'true';
        const data = await leaderboardService.getLeaderboardData(useDummyData);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        next(error);
    }
};