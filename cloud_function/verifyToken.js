import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GCP_PROJECT || 'payroll-voice-1761010448'
  });
}

// List of allowed email addresses
const getAllowedEmails = () => {
  const allowedEmailsEnv = process.env.ALLOWED_EMAILS || '';
  return allowedEmailsEnv 
    ? allowedEmailsEnv.split(',').map(email => email.trim())
    : [];
};

/**
 * Verify Firebase ID token and check if user is authorized
 * @param {string} authHeader - Authorization header from request
 * @returns {Promise<{verified: boolean, user?: any, error?: string}>}
 */
export async function verifyToken(authHeader) {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { verified: false, error: 'Missing or invalid authorization header' };
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user's email is in the allowlist
    const allowedEmails = getAllowedEmails();
    if (!allowedEmails.includes(decodedToken.email)) {
      return { 
        verified: false, 
        error: `Access denied. Email ${decodedToken.email} is not authorized.` 
      };
    }

    return { verified: true, user: decodedToken };
  } catch (error) {
    console.error('Token verification error:', error);
    return { verified: false, error: 'Invalid or expired token' };
  }
}

