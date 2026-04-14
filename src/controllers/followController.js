const pool = require('../config/db');

exports.toggleFollow = async (req, res) => {
  try {
    const targetUserId = Number(req.params.id);
    if (targetUserId === req.user.id) {
      return res.status(400).json({ message: '不能关注自己' });
    }

    const [[existing]] = await pool.query('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetUserId]);
    if (existing) {
      await pool.query('DELETE FROM follows WHERE id = ?', [existing.id]);
      return res.json({ followed: false, message: '已取消关注' });
    }

    await pool.query('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, targetUserId]);
    res.json({ followed: true, message: '关注成功' });
  } catch (error) {
    res.status(500).json({ message: '关注操作失败', error: error.message });
  }
};

exports.followingList = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 10), 20);
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT u.id, u.nickname, u.avatar, u.bio, f.created_at
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?',
      [req.user.id]
    );
    
    res.json({
      list: rows,
      total: Number(countRow.total),
      page,
      limit
    });
  } catch (error) {
    res.status(500).json({ message: '获取关注列表失败', error: error.message });
  }
};

exports.fansList = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 10), 20);
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT u.id, u.nickname, u.avatar, u.bio, f.created_at
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM follows WHERE following_id = ?',
      [req.user.id]
    );
    
    res.json({
      list: rows,
      total: Number(countRow.total),
      page,
      limit
    });
  } catch (error) {
    res.status(500).json({ message: '获取粉丝列表失败', error: error.message });
  }
};
