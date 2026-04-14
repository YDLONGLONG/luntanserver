const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', auth, controller.logout);
router.get('/profile', auth, controller.profile);
router.get('/dashboard', auth, controller.dashboard);
router.put('/profile', auth, controller.updateProfile);
router.put('/password', auth, controller.updatePassword);
router.post('/avatar', auth, upload.single('avatar'), controller.uploadAvatar);
router.delete('/account', auth, controller.deleteAccount);
router.get('/security-questions', controller.getSecurityQuestions);
router.get('/security-question', controller.getUserSecurityQuestion);
router.post('/reset-password', controller.resetPassword);
router.get('/my-posts', auth, controller.getMyPosts);
router.get('/my-comments', auth, controller.getMyComments);

module.exports = router;
