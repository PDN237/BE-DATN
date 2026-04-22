const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');

// Comments APIs
router.get('/:courseId', coursesController.getComments);
router.post('/:courseId', coursesController.addComment);
router.get('/:courseId/top', coursesController.getTopComments);

module.exports = router;
