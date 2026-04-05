const express = require('express');
const controller = require('../controllers/followController');
const auth = require('../middleware/auth');

const router = express.Router();
router.get('/following', auth, controller.followingList);
router.get('/fans', auth, controller.fansList);
router.post('/:id/toggle', auth, controller.toggleFollow);

module.exports = router;
