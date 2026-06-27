const leaderboardService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        // Allow forcing dummy data via query param: /api/leaderboard?dummy=true
        const useDummyData = req.query.dummy === 'true';
        
        // Allow forcing refetch via query param: /api/leaderboard?refetch=true
        const forceRefetch = req.query.refetch === 'true';
        
        const data = await leaderboardService.getLeaderboardData(useDummyData, forceRefetch);
        
        console.log(`Fetched ${data.length} leaderboard items (dummy: ${useDummyData}, refetch: ${forceRefetch})`);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        next(error);
    }
};