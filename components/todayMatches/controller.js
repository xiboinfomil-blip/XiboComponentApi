// components/todayMatches/controller.js
const todayMatchesService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        const useDummyData = req.query.dummy === 'true';
        const forceRefetch = req.query.refetch === 'true';
        
        const data = await todayMatchesService.getTodayMatches(useDummyData, forceRefetch);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        console.error("Controller Error:", error);
        next(error);
    }
};