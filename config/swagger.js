// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'XIBO Components API',
      version: '1.0.0',
      description: 'Dynamic API for XIBO components',
    },
    servers: [
      { 
        url: process.env.NODE_ENV === 'production' 
          ? 'https://xibo-component-api.vercel.app' 
          : 'http://localhost:3000', 
        description: process.env.NODE_ENV === 'production' 
          ? 'Production (Vercel)' 
          : 'Local Development' 
      },
    ],
  },
  apis: ['./components/*/router.js', './routes/global/router.js'],
};

// Just export the result. It will be an object (v5) or a Promise (v6+).
module.exports = swaggerJsdoc(options);