const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/', controller.getData);

module.exports = router;