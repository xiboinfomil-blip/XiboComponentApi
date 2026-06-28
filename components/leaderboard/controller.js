const leaderboardService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        console.log("[Controller] Fetching leaderboard data with config:", req.appConfig);
        // Pass the entire config object from the middleware
        const data = await leaderboardService.getLeaderboardData(req.appConfig);
        
        console.log(`Fetched ${data.length} leaderboard items`);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        console.error("[Controller] Error fetching leaderboard:", error);
        next(error);
    }
};