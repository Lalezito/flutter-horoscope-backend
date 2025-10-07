// DEPRECATED: This CORS middleware is replaced by proper CORS configuration in app.js
// The wildcard "*" origin is insecure for production
// Use app.js CORS configuration with ALLOWED_ORIGINS environment variable instead

module.exports = (req, res, next) => {
    // WARNING: This middleware should NOT be used in production
    // The app.js file has proper CORS configuration with environment-based origins
    console.warn("SECURITY WARNING: Using deprecated CORS middleware with wildcard origins");
    
    // Only allow wildcard in development
    if (process.env.NODE_ENV !== 'production') {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    } else {
        // In production, reject with error to force proper CORS usage
        return res.status(500).json({
            error: "Insecure CORS configuration detected",
            message: "Use proper CORS configuration in app.js with ALLOWED_ORIGINS"
        });
    }
    
    next();
};