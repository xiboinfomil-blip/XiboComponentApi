require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../config/swagger.js');

let swaggerSetupMiddleware = null;

// ==========================================
// SWAGGER INITIALIZATION (Universal Fix)
// ==========================================
if (swaggerDocument && typeof swaggerDocument.then === 'function') {
  swaggerDocument
    .then(doc => {
      swaggerSetupMiddleware = swaggerUi.setup(doc, {
        customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui.css',
        customJs: [
          'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-bundle.js',
          'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js'
        ],
        customfavIcon: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/favicon-32x32.png',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true
        }
      });
      console.log('✓ Swagger document loaded successfully (Async)');
    })
    .catch(err => {
      console.error('❌ Failed to load Swagger document:', err);
    });
} else {
  swaggerSetupMiddleware = swaggerUi.setup(swaggerDocument, {
    customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui.css',
    customJs: [
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-bundle.js',
      'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js'
    ],
    customfavIcon: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/favicon-32x32.png',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  });
  console.log('✓ Swagger document loaded successfully (Sync)');
}

const app = express();

// ==========================================
// 1. SECURITY & ALLOW-ALL CORS MIDDLEWARE
// ==========================================

// Helmet has been completely removed from here.

// Wide-open CORS config (Allows absolutely everything)
app.use(cors({
  origin: true, // Echoes back whatever origin requested it, satisfying credentials requirement
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: '*', // Allows all headers sent by the client
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle preflight requests explicitly
app.options('*', cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.', retryAfter: '15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter); 

app.use(hpp());

// ==========================================
// 2. CORE MIDDLEWARE
// ==========================================

app.use(express.json({ limit: '10kb' })); 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 3. CLIENT-SIDE CACHING HEADERS
// ==========================================

app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use('/assets/', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html') && !res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// ==========================================
// 4. DYNAMIC COMPONENT LOADING (WITH QUERY OVERRIDES)
// ==========================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../components'));

const componentsDir = path.join(__dirname, '../components');
if (fs.existsSync(componentsDir)) {
  const components = fs.readdirSync(componentsDir);

  components.forEach(component => {
    const componentPath = path.join(componentsDir, component);
    
    if (fs.statSync(componentPath).isDirectory()) {
      try {
        const publicPath = path.join(componentPath, 'public');
        if (fs.existsSync(publicPath)) {
          app.use(`/assets/${component}`, express.static(publicPath));
          console.log(`✓ Loaded assets: /assets/${component}`);
        }

        const viewPath = path.join(componentPath, 'view.ejs');
        if (fs.existsSync(viewPath)) {
          app.get(`/${component}`, (req, res) => {
            const locals = {
              componentName: component,
              title: component.charAt(0).toUpperCase() + component.slice(1),
              scrollSpeed: Number(req.query.scrollSpeed) || 3000,
              showPodium: req.query.showPodium !== 'false', 
              sliderSpeed: Number(req.query.sliderSpeed) || 8000,
            };
            res.render(viewPath, locals);
          });
          console.log(`✓ Loaded view: /${component}`);
        }

        const routerPath = path.join(componentPath, 'router.js');
        if (fs.existsSync(routerPath)) {
          const router = require(routerPath);
          app.use(`/api/${component}`, router);
          console.log(`✓ Loaded router: /api/${component}`);
        }
        
        const controllerPath = path.join(componentPath, 'controller.js');
        if (fs.existsSync(controllerPath)) {
          require(controllerPath); 
        }
      } catch (error) {
        console.error(`✗ Error loading component ${component}:`, error.message);
      }
    }
  });
} else {
  console.warn('⚠️ Components directory not found at:', componentsDir);
}

// Global Routes
const globalRoutesPath = path.join(__dirname, '../routes/global/router.js');
if (fs.existsSync(globalRoutesPath)) {
  const globalRouter = require(globalRoutesPath);
  if (typeof globalRouter === 'function' || (globalRouter && typeof globalRouter.handle === 'function')) {
    app.use('/api', globalRouter);
    console.log('✓ Loaded global routes');
  } else {
    console.error(`Invalid export from ${globalRoutesPath}. Expected express.Router, got:`, typeof globalRouter);
  }
}

// ==========================================
// 5. ROUTES & SWAGGER
// ==========================================

app.use('/swagger', (req, res, next) => {
  if (swaggerSetupMiddleware) {
    swaggerSetupMiddleware(req, res, next);
  } else {
    res.status(503).send('Swagger is still initializing...');
  }
});
console.log('✓ Swagger docs will be available at /swagger');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    components: fs.existsSync(componentsDir) 
      ? fs.readdirSync(componentsDir).filter(c => 
          fs.statSync(path.join(componentsDir, c)).isDirectory()
        )
      : []
  });
});

// ==========================================
// 6. ERROR HANDLING & 404
// ==========================================

app.all('*', (req, res, next) => {
  res.status(404).json({ 
    status: 'fail', 
    message: `Can't find ${req.originalUrl} on this server!` 
  });
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  console.error('❌ Server Error:', err);
  res.status(err.statusCode).json({
    status: err.status,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ==========================================
// 7. EXPORT & LOCAL SERVER
// ==========================================

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running securely on http://localhost:${PORT}`);
    console.log(`API Docs: http://localhost:${PORT}/swagger\n`);
  });
}