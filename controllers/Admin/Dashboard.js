const pool = require('../../db.js');

const DashboardController = {
  getStats: async (req, res) => {
    try {
      const [
        courses,
        users,
        problems,
        submissions,
        recentUsers,
        recentSubmissions
      ] = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM Courses'),
        pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID != 1'), // exclude admins
        pool.query('SELECT COUNT(*) as count FROM Problems'),
        pool.query('SELECT COUNT(*) as count FROM Submissions'),
        // Top 5 active/recent users
        pool.query(`
          SELECT UserID, FullName, Email, CreatedAt 
          FROM Users 
          WHERE RoleID != 1
          ORDER BY CreatedAt DESC
          LIMIT 5
        `),
        // Top 5 recent submissons
        pool.query(`
          SELECT s.id, s.status, s.created_at, u.FullName, u.Email, p.title as ProblemTitle
          FROM Submissions s
          LEFT JOIN Users u ON s.userId = u.UserID
          LEFT JOIN Problems p ON s.problem_id = p.id
          ORDER BY s.created_at DESC
          LIMIT 5
        `)
      ]);
      
      res.json({
        stats: {
          totalCourses: parseInt(courses.rows[0].count || 0),
          totalUsers: parseInt(users.rows[0].count || 0),
          totalProblems: parseInt(problems.rows[0].count || 0),
          totalSubmissions: parseInt(submissions.rows[0].count || 0)
        },
        recentUsers: recentUsers.rows.map(r => ({
          ...r,
          UserID: r.userid || r.UserID,
          FullName: r.fullname || r.FullName,
          Email: r.email || r.Email,
          CreatedAt: r.createdat || r.CreatedAt
        })),
        recentSubmissions: recentSubmissions.rows.map(r => ({
          ...r,
          id: r.id,
          status: r.status,
          created_at: r.created_at,
          FullName: r.fullname || r.FullName,
          Email: r.email || r.Email,
          ProblemTitle: r.problemtitle || r.ProblemTitle
        }))
      });
    } catch (error) {
      console.error('Dashboard stats:', error);
      res.status(500).json({ error: 'Stats error' });
    }
  }
};

module.exports = DashboardController;
