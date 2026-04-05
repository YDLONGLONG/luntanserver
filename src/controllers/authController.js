const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { formatUser } = require('../utils/formatters');
const { getCurrentUserStats, getUserDashboard } = require('../services/userService');

exports.register = async (req, res) => {
  try {
    const { username, password, nickname } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ message: '请填写完整信息' });
    }

    const [[existing]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, password, nickname, avatar, bio) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, nickname, '', '欢迎来到知屿论坛']
    );

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: formatUser(user), stats: await getCurrentUserStats(user.id) });
  } catch (error) {
    res.status(500).json({ message: '注册失败', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return res.status(400).json({ message: '用户不存在' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: '密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: formatUser(user), stats: await getCurrentUserStats(user.id) });
  } catch (error) {
    res.status(500).json({ message: '登录失败', error: error.message });
  }
};

exports.profile = async (req, res) => {
  try {
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({ user: formatUser(user), stats: await getCurrentUserStats(user.id) });
  } catch (error) {
    res.status(500).json({ message: '获取个人信息失败', error: error.message });
  }
};

exports.logout = async (_, res) => {
  res.json({ message: '退出成功' });
};

exports.dashboard = async (req, res) => {
  try {
    const data = await getUserDashboard(req.user.id);
    if (!data.user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: '获取个人中心失败', error: error.message });
  }
};
