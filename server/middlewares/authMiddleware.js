const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables. Authentication middleware will not function correctly.');
}

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }

  try {
    // Ensure JWT_SECRET is available before attempting to verify
    if (!JWT_SECRET) {
      // This check is redundant if the server exits on startup due to missing JWT_SECRET, but good for defense in depth.
      return res.status(500).json({ success: false, error: 'Authentication configuration error.' });
    }
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from the token
    req.user = await User.findById(decoded.id).select('-password'); // Exclude password

    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
    }
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
  }
};