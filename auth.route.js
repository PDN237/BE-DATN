const express = require('express');
const router = express.Router();
const authController = require('./controllers/auth.controller');
const LoginController = require('./controllers/Login.js');

router.post('/register', authController.register);
router.post('/login', LoginController.login);

module.exports = router;