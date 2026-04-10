const pool = require('../db');

exports.getProfile = async (req, res) => {
    try {
        const userId = parseInt(req.query.userId) || 1; 
        
        // 1. Get basic info
        const userQuery = `
            SELECT UserID, FullName, Email, AvatarUrl, Phone, Location, Gender, BirthYear 
            FROM USERS 
            WHERE UserID = $1
        `;
        const userResult = await pool.query(userQuery, [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        let userRaw = userResult.rows[0];
        const user = userRaw ? {
            ...userRaw,
            UserID: userRaw.userid || userRaw.UserID,
            FullName: userRaw.fullname || userRaw.FullName,
            Email: userRaw.email || userRaw.Email,
            AvatarUrl: userRaw.avatarurl || userRaw.AvatarUrl,
            Phone: userRaw.phone || userRaw.Phone,
            Location: userRaw.location || userRaw.Location,
            Gender: userRaw.gender || userRaw.Gender,
            BirthYear: userRaw.birthyear || userRaw.BirthYear
        } : null;

        // 2. Get problems solved (Count and List)
        const problemsQuery = `
            SELECT p.id, p.title, p.difficulty, MAX(s.created_at) as solvedat
            FROM Submissions s
            JOIN Problems p ON s.problem_id = p.id
            WHERE s.UserID = $1 AND s.status = 'Accepted'
            GROUP BY p.id, p.title, p.difficulty
            ORDER BY solvedat DESC
        `;
        const problemsResult = await pool.query(problemsQuery, [userId]);
        const solvedProblemsList = problemsResult.rows.map(p => ({
            ...p,
            solvedAt: p.solvedat
        }));
        const solvedCount = solvedProblemsList.length;

        // 3. Get enrolled courses
        const coursesQuery = `
            SELECT c.CourseID, c.Title, c.Thumbnail,
                   (SELECT COUNT(*) FROM Lessons l JOIN Modules m ON l.ModuleID = m.ModuleID WHERE m.CourseID = c.CourseID) as totallessons,
                   (SELECT COUNT(*) FROM UserProgress up 
                    JOIN Lessons l ON up.LessonID = l.LessonID 
                    JOIN Modules m ON l.ModuleID = m.ModuleID 
                    WHERE m.CourseID = c.CourseID AND up.UserID = $1 AND up.Status = 'completed') as completedlessons
            FROM Enrollments e
            JOIN Courses c ON e.CourseID = c.CourseID
            WHERE e.UserID = $1

            UNION

            -- Fallback
            SELECT c.CourseID, c.Title, c.Thumbnail,
                   (SELECT COUNT(*) FROM Lessons l JOIN Modules m ON l.ModuleID = m.ModuleID WHERE m.CourseID = c.CourseID) as totallessons,
                   (SELECT COUNT(*) FROM UserProgress up2 
                    JOIN Lessons l2 ON up2.LessonID = l2.LessonID 
                    JOIN Modules m2 ON l2.ModuleID = m2.ModuleID 
                    WHERE m2.CourseID = c.CourseID AND up2.UserID = $1 AND up2.Status = 'completed') as completedlessons
            FROM Courses c
            WHERE EXISTS (
               SELECT 1 FROM UserProgress up 
               JOIN Lessons l ON up.LessonID = l.LessonID 
               JOIN Modules m ON l.ModuleID = m.ModuleID 
               WHERE m.CourseID = c.CourseID AND up.UserID = $1
            ) AND NOT EXISTS (
               SELECT 1 FROM Enrollments e WHERE e.CourseID = c.CourseID AND e.UserID = $1
            )
        `;
        const coursesResult = await pool.query(coursesQuery, [userId]);

        const formattedCourses = coursesResult.rows.map(c => {
            const tl = parseInt(c.totallessons || 0);
            const cl = parseInt(c.completedlessons || 0);
            const progress = tl > 0 ? Math.round((cl / tl) * 100) : 0;
            return {
                id: c.CourseID || c.courseid,
                title: c.Title || c.title,
                thumbnail: c.Thumbnail || c.thumbnail,
                progress: progress,
                status: progress === 100 ? 'completed' : 'learning'
            }
        });

        res.json({
            success: true,
            data: {
                user: user,
                stats: {
                    solvedProblems: solvedCount,
                    completedCourses: formattedCourses.filter(c => c.progress === 100).length
                },
                courses: formattedCourses,
                solvedProblemsList: solvedProblemsList
            }
        });

    } catch (err) {
        console.error('getProfile error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { userId, FullName, Phone, Location, Gender, BirthYear } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const updateQuery = `
            UPDATE USERS 
            SET FullName = COALESCE($1, FullName),
                Phone = COALESCE($2, Phone),
                Location = COALESCE($3, Location),
                Gender = COALESCE($4, Gender),
                BirthYear = COALESCE($5, BirthYear)
            WHERE UserID = $6
        `;

        await pool.query(updateQuery, [
            FullName || null,
            Phone || null,
            Location || null,
            Gender || null,
            BirthYear || null,
            parseInt(userId)
        ]);

        res.json({ success: true, message: 'Cập nhật thành công!' });

    } catch (err) {
        console.error('updateProfile error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
