// components/todayMatches/controller.js
const todayMatchesService = require('./service');

exports.getData = async (req, res, next) => {
    try {
        const useDummyData = req.query.dummy === 'true';
        const data = await todayMatchesService.getTodayMatches(useDummyData);
        
        res.json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        next(error);
    }
};