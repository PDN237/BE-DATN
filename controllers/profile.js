const pool = require('../db');

// Helper function to calculate title based on score
function calculateTitle(score) {
    if (score >= 10000) return 'Kim Cương';
    if (score >= 5000) return 'Bạch Kim';
    if (score >= 3000) return 'Vàng';
    if (score >= 1500) return 'Bạc';
    if (score >= 500) return 'Đồng';
    return 'Chưa có';
}

// Helper function to update user title based on current score
async function updateUserTitle(userId) {
    try {
        const result = await pool.query(
            'SELECT score FROM USERS WHERE UserID = $1',
            [parseInt(userId)]
        );
        
        if (result.rows.length === 0) return null;
        
        const currentScore = result.rows[0].score || 0;
        const newTitle = calculateTitle(currentScore);
        
        await pool.query(
            'UPDATE USERS SET title = $1 WHERE UserID = $2',
            [newTitle, parseInt(userId)]
        );
        
        return newTitle;
    } catch (err) {
        console.error('updateUserTitle error:', err);
        return null;
    }
}

exports.getProfile = async (req, res) => {
    try {
        const userId = parseInt(req.query.userId) || 1;

        // 1. Recalculate title based on current score
        await updateUserTitle(userId);

        // 2. Get basic info
        const userQuery = `
            SELECT UserID, FullName, Email, AvatarUrl, Phone, Location, Gender, BirthYear, Describe, RoleID, score, title
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
            BirthYear: userRaw.birthyear || userRaw.BirthYear,
            Describe: userRaw.describe || userRaw.Describe || '',
            RoleID: userRaw.roleid || userRaw.RoleID,
            score: userRaw.score,
            title: userRaw.title
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
                    WHERE m.CourseID = c.CourseID AND up.UserID = $1 AND up.Status = 'completed') as completedlessons,
                   c.score
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
                    WHERE m2.CourseID = c.CourseID AND up2.UserID = $1 AND up2.Status = 'completed') as completedlessons,
                   c.score
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
                status: progress === 100 ? 'completed' : 'learning',
                score: c.score
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
        const { userId, FullName, Phone, Location, Gender, BirthYear, Describe, score, title } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const updateQuery = `
            UPDATE USERS 
            SET FullName = COALESCE($1, FullName),
                Phone = COALESCE($2, Phone),
                Location = COALESCE($3, Location),
                Gender = COALESCE($4, Gender),
                BirthYear = COALESCE($5, BirthYear),
                Describe = COALESCE($6, Describe),
                score = COALESCE($7, score),
                title = COALESCE($8, title)
            WHERE UserID = $9
        `;

        await pool.query(updateQuery, [
            FullName || null,
            Phone || null,
            Location || null,
            Gender || null,
            BirthYear || null,
            Describe !== undefined ? Describe : null,
            score !== undefined ? parseInt(score) : null,
            title !== undefined ? title : null,
            parseInt(userId)
        ]);

        res.json({ success: true, message: 'Cập nhật thành công!' });

    } catch (err) {
        console.error('updateProfile error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// ================================================================
// MY COURSES — Courses created by this user (userid column)
// ================================================================

// GET /api/profile/my-courses?userId=X
exports.getMyCourses = async (req, res) => {
    try {
        const userId = parseInt(req.query.userId) || 1;
        console.log(`📚 getMyCourses: userId=${userId}`);

        const result = await pool.query(
            `SELECT c.courseid, c.title, c.description, c.level, c.thumbnail, c.createdat, c.iscompleted,
                    c.accept, c.feedback, c.score
             FROM Courses c
             WHERE c.userid = $1
             ORDER BY c.createdat DESC`,
            [userId]
        );

        console.log(`✅ getMyCourses: found ${result.rows.length} courses`);

        const courses = (result.rows || []).map(row => ({
            CourseID: row.courseid,
            Title: row.title,
            Description: row.description,
            Level: row.level,
            Thumbnail: row.thumbnail,
            CreatedAt: row.createdat,
            IsCompleted: row.iscompleted || false,
            Accept: row.accept || false,
            Feedback: row.feedback || '',
            score: row.score,
            moduleCount: parseInt(row.modulecount || 0)
        }));

        res.json({ success: true, courses });
    } catch (err) {
        console.error('❌ getMyCourses error:', err.message, err.stack);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// POST /api/profile/my-courses
exports.createMyCourse = async (req, res) => {
    try {
        const { userId, Title, Description, Level, Thumbnail, score } = req.body;
        console.log(`📝 createMyCourse: userId=${userId}, title='${Title}'`);

        if (!userId || !Title || !Description) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (userId, Title, Description)' });
        }

        const result = await pool.query(
            `INSERT INTO Courses (title, description, level, thumbnail, createdat, iscompleted, accept, userid, score)
             VALUES ($1, $2, $3, $4, NOW(), false, false, $5::integer, $6) RETURNING *`,
            [
                Title,
                Description,
                Level || 'Cơ bản',
                Thumbnail || '',
                parseInt(userId),
                score !== undefined ? parseInt(score) : 0
            ]
        );

        let c = result.rows[0];
        console.log(`✅ createMyCourse: created course`, c);
        if (c) {
            c = {
                CourseID: c.courseid,
                Title: c.title,
                Description: c.description,
                Level: c.level,
                Thumbnail: c.thumbnail,
                CreatedAt: c.createdat,
                IsCompleted: c.iscompleted,
                Accept: c.accept,
                score: c.score
            };
        }

        res.status(201).json({ success: true, course: c, message: 'Tạo khóa học thành công!' });
    } catch (err) {
        console.error('❌ createMyCourse error:', err.message, err.stack);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// PUT /api/profile/my-courses/:id
exports.updateMyCourse = async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        const { userId, Title, Description, Level, Thumbnail, score } = req.body;

        if (!userId || !Title || !Description) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }

        // Verify ownership
        const checkOwner = await pool.query(
            'SELECT CourseID FROM Courses WHERE CourseID = $1 AND userid = $2',
            [courseId, parseInt(userId)]
        );
        if (!checkOwner.rows.length) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa khóa học này' });
        }

        await pool.query(
            `UPDATE Courses 
             SET Title = $1, Description = $2, Level = $3, Thumbnail = $4, score = $5
             WHERE CourseID = $6 AND userid = $7`,
            [Title, Description, Level || 'Cơ bản', Thumbnail || '', score !== undefined ? parseInt(score) : 0, courseId, parseInt(userId)]
        );

        res.json({ success: true, message: 'Cập nhật khóa học thành công!' });
    } catch (err) {
        console.error('updateMyCourse error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// DELETE /api/profile/my-courses/:id
exports.deleteMyCourse = async (req, res) => {
    try {
        const courseId = parseInt(req.params.id);
        const userId = parseInt(req.query.userId) || parseInt(req.body.userId);

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId' });
        }

        // Verify ownership
        const checkOwner = await pool.query(
            'SELECT CourseID FROM Courses WHERE CourseID = $1 AND userid = $2',
            [courseId, userId]
        );
        if (!checkOwner.rows.length) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa khóa học này' });
        }

        // Check if course has modules
        const modulesCheck = await pool.query(
            'SELECT COUNT(*) as count FROM Modules WHERE CourseID = $1',
            [courseId]
        );
        if (parseInt(modulesCheck.rows[0]?.count || 0) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa khóa học đã có module. Hãy xóa các module trước.'
            });
        }

        await pool.query('DELETE FROM Courses WHERE CourseID = $1 AND userid = $2', [courseId, userId]);

        res.json({ success: true, message: 'Xóa khóa học thành công!' });
    } catch (err) {
        console.error('deleteMyCourse error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// ================================================================
// UPDATE USER SCORE WHEN LESSON IS COMPLETED
// ================================================================

exports.updateUserScore = async (req, res) => {
    try {
        const { userId, lessonId } = req.body;

        if (!userId || !lessonId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId hoặc lessonId' });
        }

        // Get lesson score
        const lessonResult = await pool.query(
            'SELECT score FROM Lessons WHERE LessonID = $1',
            [parseInt(lessonId)]
        );

        if (lessonResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        const lessonScore = lessonResult.rows[0].score || 0;

        if (lessonScore === 0) {
            return res.json({ success: true, message: 'Lesson không có điểm', pointsEarned: 0 });
        }

        // Update user score
        await pool.query(
            'UPDATE USERS SET score = COALESCE(score, 0) + $1 WHERE UserID = $2',
            [lessonScore, parseInt(userId)]
        );

        // Auto-update title based on new score
        const newTitle = await updateUserTitle(userId);

        // Get updated score for response
        const scoreResult = await pool.query(
            'SELECT score FROM USERS WHERE UserID = $1',
            [parseInt(userId)]
        );
        const currentScore = scoreResult.rows[0]?.score || 0;

        res.json({
            success: true,
            message: 'Cập nhật điểm thành công!',
            pointsEarned: lessonScore,
            newScore: currentScore,
            newTitle: newTitle
        });

    } catch (err) {
        console.error('updateUserScore error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// ================================================================
// ADD COURSE POINTS WHEN COURSE IS COMPLETED
// ================================================================

exports.addCoursePoints = async (req, res) => {
    try {
        const { userId, courseId } = req.body;

        if (!userId || !courseId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId hoặc courseId' });
        }

        // Get course score
        const courseResult = await pool.query(
            'SELECT score FROM Courses WHERE CourseID = $1',
            [parseInt(courseId)]
        );

        if (courseResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const courseScore = courseResult.rows[0].score || 0;

        if (courseScore === 0) {
            return res.json({ success: true, message: 'Khóa học không có điểm', pointsEarned: 0 });
        }

        // Update user score
        await pool.query(
            'UPDATE USERS SET score = COALESCE(score, 0) + $1 WHERE UserID = $2',
            [courseScore, parseInt(userId)]
        );

        // Auto-update title based on new score
        const newTitle = await updateUserTitle(userId);

        // Get updated score for response
        const scoreResult = await pool.query(
            'SELECT score FROM USERS WHERE UserID = $1',
            [parseInt(userId)]
        );
        const currentScore = scoreResult.rows[0]?.score || 0;

        res.json({
            success: true,
            message: 'Cộng điểm khóa học thành công!',
            pointsEarned: courseScore,
            newScore: currentScore,
            newTitle: newTitle
        });

    } catch (err) {
        console.error('addCoursePoints error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// ================================================================
// ADD PROBLEM POINTS WHEN PROBLEM IS SOLVED
// ================================================================

exports.addProblemPoints = async (req, res) => {
    try {
        const { userId, problemId } = req.body;

        if (!userId || !problemId) {
            return res.status(400).json({ success: false, message: 'Thiếu userId hoặc problemId' });
        }

        // Get problem score
        const problemResult = await pool.query(
            'SELECT score FROM Problems WHERE id = $1',
            [parseInt(problemId)]
        );

        if (problemResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        const problemScore = problemResult.rows[0].score || 0;

        if (problemScore === 0) {
            return res.json({ success: true, message: 'Problem không có điểm', pointsEarned: 0 });
        }

        // Check if user already solved this problem (has an accepted submission)
        const checkResult = await pool.query(
            'SELECT 1 FROM Submissions WHERE userId = $1 AND problem_id = $2 AND status = $3',
            [parseInt(userId), parseInt(problemId), 'Accepted']
        );

        // If this is not the first accepted submission, don't award points again
        if (checkResult.rows.length > 1) {
            return res.json({ success: true, message: 'Đã nhận điểm cho problem này', pointsEarned: 0, alreadySolved: true });
        }

        // Update user score
        await pool.query(
            'UPDATE USERS SET score = COALESCE(score, 0) + $1 WHERE UserID = $2',
            [problemScore, parseInt(userId)]
        );

        // Auto-update title based on new score
        const newTitle = await updateUserTitle(userId);

        // Get updated score for response
        const scoreResult = await pool.query(
            'SELECT score FROM USERS WHERE UserID = $1',
            [parseInt(userId)]
        );
        const currentScore = scoreResult.rows[0]?.score || 0;

        res.json({
            success: true,
            message: 'Cộng điểm problem thành công!',
            pointsEarned: problemScore,
            newScore: currentScore,
            newTitle: newTitle
        });

    } catch (err) {
        console.error('addProblemPoints error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
