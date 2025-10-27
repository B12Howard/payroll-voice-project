import dotenv from "dotenv";

// Load environment variables from .env file for local development
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

// Export both functions from their respective files
export { extractDates } from './extractDates.js';
export { crud } from './crud.js';

// Default export for backward compatibility
export { extractDates as default } from './extractDates.js';