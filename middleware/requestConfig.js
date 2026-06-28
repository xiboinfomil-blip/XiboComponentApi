// middleware/requestConfig.js
const requestConfig = (req, res, next) => {
    // Centralize all your logic here
    req.appConfig = {
        useDummyData: req.query.dummy === 'true',
        forceRefetch: req.query.refetch === 'true',
        userId: req.headers['x-user-id'] || 'Oc14WmlclHeaOeD_02S', // Example using your test ID
        isProduction: process.env.NODE_ENV === 'production'
    };
    next();
};

module.exports = requestConfig;