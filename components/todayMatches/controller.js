// components/todayMatches/controller.js
const todayMatchesService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        // Pass the whole config object or specific flags to the service
        const data = await todayMatchesService.getTodayMatches(req.appConfig);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        next(error);
    }
};