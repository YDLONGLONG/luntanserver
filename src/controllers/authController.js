const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { formatUser } = require('../utils/formatters');
const { getCurrentUserStats, getUserDashboard } = require('../services/userService');

exports.register = async (req, res) => {
  try {
    const { username, password, nickname, securityQuestion, securityAnswer } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ message: '请填写完整信息' });
    }

    const [[existing]] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let hashedSecurityAnswer = '';
    if (securityQuestion && securityAnswer) {
      hashedSecurityAnswer = await bcrypt.hash(securityAnswer, 10);
    }

    const [result] = await pool.query(
      'INSERT INTO users (username, password, nickname, avatar, bio, security_question, security_answer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, nickname, '', '欢迎来到知屿论坛', securityQuestion || '', hashedSecurityAnswer]
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

exports.updateProfile = async (req, res) => {
  try {
    const { nickname, bio } = req.body;
    
    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({ message: '昵称不能为空' });
    }
    
    if (nickname.length > 20) {
      return res.status(400).json({ message: '昵称不能超过20个字符' });
    }
    
    if (bio && bio.length > 200) {
      return res.status(400).json({ message: '简介不能超过200个字符' });
    }
    
    await pool.query(
      'UPDATE users SET nickname = ?, bio = ? WHERE id = ?',
      [nickname.trim(), bio ? bio.trim() : '', req.user.id]
    );
    
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: '个人信息已更新', user: formatUser(user), stats: await getCurrentUserStats(user.id) });
  } catch (error) {
    res.status(500).json({ message: '更新个人信息失败', error: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: '请填写完整信息' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '新密码至少6个字符' });
    }
    
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      return res.status(400).json({ message: '原密码错误' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    
    res.json({ message: '密码已修改，请重新登录' });
  } catch (error) {
    res.status(500).json({ message: '修改密码失败', error: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    const { uploadBuffer } = require('../config/cloudinary');
    
    if (!req.file) {
      return res.status(400).json({ message: '请选择要上传的图片' });
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: '只支持 JPG、PNG、GIF、WEBP 格式的图片' });
    }
    
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: '图片大小不能超过 5MB' });
    }
    
    const avatarUrl = await uploadBuffer(req.file.buffer, { 
      originalname: req.file.originalname,
      folder: 'forum-avatars' 
    });
    
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id]);
    
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: '头像上传成功', user: formatUser(user), stats: await getCurrentUserStats(user.id) });
  } catch (error) {
    res.status(500).json({ message: '上传头像失败', error: error.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: '请输入密码确认注销' });
    }
    
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ message: '密码错误' });
    }
    
    await pool.query('DELETE FROM users WHERE id = ?', [req.user.id]);
    
    res.json({ message: '账号已注销' });
  } catch (error) {
    res.status(500).json({ message: '注销账号失败', error: error.message });
  }
};

const securityQuestions = [
  '你童年最好的朋友叫什么名字？',
  '你最喜欢的宠物叫什么名字？',
  '你母亲的名字是什么？',
  '你就读的第一所小学叫什么名字？',
  '你最喜欢的电影是什么？'
];

exports.getSecurityQuestions = async (_, res) => {
  try {
    res.json(securityQuestions);
  } catch (error) {
    res.status(500).json({ message: '获取安全问题失败', error: error.message });
  }
};

exports.getUserSecurityQuestion = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ message: '请输入用户名' });
    }
    
    const [[user]] = await pool.query('SELECT security_question FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    if (!user.security_question) {
      return res.status(400).json({ message: '该用户未设置安全问题' });
    }
    
    res.json({ question: user.security_question });
  } catch (error) {
    res.status(500).json({ message: '获取安全问题失败', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { username, answer, newPassword } = req.body;
    
    if (!username || !answer || !newPassword) {
      return res.status(400).json({ message: '请填写完整信息' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: '新密码至少6个字符' });
    }
    
    const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    if (!user.security_answer) {
      return res.status(400).json({ message: '该用户未设置安全问题' });
    }
    
    const validAnswer = await bcrypt.compare(answer, user.security_answer);
    if (!validAnswer) {
      return res.status(400).json({ message: '安全问题答案错误' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
    
    res.json({ message: '密码重置成功，请使用新密码登录' });
  } catch (error) {
    res.status(500).json({ message: '重置密码失败', error: error.message });
  }
};
