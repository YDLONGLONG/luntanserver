const express = require('express');
const controller = require('../controllers/postController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.get('/', controller.list);
router.get('/:id', controller.detail);
router.post('/', auth, upload.array('images', 9), controller.create);
router.put('/:id', auth, upload.array('images', 9), controller.update);
router.delete('/:id', auth, controller.remove);
router.post('/:id/like', auth, controller.toggleLike);
router.post('/:id/favorite', auth, controller.toggleFavorite);
router.post('/:id/comment', auth, controller.comment);
router.delete('/:id/comment/:commentId', auth, controller.deleteComment);

module.exports = router;
