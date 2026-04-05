const pool = require('../config/db');

exports.listConversations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          IF(pm.sender_id = ?, pm.receiver_id, pm.sender_id) AS partnerId,
          MAX(pm.created_at) AS latestTime,
          SUM(CASE WHEN pm.receiver_id = ? AND pm.is_read = 0 THEN 1 ELSE 0 END) AS unreadCount,
          SUBSTRING_INDEX(GROUP_CONCAT(pm.content ORDER BY pm.created_at DESC), ',', 1) AS latestContent,
          MAX(u.nickname) AS nickname,
          MAX(u.avatar) AS avatar
        FROM private_messages pm
        JOIN users u ON u.id = IF(pm.sender_id = ?, pm.receiver_id, pm.sender_id)
        WHERE pm.sender_id = ? OR pm.receiver_id = ?
        GROUP BY partnerId
        ORDER BY latestTime DESC`,
      [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: '获取会话失败', error: error.message });
  }
};

exports.privateHistory = async (req, res) => {
  try {
    const partnerId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT pm.*, u.nickname, u.avatar
       FROM private_messages pm
       JOIN users u ON u.id = pm.sender_id
       WHERE (pm.sender_id = ? AND pm.receiver_id = ?) OR (pm.sender_id = ? AND pm.receiver_id = ?)
       ORDER BY pm.created_at ASC`,
      [req.user.id, partnerId, partnerId, req.user.id]
    );

    await pool.query('UPDATE private_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?', [partnerId, req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: '获取私聊记录失败', error: error.message });
  }
};

exports.sendPrivate = async (req, res) => {
  try {
    const receiverId = Number(req.params.id);
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: '消息不能为空' });
    }
    await pool.query('INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', [req.user.id, receiverId, content]);
    res.json({ message: '发送成功' });
  } catch (error) {
    res.status(500).json({ message: '发送私聊失败', error: error.message });
  }
};

exports.groupHistory = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT gm.*, u.nickname, u.avatar
       FROM group_messages gm
       JOIN users u ON u.id = gm.user_id
       ORDER BY gm.created_at ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: '获取群聊失败', error: error.message });
  }
};

exports.sendGroup = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: '消息不能为空' });
    }
    await pool.query('INSERT INTO group_messages (user_id, content) VALUES (?, ?)', [req.user.id, content]);
    res.json({ message: '发送成功' });
  } catch (error) {
    res.status(500).json({ message: '发送群聊失败', error: error.message });
  }
};
