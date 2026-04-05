const express = require('express');
const controller = require('../controllers/authController');
const auth = require('../middleware/auth');

const router = express.Router();
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', auth, controller.logout);
router.get('/profile', auth, controller.profile);
router.get('/dashboard', auth, controller.dashboard);

module.exports = router;
