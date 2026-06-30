require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// 1. Import custom middleware & helpers
const requestConfig = require('../middleware/requestConfig'); 
const { circuitBreaker } = require('../helpers/fetchWithCircuitBreaker'); 

const app = express();

// ==========================================
// 1. CORE BODY PARSERS & MAIN STATIC STORAGE
// ==========================================
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Serve global public folder
app.use(express.static(path.join(__dirname, '../public')));

// Serve global shared assets 
let globalPath = path.join(__dirname, 'global');
if (!fs.existsSync(globalPath)) {
  globalPath = path.join(__dirname, '../global');
}
app.use('/assets/global', express.static(globalPath));

// ==========================================
// 2. DYNAMIC COMPONENT STATIC ASSET ROUTING
// ==========================================
// 🧠 FIXED: Exposing the component folders completely BEFORE any security intercepts
// This allows paths like /assets/leaderboard/partials/header/style.css to resolve cleanly.
const componentsDir = path.join(__dirname, '../components');

if (fs.existsSync(componentsDir)) {
  const components = fs.readdirSync(componentsDir);

  components.forEach(component => {
    const componentPath = path.join(componentsDir, component);
    
    if (fs.statSync(componentPath).isDirectory()) {
      // Mounts the folder to Express static server. 
      // Everything inside components/[componentName]/* is now queryable via /assets/[componentName]/*
      app.use(`/assets/${component}`, express.static(componentPath));
    }
  });
}

// ==========================================
// 3. SECURITY HEADERS & BLOCK RULES
// ==========================================
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader("Content-Security-Policy", "frame-ancestors *;");
  next();
});

// Explicitly block direct browser access to raw template engine files (.ejs)
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

// Performance Cache Configuration for deep assets
app.use('/assets/', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// ==========================================
// 4. APPLY GLOBAL CUSTOM MIDDLEWARE
// ==========================================
app.use(requestConfig);

// ==========================================
// 5. EJS ENGINE CONFIGURATION
// ==========================================
app.set('view engine', 'ejs');

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
// 6. DYNAMIC COMPONENT ROUTER/CONTROLLER MAP
// ==========================================
if (fs.existsSync(componentsDir)) {
  const components = fs.readdirSync(componentsDir);

  components.forEach(component => {
    const componentPath = path.join(componentsDir, component);
    
    if (fs.statSync(componentPath).isDirectory()) {
      try {
        // Page/View Rendering Router setup
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

        // Dedicated sub-API routing registration
        const routerPath = path.join(componentPath, 'router.js');
        if (fs.existsSync(routerPath)) {
          const router = require(routerPath);
          app.use(`/api/${component}`, router);
        }
        
        // Optional Backend Logic Controller execution
        const controllerPath = path.join(componentPath, 'controller.js');
        if (fs.existsSync(controllerPath)) {
          require(controllerPath); 
        }
      } catch (error) {
        console.error(`✗ Error building logic routes for component "${component}":`, error.message);
      }
    }
  });
}

// ==========================================
// 7. CORE BASE ENDPOINTS & ERROR ROADBLOCKS
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

app.post('/admin/reset-circuit-breaker', (req, res) => {
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailureTime = null;
  res.json({ message: 'Circuit breaker reset successfully' });
});

// Catch-All 404 Handler
app.all('*', (req, res) => {
  res.status(404).json({ status: 'fail', message: `Not Found: ${req.originalUrl}` });
});

// Global Error Catcher Boundary Middleware
app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  res.status(err.statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

module.exports = app;

// Server Listener Ignition
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}