const API_KEY = process.env.API_KEY || '';

export const authMiddleware = (req, res, next) => {
  // Skip auth if no API key is set
  if (!API_KEY) return next();

  // Check for API key in headers
  const key = req.header('x-api-key');

  if (key && key === API_KEY) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Valid API key required',
  });
};
