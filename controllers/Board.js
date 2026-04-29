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
                -- Count completed courses (courses where user has 100% progress)
                (SELECT COUNT(DISTINCT c.CourseID)
                 FROM (
                    -- Main query: courses from Enrollments
                    SELECT c.CourseID, c.Title, c.Thumbnail,
                           (SELECT COUNT(*) FROM Lessons l JOIN Modules m ON l.ModuleID = m.ModuleID WHERE m.CourseID = c.CourseID) as totallessons,
                           (SELECT COUNT(*) FROM UserProgress up 
                            JOIN Lessons l ON up.LessonID = l.LessonID 
                            JOIN Modules m ON l.ModuleID = m.ModuleID 
                            WHERE m.CourseID = c.CourseID AND up.UserID = u.UserID AND up.Status = 'completed') as completedlessons
                    FROM Enrollments e
                    JOIN Courses c ON e.CourseID = c.CourseID
                    WHERE e.UserID = u.UserID
                    
                    UNION
                    
                    -- Fallback: courses from UserProgress without Enrollments
                    SELECT c.CourseID, c.Title, c.Thumbnail,
                           (SELECT COUNT(*) FROM Lessons l JOIN Modules m ON l.ModuleID = m.ModuleID WHERE m.CourseID = c.CourseID) as totallessons,
                           (SELECT COUNT(*) FROM UserProgress up2 
                            JOIN Lessons l2 ON up2.LessonID = l2.LessonID 
                            JOIN Modules m2 ON l2.ModuleID = m2.ModuleID 
                            WHERE m2.CourseID = c.CourseID AND up2.UserID = u.UserID AND up2.Status = 'completed') as completedlessons
                    FROM Courses c
                    WHERE EXISTS (
                       SELECT 1 FROM UserProgress up 
                       JOIN Lessons l ON up.LessonID = l.LessonID 
                       JOIN Modules m ON l.ModuleID = m.ModuleID 
                       WHERE m.CourseID = c.CourseID AND up.UserID = u.UserID
                    ) AND NOT EXISTS (
                       SELECT 1 FROM Enrollments e WHERE e.CourseID = c.CourseID AND e.UserID = u.UserID
                    )
                 ) c
                 WHERE c.totallessons > 0 AND c.completedlessons = c.totallessons
                ) as completed_courses
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
            completed_courses: parseInt(row.completed_courses) || 0
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
