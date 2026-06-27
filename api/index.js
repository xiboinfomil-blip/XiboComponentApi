require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// ==========================================
// 1. CORE BODY PARSERS (Limits Removed)
// ==========================================
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// NEW: ALLOW IFRAME EMBEDDING (Universal Fix for Xibo)
// ==========================================
app.use((req, res, next) => {
  // Remove X-Frame-Options completely so Xibo can frame the components
  res.removeHeader('X-Frame-Options');
  
  // Overrides standard Content-Security-Policy to allow framing anywhere
  res.setHeader("Content-Security-Policy", "frame-ancestors *;");
  next();
});

// ==========================================
// 2. CLIENT-SIDE CACHING HEADERS
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
// 3. DYNAMIC COMPONENT LOADING (WITH QUERY OVERRIDES)
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
              speed: Number(req.query.speed) || 3000,
              refetch: req.query.refetch === 'true',
              dummy: req.query.dummy === 'true', // Changed to default to true
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

// ==========================================
// 4. BASIC ROUTES
// ==========================================
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
// 5. ERROR HANDLING & 404
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
// 6. EXPORT & LOCAL SERVER
// ==========================================
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  });
}