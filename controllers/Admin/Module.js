const pool = require('../../db.js');

const ModuleController = {
  createModule: async (req, res) => {
    console.log('createModule req.body:', req.body);
    try {
      const title = (req.body.Title || '').trim();
      const courseId = parseInt(req.body.CourseID || req.body.parentId || req.body.courseId);

      if (isNaN(courseId) || !title || title.length === 0) {
        return res.status(400).json({
          error: `Invalid input: CourseID=${courseId}, Title="${title}" (len=${title.length})`,
          body: req.body
        });
      }

      // Always compute next OrderIndex
      const maxOrder = await pool.query(
        'SELECT COALESCE(MAX(OrderIndex), 0) + 1 as nextorder FROM Modules WHERE CourseID = $1',
        [courseId]
      );
      const nextOrderIndex = parseInt(maxOrder.rows[0].nextorder);

      const result = await pool.query(
        `INSERT INTO Modules (CourseID, Title, OrderIndex, CreatedAt)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [
          courseId,
          title,
          nextOrderIndex
        ]
      );

      let m = result.rows[0];
      m = m ? { ...m, ModuleID: m.moduleid || m.ModuleID, CourseID: m.courseid || m.CourseID, Title: m.title || m.Title, OrderIndex: m.orderindex || m.OrderIndex } : null;

      res.status(201).json({
        success: true,
        module: m,
        message: 'Module created successfully'
      });
    } catch (error) {
      console.error('createModule:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getModulesByCourse: async (req, res) => {
    try {
      const { courseId } = req.params;

      const result = await pool.query(
        `SELECT m.ModuleID, m.CourseID, m.Title, m.OrderIndex, 
          COUNT(l.LessonID) as lessoncount
         FROM Modules m 
         LEFT JOIN Lessons l ON m.ModuleID = l.ModuleID
         WHERE m.CourseID = $1
         GROUP BY m.ModuleID, m.CourseID, m.Title, m.OrderIndex
         ORDER BY m.OrderIndex`,
        [parseInt(courseId)]
      );

      // Optionally re-map lowercase lessoncount to lessonCount for frontend compatibility
      const modules = result.rows.map(m => ({
        ...m,
        ModuleID: m.moduleid || m.ModuleID,
        CourseID: m.courseid || m.CourseID,
        Title: m.title || m.Title,
        OrderIndex: m.orderindex || m.OrderIndex,
        lessonCount: parseInt(m.lessoncount)
      }));

      res.json(modules);
    } catch (error) {
      console.error('getModulesByCourse:', error);
      res.status(500).json({ error: error.message });
    }
  },

  updateModule: async (req, res) => {
    try {
      const { id } = req.params;
      const { Title, OrderIndex } = req.body;

      if (!Title) {
        return res.status(400).json({ error: 'Title required' });
      }

      // Check exists
      const exists = await pool.query(
        'SELECT ModuleID FROM Modules WHERE ModuleID = $1',
        [parseInt(id)]
      );
      if (!exists.rows.length) {
        return res.status(404).json({ error: 'Module not found' });
      }

      await pool.query(
        `UPDATE Modules 
         SET Title = $2, OrderIndex = $3, UpdatedAt = NOW()
         WHERE ModuleID = $1`,
        [
          parseInt(id),
          Title,
          parseInt(OrderIndex || 0)
        ]
      );

      res.json({ success: true, message: 'Module updated' });
    } catch (error) {
      console.error('updateModule:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteModule: async (req, res) => {
    try {
      const { id } = req.params;

      // Check dependencies (lessons)
      const deps = await pool.query(
        `SELECT COUNT(l.LessonID) as lessoncount 
         FROM Lessons l 
         WHERE l.ModuleID = $1`,
        [parseInt(id)]
      );

      const count = parseInt(deps.rows[0].lessoncount);
      if (count > 0) {
        return res.status(400).json({
          error: 'Cannot delete module with lessons',
          details: { lessons: count }
        });
      }

      await pool.query(
        'DELETE FROM Modules WHERE ModuleID = $1',
        [parseInt(id)]
      );

      res.json({ success: true, message: 'Module deleted' });
    } catch (error) {
      console.error('deleteModule:', error);
      res.status(500).json({ error: error.message });
    }
  },

  reorderModules: async (req, res) => {
    try {
      const { courseId, order } = req.body; // order: [{moduleId: 1, orderIndex: 0}, ...]

      for (let item of order) {
        await pool.query(
          'UPDATE Modules SET OrderIndex = $2 WHERE ModuleID = $1 AND CourseID = $3',
          [
            parseInt(item.moduleId),
            parseInt(item.orderIndex),
            parseInt(courseId)
          ]
        );
      }

      res.json({ success: true, message: 'Modules reordered' });
    } catch (error) {
      console.error('reorderModules:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ModuleController;
