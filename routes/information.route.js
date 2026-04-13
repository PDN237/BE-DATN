const express = require('express');
const router = express.Router();
const informationController = require('../controllers/Information');

// Information API - Get instructor profile and courses
router.get('/:id', informationController.getInstructorById);

module.exports = router;
