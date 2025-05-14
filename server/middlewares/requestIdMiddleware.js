const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  // Generate a unique ID for each incoming request
  const requestId = uuidv4();
  // Attach it to the request object
  req.requestId = requestId;
  next(); // Move to the next middleware or route handler
};

module.exports = requestIdMiddleware;