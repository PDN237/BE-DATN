const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/Instructor');
const quizCtrl = require('../controllers/Admin/Quiz');
const questionCtrl = require('../controllers/Admin/Question');
const answerCtrl = require('../controllers/Admin/Answer');

// Course tree + publish
router.get('/course/:courseId', ctrl.getCourseTree);
router.put('/course/:courseId/submit', ctrl.submitForReview);

// Modules
router.post('/modules', ctrl.createModule);
router.put('/modules/:id', ctrl.updateModule);
router.delete('/modules/:id', ctrl.deleteModule);

// Lessons
router.post('/lessons', ctrl.createLesson);
router.get('/lessons/:id', ctrl.getLessonById);
router.put('/lessons/:id', ctrl.updateLesson);
router.delete('/lessons/:id', ctrl.deleteLesson);

// Quizzes (reuse admin controllers, no auth needed for instructor)
router.post('/quizzes', quizCtrl.createQuiz);
router.get('/quizzes/:lessonId', quizCtrl.getQuizzesByLesson);
router.put('/quizzes/:id', quizCtrl.updateQuiz);
router.delete('/quizzes/:id', quizCtrl.deleteQuiz);

// Questions
router.post('/questions', questionCtrl.createQuestion);
router.get('/questions/:quizId', questionCtrl.getQuestionsByQuiz);
router.put('/questions/:id', questionCtrl.updateQuestion);
router.delete('/questions/:id', questionCtrl.deleteQuestion);

// Answers
router.post('/answers', answerCtrl.createAnswer);
router.get('/answers/:questionId', answerCtrl.getAnswersByQuestion);
router.put('/answers/:id', answerCtrl.updateAnswer);
router.delete('/answers/:id', answerCtrl.deleteAnswer);

module.exports = router;
