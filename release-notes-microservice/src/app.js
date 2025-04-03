const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors.config');
const notionRoutes = require('./modules/notion/notion.routes');

const app = express();

// CORS middleware
app.use(cors(corsOptions));

// Options pre-flight requests for all routes
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add security headers middleware
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Ensure CORS headers are set
    const origin = req.headers.origin;
    if (origin && corsOptions.origin !== '*') {
        const allowedOrigins = Array.isArray(corsOptions.origin) ? corsOptions.origin : [corsOptions.origin];
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(','));
            res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
        }
    }

    next();
});

// Routes
app.use('/api/notion', notionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app; 