const express = require('express');
const controller = require('../controllers/messageController');
const auth = require('../middleware/auth');

const router = express.Router();
router.get('/conversations', auth, controller.listConversations);
router.get('/private/:id', auth, controller.privateHistory);
router.post('/private/:id', auth, controller.sendPrivate);
router.get('/group', auth, controller.groupHistory);
router.post('/group', auth, controller.sendGroup);

module.exports = router;
