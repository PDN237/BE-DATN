const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');

// Comments APIs
router.get('/:courseId', coursesController.getComments);
router.post('/:courseId', coursesController.addComment);
router.get('/:courseId/top', coursesController.getTopComments);
router.get('/:courseId/rating-stats', coursesController.getRatingStatistics);
router.get('/:courseId/user', coursesController.getUserComment);
router.put('/:courseId', coursesController.updateComment);

module.exports = router;
