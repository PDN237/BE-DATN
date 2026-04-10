const express = require('express');
const router = express.Router();
const submitController = require('../controllers/submit.controller');

// POST /api/submit/:problemId - Submit code for a problem
router.post('/:problemId', submitController.submitCode);

// GET /api/submissions/:submissionId - Get submission details
router.get('/:submissionId', submitController.getSubmissionById);

module.exports = router;
