// Shared utilities for Cloud Functions

// Get allowed origins from environment variables
export function getAllowedOrigins() {
  return process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        "http://localhost:5001",
        "https://localhost:5001",     
        "http://localhost:3000",      
        "https://localhost:3000"      
      ];
}

// Set CORS headers
export function setCorsHeaders(req, res) {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Max-Age", "86400");
}

// Handle preflight OPTIONS request
export function handlePreflight(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  return false;
}

// Check if origin is allowed
export function isOriginAllowed(req) {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  return allowedOrigins.includes(origin);
}
