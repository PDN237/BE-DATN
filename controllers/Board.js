const pool = require('../db');

// Get leaderboard data for students only
exports.getLeaderboard = async (req, res) => {
    try {
        // Get all students (RoleID = 3) with their statistics
        const query = `
            SELECT 
                u.UserID,
                u.FullName,
                u.Email,
                u.AvatarUrl,
                u.score,
                u.title,
                u.RoleID,
                -- Count solved problems
                (SELECT COUNT(DISTINCT s.problem_id)
                 FROM Submissions s
                 WHERE s.UserID = u.UserID AND s.status = 'Accepted') as solved_problems,
                -- Count completed courses (courses where user is enrolled)
                (SELECT COUNT(DISTINCT e.CourseID)
                 FROM Enrollments e
                 WHERE e.UserID = u.UserID) as enrolled_courses
            FROM USERS u
            WHERE u.RoleID = 3
            ORDER BY u.score DESC, solved_problems DESC
        `;

        const result = await pool.query(query);

        // Add rank to each user
        const leaderboard = result.rows.map((row, index) => ({
            rank: index + 1,
            UserID: row.userid || row.UserID,
            FullName: row.fullname || row.FullName,
            Email: row.email || row.Email,
            AvatarUrl: row.avatarurl || row.AvatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
            score: row.score || 0,
            title: row.title || 'Chưa có',
            solved_problems: parseInt(row.solved_problems) || 0,
            completed_courses: parseInt(row.enrolled_courses) || 0
        }));

        res.json({
            success: true,
            leaderboard: leaderboard
        });

    } catch (err) {
        console.error('getLeaderboard error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
