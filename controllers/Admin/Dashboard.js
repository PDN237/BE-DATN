const pool = require('../../db.js');

const DashboardController = {
  getStats: async (req, res) => {
    try {
      // Run queries sequentially to avoid crashes
      const courses = await pool.query('SELECT COUNT(*) as count FROM Courses');
      const users = await pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID != 1');
      const problems = await pool.query('SELECT COUNT(*) as count FROM Problems');
      const submissions = await pool.query('SELECT COUNT(*) as count FROM Submissions');
      const enrollments = await pool.query('SELECT COUNT(*) as count FROM Enrollments');
      
      // Top 5 recent users
      const recentUsers = await pool.query(`
        SELECT UserID, FullName, Email, CreatedAt 
        FROM Users 
        WHERE RoleID != 1
        ORDER BY CreatedAt DESC
        LIMIT 5
      `);
      
      // Top 5 recent submissions
      const recentSubmissions = await pool.query(`
        SELECT s.id, s.status, s.created_at, u.FullName, u.Email, p.title as ProblemTitle
        FROM Submissions s
        LEFT JOIN Users u ON s.userId = u.UserID
        LEFT JOIN Problems p ON s.problem_id = p.id
        ORDER BY s.created_at DESC
        LIMIT 5
      `);

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
        recentSubmissions: recentSubmissions.rows.map(r => ({
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          FullName: r.FullName,
          Email: r.Email,
          ProblemTitle: r.ProblemTitle
        })),
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
