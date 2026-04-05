const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: '请先登录' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: '登录状态已失效' });
  }
}

module.exports = auth;
