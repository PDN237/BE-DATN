const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/admin.middleware');
const courseController = require('../controllers/Admin/Course');
const lessonController = require('../controllers/Admin/lesson');
const moduleController = require('../controllers/Admin/Module');
const quizController = require('../controllers/Admin/Quiz');
const questionController = require('../controllers/Admin/Question');
const answerController = require('../controllers/Admin/Answer');

// Courses
router.post('/courses', adminAuth.requireAdmin, courseController.createCourse);
router.get('/courses', adminAuth.requireAdmin, courseController.getAllCourses);
router.get('/courses/:id', adminAuth.requireAdmin, courseController.getCourseById);
router.put('/courses/:id', adminAuth.requireAdmin, courseController.updateCourse);
router.delete('/courses/:id', adminAuth.requireAdmin, courseController.deleteCourse);

// Dashboard
const dashboardController = require('../controllers/Admin/Dashboard');
router.get('/dashboard/stats', adminAuth.requireAdmin, dashboardController.getStats);

// AI Summary
const aiSummaryController = require('../controllers/Admin/AISumary');
router.post('/ai-summary', adminAuth.requireAdmin, aiSummaryController.generateSummary);

// Modules
router.post('/modules', adminAuth.requireAdmin, moduleController.createModule);
router.get('/modules/:courseId', adminAuth.requireAdmin, moduleController.getModulesByCourse);
router.put('/modules/:id', adminAuth.requireAdmin, moduleController.updateModule);
router.delete('/modules/:id', adminAuth.requireAdmin, moduleController.deleteModule);
router.post('/modules/reorder', adminAuth.requireAdmin, moduleController.reorderModules);

// Lessons
router.post('/lessons', adminAuth.requireAdmin, lessonController.createLesson);
router.get('/modules/:moduleId/lessons', adminAuth.requireAdmin, lessonController.getLessonsByModule);
router.get('/lessons/:id', adminAuth.requireAdmin, lessonController.getLessonById);
router.put('/lessons/:id', adminAuth.requireAdmin, lessonController.updateLesson);
router.delete('/lessons/:id', adminAuth.requireAdmin, lessonController.deleteLesson);

// Quizzes
router.post('/quizzes', adminAuth.requireAdmin, quizController.createQuiz);
router.get('/quizzes/:lessonId', adminAuth.requireAdmin, quizController.getQuizzesByLesson);
router.put('/quizzes/:id', adminAuth.requireAdmin, quizController.updateQuiz);
router.delete('/quizzes/:id', adminAuth.requireAdmin, quizController.deleteQuiz);

// Questions
router.post('/questions', adminAuth.requireAdmin, questionController.createQuestion);
router.get('/questions/:quizId', adminAuth.requireAdmin, questionController.getQuestionsByQuiz);
router.put('/questions/:id', adminAuth.requireAdmin, questionController.updateQuestion);
router.delete('/questions/:id', adminAuth.requireAdmin, questionController.deleteQuestion);

// Answers
router.post('/answers', adminAuth.requireAdmin, answerController.createAnswer);
router.get('/answers/:questionId', adminAuth.requireAdmin, answerController.getAnswersByQuestion);
router.put('/answers/:id', adminAuth.requireAdmin, answerController.updateAnswer);
router.delete('/answers/:id', adminAuth.requireAdmin, answerController.deleteAnswer);

// Users
const userController = require('../controllers/Admin/User');
router.get('/users', adminAuth.requireAdmin, userController.getAllUsers);
router.get('/users/:id', adminAuth.requireAdmin, userController.getUserById);
router.post('/users', adminAuth.requireAdmin, userController.createUser);
router.put('/users/:id', adminAuth.requireAdmin, userController.updateUser);
router.patch('/users/:id', adminAuth.requireAdmin, userController.deactivateUser);

// Problems
const problemsController = require('../controllers/Admin/Problems');
router.get('/problems', adminAuth.requireAdmin, problemsController.getAllProblems);
router.get('/problems/:id', adminAuth.requireAdmin, problemsController.getProblemById);
router.post('/problems', adminAuth.requireAdmin, problemsController.createProblem);
router.put('/problems/:id', adminAuth.requireAdmin, problemsController.updateProblem);
router.delete('/problems/:id', adminAuth.requireAdmin, problemsController.deleteProblem);

router.get('/problems/:problemId/testcases', adminAuth.requireAdmin, problemsController.getTestCases);
router.post('/problems/:problemId/testcases', adminAuth.requireAdmin, problemsController.createTestCase);
router.put('/problems/:problemId/testcases/:tcid', adminAuth.requireAdmin, problemsController.updateTestCase);
router.delete('/problems/:problemId/testcases/:tcid', adminAuth.requireAdmin, problemsController.deleteTestCase);
router.post('/problems/:problemId/testcases/:tcid/duplicate', adminAuth.requireAdmin, problemsController.duplicateTestCase);

// Course Builder - Full tree
router.get('/course-builder/:courseId', adminAuth.requireAdmin, courseController.getCourseById);

module.exports = router;
