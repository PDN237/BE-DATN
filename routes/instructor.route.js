const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/Instructor');

router.get('/course/:courseId', ctrl.getCourseTree);
router.put('/course/:courseId/publish', ctrl.togglePublish);

router.post('/modules', ctrl.createModule);
router.put('/modules/:id', ctrl.updateModule);
router.delete('/modules/:id', ctrl.deleteModule);

router.post('/lessons', ctrl.createLesson);
router.get('/lessons/:id', ctrl.getLessonById);
router.put('/lessons/:id', ctrl.updateLesson);
router.delete('/lessons/:id', ctrl.deleteLesson);

module.exports = router;
