const pool = require('../../db.js');

const DashboardController = {
  getStats: async (req, res) => {
    try {
      // Start with basic counts - add simple queries one by one
      const [
        courses,
        users,
        problems,
        submissions,
        enrollments,
        recentUsers
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM Courses'),
        pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID != 1'),
        pool.query('SELECT COUNT(*) as count FROM Problems'),
        pool.query('SELECT COUNT(*) as count FROM Submissions'),
        pool.query('SELECT COUNT(*) as count FROM Enrollments'),
        // Add recent users first
        pool.query(`
          SELECT UserID, FullName, Email, CreatedAt 
          FROM Users 
          WHERE RoleID != 1
          ORDER BY CreatedAt DESC
          LIMIT 5
        `)
      ]);
      
      res.json({
        stats: {
          totalCourses: parseInt(courses.rows[0].count || 0),
          totalUsers: parseInt(users.rows[0].count || 0),
          totalProblems: parseInt(problems.rows[0].count || 0),
          totalSubmissions: parseInt(submissions.rows[0].count || 0),
          totalEnrollments: parseInt(enrollments.rows[0].count || 0),
          activeUsers: 0,
          completionRate: 0,
          acceptanceRate: 0
        },
        recentUsers: recentUsers.rows.map(r => ({
          UserID: r.UserID,
          FullName: r.FullName,
          Email: r.Email,
          CreatedAt: r.CreatedAt
        })),
        recentSubmissions: [],
        courseCompletions: [],
        problemDifficulty: [],
        topCourses: [],
        submissionStats: []
      });
    } catch (error) {
      console.error('Dashboard stats error:', error.message);
      console.error('Error details:', error);
      res.status(500).json({ error: 'Stats error', message: error.message });
    }
  }
};

module.exports = DashboardController;
