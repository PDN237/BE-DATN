const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile');
const avatarController = require('../controllers/avatar');
const boardController = require('../controllers/Board');

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);

// My Courses — courses created by logged-in user
router.get('/my-courses', profileController.getMyCourses);
router.post('/my-courses', profileController.createMyCourse);
router.put('/my-courses/:id', profileController.updateMyCourse);
router.delete('/my-courses/:id', profileController.deleteMyCourse);

// Update user score when lesson is completed
router.post('/update-score', profileController.updateUserScore);

// Add course points when course is completed
router.post('/add-course-points', profileController.addCoursePoints);

// Add problem points when problem is solved
router.post('/add-problem-points', profileController.addProblemPoints);

// Avatar routes
router.get('/avatar/available', avatarController.getAvailableAvatars);
router.get('/avatar', avatarController.getUserAvatar);
router.put('/avatar', avatarController.updateUserAvatar);

// Leaderboard route
router.get('/leaderboard', boardController.getLeaderboard);

module.exports = router;
