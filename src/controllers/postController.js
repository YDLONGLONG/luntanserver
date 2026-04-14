const pool = require('../config/db');
const { uploadBuffer } = require('../config/cloudinary');
const { getCommentSchemaSupport } = require('../services/userService');

function parseImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try {
    return JSON.parse(images);
  } catch (error) {
    return [];
  }
}

function normalizeImageUrl(image) {
  if (!image) return '';
  if (/^https?:\/\//.test(image)) return image;
  return image;
}

async function uploadImages(files) {
  return Promise.all((files || []).map((file) => uploadBuffer(file.buffer, { originalname: file.originalname })));
}

async function buildPostItem(row, currentUserId) {
  const images = parseImages(row.images).map(normalizeImageUrl).filter(Boolean);
  const [[likedRow]] = currentUserId
    ? await pool.query('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [currentUserId, row.id])
    : [[null]];
  const [[favoritedRow]] = currentUserId
    ? await pool.query('SELECT id FROM favorites WHERE user_id = ? AND post_id = ?', [currentUserId, row.id])
    : [[null]];
  const [[followedRow]] = currentUserId && Number(currentUserId) !== Number(row.user_id)
    ? await pool.query('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [currentUserId, row.user_id])
    : [[null]];

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    images,
    views: Number(row.views || 0),
    createdAt: row.created_at,
    canManage: Number(currentUserId) === Number(row.user_id),
    author: {
      id: row.user_id,
      nickname: row.nickname,
      avatar: row.avatar,
      bio: row.bio
    },
    likeCount: Number(row.likeCount || 0),
    favoriteCount: Number(row.favoriteCount || 0),
    commentCount: Number(row.commentCount || 0),
    liked: !!likedRow,
    favorited: !!favoritedRow,
    followed: !!followedRow
  };
}

async function ensureOwnPost(postId, userId) {
  const [[post]] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) {
    return { code: 404, message: '帖子不存在' };
  }
  if (Number(post.user_id) !== Number(userId)) {
    return { code: 403, message: '只能操作自己的帖子' };
  }
  return { post };
}

exports.list = async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const currentUserId = Number(req.query.currentUserId || 0);
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Number(req.query.limit || 10), 20);
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      `SELECT p.*, u.nickname, u.avatar, u.bio,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favoriteCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.title LIKE ? OR p.content LIKE ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [`%${keyword}%`, `%${keyword}%`, limit, offset]
    );

    const data = await Promise.all(rows.map((row) => buildPostItem(row, currentUserId)));
    res.json({ list: data, page, limit, hasMore: data.length === limit });
  } catch (error) {
    res.status(500).json({ message: '获取帖子失败', error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }
    const images = await uploadImages(req.files || []);
    const [result] = await pool.query(
      'INSERT INTO posts (user_id, title, content, images) VALUES (?, ?, ?, ?)',
      [req.user.id, title, content, JSON.stringify(images)]
    );
    res.json({ id: result.insertId, message: '发布成功' });
  } catch (error) {
    res.status(500).json({ message: '发布帖子失败', error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const checked = await ensureOwnPost(req.params.id, req.user.id);
    if (!checked.post) {
      return res.status(checked.code).json({ message: checked.message });
    }

    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' });
    }

    let keptImages = [];
    if (req.body.existingImages) {
      try {
        const parsed = JSON.parse(req.body.existingImages);
        if (Array.isArray(parsed)) {
          keptImages = parsed.map(normalizeImageUrl).filter(Boolean);
        }
      } catch (error) {
        keptImages = [];
      }
    } else {
      keptImages = parseImages(checked.post.images).map(normalizeImageUrl).filter(Boolean);
    }

    const newImages = await uploadImages(req.files || []);
    const images = [...keptImages, ...newImages].slice(0, 9);

    await pool.query('UPDATE posts SET title = ?, content = ?, images = ? WHERE id = ?', [title, content, JSON.stringify(images), req.params.id]);
    res.json({ message: '帖子已更新' });
  } catch (error) {
    res.status(500).json({ message: '更新帖子失败', error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const checked = await ensureOwnPost(req.params.id, req.user.id);
    if (!checked.post) {
      return res.status(checked.code).json({ message: checked.message });
    }

    await pool.query('DELETE FROM likes WHERE post_id = ?', [req.params.id]);
    await pool.query('DELETE FROM favorites WHERE post_id = ?', [req.params.id]);
    await pool.query('DELETE FROM comments WHERE post_id = ?', [req.params.id]);
    await pool.query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: '帖子已删除' });
  } catch (error) {
    res.status(500).json({ message: '删除帖子失败', error: error.message });
  }
};

exports.detail = async (req, res) => {
  try {
    const schema = await getCommentSchemaSupport();
    const currentUserId = Number(req.query.currentUserId || 0);
    const [[row]] = await pool.query(
      `SELECT p.*, u.nickname, u.avatar, u.bio,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favoriteCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ message: '帖子不存在' });
    }

    let comments = [];
    if (schema.hasReplyToUserId && schema.hasParentId) {
      [comments] = await pool.query(
        `SELECT c.*, u.nickname, u.avatar, ru.nickname AS replyToNickname,
                pc.content AS parentContent, pu.nickname AS parentNickname
         FROM comments c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN users ru ON ru.id = c.reply_to_user_id
         LEFT JOIN comments pc ON pc.id = c.parent_id
         LEFT JOIN users pu ON pu.id = pc.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
        [req.params.id]
      );
    } else {
      [comments] = await pool.query(
        `SELECT c.*, u.nickname, u.avatar
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`,
        [req.params.id]
      );
    }

    res.json({
      post: await buildPostItem(row, currentUserId),
      comments: comments.map((item) => ({
        id: item.id,
        content: item.content,
        createdAt: item.created_at,
        parentId: schema.hasParentId ? item.parent_id : null,
        parentContent: schema.hasParentId ? item.parentContent : null,
        parentNickname: schema.hasParentId ? item.parentNickname : null,
        replyToUserId: schema.hasReplyToUserId ? item.reply_to_user_id : null,
        replyToNickname: schema.hasReplyToUserId ? item.replyToNickname : null,
        canDelete: Number(item.user_id) === Number(currentUserId),
        user: {
          id: item.user_id,
          nickname: item.nickname,
          avatar: item.avatar
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ message: '获取详情失败', error: error.message });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const [[existing]] = await pool.query('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, req.params.id]);
    if (existing) {
      await pool.query('DELETE FROM likes WHERE id = ?', [existing.id]);
      return res.json({ liked: false, message: '已取消点赞' });
    }
    await pool.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.user.id, req.params.id]);
    res.json({ liked: true, message: '点赞成功' });
  } catch (error) {
    res.status(500).json({ message: '操作失败', error: error.message });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const [[existing]] = await pool.query('SELECT id FROM favorites WHERE user_id = ? AND post_id = ?', [req.user.id, req.params.id]);
    if (existing) {
      await pool.query('DELETE FROM favorites WHERE id = ?', [existing.id]);
      return res.json({ favorited: false, message: '已取消收藏' });
    }
    await pool.query('INSERT INTO favorites (user_id, post_id) VALUES (?, ?)', [req.user.id, req.params.id]);
    res.json({ favorited: true, message: '收藏成功' });
  } catch (error) {
    res.status(500).json({ message: '操作失败', error: error.message });
  }
};

exports.comment = async (req, res) => {
  try {
    const schema = await getCommentSchemaSupport();
    const { content, parentId, replyToUserId } = req.body;
    if (!content) {
      return res.status(400).json({ message: '评论内容不能为空' });
    }

    if (schema.hasParentId && schema.hasReplyToUserId) {
      await pool.query(
        'INSERT INTO comments (post_id, user_id, content, parent_id, reply_to_user_id) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, req.user.id, content, parentId || null, replyToUserId || null]
      );
      return res.json({ message: parentId ? '回复成功' : '评论成功' });
    }

    await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [req.params.id, req.user.id, content]);
    res.json({ message: '评论成功，请升级数据库后使用回复功能' });
  } catch (error) {
    res.status(500).json({ message: '评论失败', error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const schema = await getCommentSchemaSupport();
    const [[comment]] = await pool.query('SELECT id, user_id FROM comments WHERE id = ?', [req.params.commentId]);
    if (!comment) {
      return res.status(404).json({ message: '评论不存在' });
    }
    if (Number(comment.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: '只能删除自己的评论' });
    }
    if (schema.hasParentId) {
      await pool.query('DELETE FROM comments WHERE parent_id = ?', [req.params.commentId]);
    }
    await pool.query('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
    res.json({ message: '评论已删除' });
  } catch (error) {
    res.status(500).json({ message: '删除评论失败', error: error.message });
  }
};

exports.incrementViews = async (req, res) => {
  try {
    await pool.query('UPDATE posts SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ message: '浏览量+1' });
  } catch (error) {
    res.status(500).json({ message: '更新浏览量失败', error: error.message });
  }
};

exports.getRecommended = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 5), 10);
    const currentUserId = Number(req.query.currentUserId || 0);
    
    const [rows] = await pool.query(
      `SELECT p.*, u.nickname, u.avatar, u.bio,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likeCount,
        (SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id) AS favoriteCount,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS commentCount
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.views DESC, p.created_at DESC
      LIMIT ?`,
      [limit]
    );

    const data = await Promise.all(rows.map((row) => buildPostItem(row, currentUserId)));
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: '获取推荐帖子失败', error: error.message });
  }
};
