const express = require('express');
const router = express.Router();
const coursesController = require('../controllers/courses.controller');

// Course APIs
router.get('/courses', coursesController.getAllCourses);
router.get('/courses/:id', coursesController.getCourseById);
router.get('/courses/:id/modules-lessons', coursesController.getCourseModulesLessons);
router.get('/lessons/:id', coursesController.getLessonById);
router.get('/quizzes/:lessonId', coursesController.getQuizByLessonId);

// Lesson Progress APIs
router.post('/lesson/complete', coursesController.completeLesson);
router.get('/courses/:courseId/progress', coursesController.getCourseProgress);

// Legacy
router.post('/progress', coursesController.updateProgress);
router.get('/courses/:courseId/statistics', coursesController.getCourseStatistics);
router.get('/user/progress', coursesController.getUserProgress);

module.exports = router;
