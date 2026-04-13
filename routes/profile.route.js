const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile');

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);

// My Courses — courses created by logged-in user
router.get('/my-courses', profileController.getMyCourses);
router.post('/my-courses', profileController.createMyCourse);
router.put('/my-courses/:id', profileController.updateMyCourse);
router.delete('/my-courses/:id', profileController.deleteMyCourse);

module.exports = router;
