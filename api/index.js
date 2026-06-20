require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
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
      swaggerSetupMiddleware = swaggerUi.setup(doc);
      console.log('✓ Swagger document loaded successfully (Async)');
    })
    .catch(err => {
      console.error('❌ Failed to load Swagger document:', err);
    });
} else {
  swaggerSetupMiddleware = swaggerUi.setup(swaggerDocument);
  console.log('✓ Swagger document loaded successfully (Sync)');
}

const app = express();

// ==========================================
// 1. SECURITY & PROTECTION MIDDLEWARE
// ==========================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
    },
  },
  noSniff: true,
  frameguard: { action: 'deny' }
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

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
const components = fs.readdirSync(componentsDir);

components.forEach(component => {
  const componentPath = path.join(componentsDir, component);
  
  if (fs.statSync(componentPath).isDirectory()) {
    try {
      // A. Serve Component Static Assets
      const publicPath = path.join(componentPath, 'public');
      if (fs.existsSync(publicPath)) {
        app.use(`/assets/${component}`, express.static(publicPath));
        console.log(`✓ Loaded assets: /assets/${component}`);
      }

      // B. Serve Component EJS View with Query Param Overrides
      const viewPath = path.join(componentPath, 'view.ejs');
      if (fs.existsSync(viewPath)) {
        app.get(`/${component}`, (req, res) => {
          // ✅ Merge defaults with URL query parameters for runtime overrides
          const locals = {
            componentName: component,
            title: component.charAt(0).toUpperCase() + component.slice(1),
            
            // Leaderboard-specific defaults (overridable via ?showPodium=false&scrollSpeed=5000)
            scrollSpeed: Number(req.query.scrollSpeed) || 3000,
            showPodium: req.query.showPodium !== 'false', 
            
            // TodayMatches-specific defaults (overridable via ?sliderSpeed=3000)
            sliderSpeed: Number(req.query.sliderSpeed) || 8000,
          };

          res.render(viewPath, locals);
        });
        console.log(`✓ Loaded view: /${component}`);
      }

      // C. Serve Component API Routes
      const routerPath = path.join(componentPath, 'router.js');
      if (fs.existsSync(routerPath)) {
        const router = require(routerPath);
        app.use(`/api/${component}`, router);
        console.log(`✓ Loaded router: /api/${component}`);
      }
      
      // D. Pre-load Controller
      const controllerPath = path.join(componentPath, 'controller.js');
      if (fs.existsSync(controllerPath)) {
        require(controllerPath); 
      }
    } catch (error) {
      console.error(`✗ Error loading component ${component}:`, error.message);
    }
  }
});

// Global Routes
const globalRoutesPath = path.join(__dirname, '../routes/global/router.js');
if (fs.existsSync(globalRoutesPath)) {
  const globalRouter = require(globalRoutesPath);
  if (typeof globalRouter === 'function' || (globalRouter && typeof globalRouter.handle === 'function')) {
    app.use('/api', globalRouter);
    console.log('✓ Loaded global routes');
  } else {
    console.error(` Invalid export from ${globalRoutesPath}. Expected express.Router, got:`, typeof globalRouter);
  }
}

// ==========================================
// 5. ROUTES & SWAGGER
// ==========================================

app.use('/swagger', swaggerUi.serve, (req, res, next) => {
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
    components: components.filter(c => 
      fs.statSync(path.join(componentsDir, c)).isDirectory()
    )
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
    console.log(` API Docs: http://localhost:${PORT}/swagger\n`);
  });
}