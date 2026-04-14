const pool = require('../config/db');
const { formatUser } = require('../utils/formatters');

let commentSchemaSupport = null;

async function getCommentSchemaSupport() {
  if (commentSchemaSupport) {
    return commentSchemaSupport;
  }

  const [columns] = await pool.query('SHOW COLUMNS FROM comments');
  const fields = columns.map((item) => item.Field);
  commentSchemaSupport = {
    hasParentId: fields.includes('parent_id'),
    hasReplyToUserId: fields.includes('reply_to_user_id')
  };
  return commentSchemaSupport;
}

async function getCurrentUserStats(userId) {
  const [[followRow]] = await pool.query('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?', [userId]);
  const [[fansRow]] = await pool.query('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?', [userId]);
  const [[postRow]] = await pool.query('SELECT COUNT(*) AS count FROM posts WHERE user_id = ?', [userId]);
  return {
    follows: Number(followRow.count || 0),
    fans: Number(fansRow.count || 0),
    posts: Number(postRow.count || 0)
  };
}

async function getUserDashboard(userId) {
  const schema = await getCommentSchemaSupport();
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);

  return {
    user: user ? formatUser(user) : null,
    stats: await getCurrentUserStats(userId)
  };
}

async function getUserPosts(userId, page = 1, limit = 10) {
  const offset = (page - 1) * limit;
  const [posts] = await pool.query(
    `SELECT p.id, p.title, p.content, p.created_at,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,
      (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favoriteCount
     FROM posts p
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const [[countRow]] = await pool.query(
    'SELECT COUNT(*) AS total FROM posts WHERE user_id = ?',
    [userId]
  );

  return {
    list: posts.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      createdAt: item.created_at,
      commentCount: Number(item.commentCount || 0),
      likeCount: Number(item.likeCount || 0),
      favoriteCount: Number(item.favoriteCount || 0)
    })),
    total: Number(countRow.total),
    page,
    limit
  };
}

async function getUserComments(userId, page = 1, limit = 10) {
  const schema = await getCommentSchemaSupport();
  const offset = (page - 1) * limit;

  let comments = [];
  let countRow = { total: 0 };

  if (schema.hasReplyToUserId && schema.hasParentId) {
    [comments] = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.post_id, c.parent_id, c.reply_to_user_id,
        p.title AS postTitle, ru.nickname AS replyToNickname
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       LEFT JOIN users ru ON ru.id = c.reply_to_user_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM comments WHERE user_id = ?',
      [userId]
    );
  } else {
    [comments] = await pool.query(
      `SELECT c.id, c.content, c.created_at, c.post_id, p.title AS postTitle
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM comments WHERE user_id = ?',
      [userId]
    );
  }

  return {
    list: comments.map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.created_at,
      postId: item.post_id,
      postTitle: item.postTitle,
      parentId: schema.hasParentId ? item.parent_id : null,
      replyToUserId: schema.hasReplyToUserId ? item.reply_to_user_id : null,
      replyToNickname: schema.hasReplyToUserId ? item.replyToNickname : null
    })),
    total: Number(countRow.total),
    page,
    limit
  };
}

module.exports = { getCurrentUserStats, getUserDashboard, getUserPosts, getUserComments, getCommentSchemaSupport };
