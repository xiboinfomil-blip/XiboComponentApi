require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// 1. Import your custom middleware
const requestConfig = require('../middleware/requestConfig'); 

// Import the shared circuit breaker to expose its status via API
const { circuitBreaker } = require('../helpers/fetchWithCircuitBreaker'); 

const app = express();

// ==========================================
// 1. CORE BODY PARSERS
// ==========================================
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// 2. APPLY GLOBAL MIDDLEWARE
// ==========================================

// ✅ Apply requestConfig here so it runs on EVERY request before reaching routers
app.use(requestConfig);

// ==========================================
// 🌍 GLOBAL HELPERS STATIC ROUTE
// ==========================================
let globalPath = path.join(__dirname, 'global');
if (!fs.existsSync(globalPath)) {
  globalPath = path.join(__dirname, '../global');
}
app.use('/assets/global', express.static(globalPath));

// ==========================================
// SECURITY & HEADERS
// ==========================================
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader("Content-Security-Policy", "frame-ancestors *;");
  next();
});

// Block direct access to .ejs files (Security Best Practice)
app.use('/assets/', (req, res, next) => {
  if (req.path.endsWith('.ejs')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

app.use('/assets/', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// ==========================================
// 3. EJS CONFIGURATION
// ==========================================
app.set('view engine', 'ejs');

const componentsDir = path.join(__dirname, '../components');
const viewsDirs = [componentsDir];

const sharedViewsPath = path.join(__dirname, '../views');
if (fs.existsSync(sharedViewsPath)) {
  viewsDirs.push(sharedViewsPath);
}

app.set('views', viewsDirs);

if (process.env.NODE_ENV === 'production') {
  app.enable('view cache');
}

// ==========================================
// 4. DYNAMIC COMPONENT LOADING
// ==========================================
if (fs.existsSync(componentsDir)) {
  const components = fs.readdirSync(componentsDir);

  components.forEach(component => {
    const componentPath = path.join(componentsDir, component);
    
    if (fs.statSync(componentPath).isDirectory()) {
      try {
        // ✅ SERVE ENTIRE COMPONENT FOLDER (Includes partials' CSS/JS)
        app.use(`/assets/${component}`, express.static(componentPath));
        
        const viewPath = path.join(componentPath, 'view.ejs');
        if (fs.existsSync(viewPath)) {
          app.get(`/${component}`, (req, res) => {
            const locals = {
              componentName: component,
              title: component.charAt(0).toUpperCase() + component.slice(1),
              speed: Number(req.query.speed) || 3000,
              refetch: req.query.refetch === 'true',
              dummy: req.query.dummy === 'true',
            };
            res.render(viewPath, locals);
          });
        }

        const routerPath = path.join(componentPath, 'router.js');
        if (fs.existsSync(routerPath)) {
          const router = require(routerPath);
          app.use(`/api/${component}`, router);
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
}

// ==========================================
// 5. BASIC ROUTES & ERROR HANDLING
// ==========================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    circuitBreaker: {
      isOpen: circuitBreaker.isOpen(),
      failures: circuitBreaker.failures
    }
  });
});

// 🔧 DEBUG: Manual Circuit Breaker Reset Endpoint
app.post('/admin/reset-circuit-breaker', (req, res) => {
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailureTime = null;
  res.json({ message: 'Circuit breaker reset successfully' });
});

app.all('*', (req, res) => {
  res.status(404).json({ status: 'fail', message: `Not Found: ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  res.status(err.statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}