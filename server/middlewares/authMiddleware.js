const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Authentication middleware will not function correctly.');
}

exports.protect = async (req, res, next) => {
  let token;
  console.log(`[${req.requestId}] [AuthMiddleware] protect middleware invoked.`);

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  console.log(`[${req.requestId}] [AuthMiddleware] Token found: ${token ? 'Yes' : 'No'}`);

  if (!token) {
    console.log(`[${req.requestId}] [AuthMiddleware] No token found in authorization header.`);
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }

  try {
    // Ensure JWT_SECRET is available before attempting to verify
    if (!JWT_SECRET) {
      // This check is redundant if the server exits on startup due to missing JWT_SECRET, but good for defense in depth.
      console.error(`[${req.requestId}] [AuthMiddleware] JWT_SECRET not configured.`);
      return res.status(500).json({ success: false, error: 'Authentication configuration error.' });
    }
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`[${req.requestId}] [AuthMiddleware] Token decoded. User ID: ${decoded?.id}`);

    // Get user from the token
    req.user = await User.findById(decoded.id).select('-password'); // Exclude password
    console.log(`[${req.requestId}] [AuthMiddleware] User fetched from DB? ${!!req.user}. User ID: ${decoded?.id}`);

    if (!req.user) {
        console.log(`[${req.requestId}] [AuthMiddleware] User not found for decoded token ID: ${decoded?.id}.`);
        return res.status(401).json({ success: false, error: 'Not authorized, user not found' }); // User not found in DB    
    }
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ success: false, error: `Not authorized, token failed: ${error.message}` }); // Include error message for clarity
  }
};