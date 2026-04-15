const pool = require('../db');

// Generate list of available avatar URLs using DiceBear API
exports.getAvailableAvatars = async (req, res) => {
    try {
        // List of predefined seeds for different avatar styles
        const avatarSeeds = [
            'Felix', 'Aneka', 'Zoe', 'Jack', 'Lily', 'Max', 'Emma', 'Oliver',
            'Sophia', 'Liam', 'Ava', 'Noah', 'Isabella', 'William', 'Mia',
            'James', 'Charlotte', 'Benjamin', 'Amelia', 'Lucas', 'Harper',
            'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael', 'Emily',
            'Daniel', 'Elizabeth', 'Matthew', 'Sofia', 'David', 'Ella',
            'Joseph', 'Grace', 'Samuel', 'Victoria', 'Sebastian', 'Chloe',
            'Ryan', 'Penelope', 'Nathan', 'Riley', 'Caleb', 'Aria'
        ];

        // Generate avatar URLs using DiceBear API
        const avatars = avatarSeeds.map(seed => ({
            seed: seed,
            url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`
        }));

        res.json({
            success: true,
            avatars: avatars
        });
    } catch (err) {
        console.error('getAvailableAvatars error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Update user avatar URL
exports.updateUserAvatar = async (req, res) => {
    try {
        const { userId, avatarUrl } = req.body;

        if (!userId || !avatarUrl) {
            return res.status(400).json({ success: false, message: 'Thiếu userId hoặc avatarUrl' });
        }

        // Update user's avatar URL in database
        const updateQuery = `
            UPDATE USERS 
            SET AvatarUrl = $1
            WHERE UserID = $2
        `;

        await pool.query(updateQuery, [avatarUrl, parseInt(userId)]);

        res.json({ 
            success: true, 
            message: 'Cập nhật avatar thành công!',
            avatarUrl: avatarUrl
        });

    } catch (err) {
        console.error('updateUserAvatar error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Get current user avatar
exports.getUserAvatar = async (req, res) => {
    try {
        const userId = parseInt(req.query.userId) || 1;

        const query = `
            SELECT AvatarUrl
            FROM USERS 
            WHERE UserID = $1
        `;

        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const avatarUrl = result.rows[0].avatarurl || result.rows[0].AvatarUrl;

        res.json({
            success: true,
            avatarUrl: avatarUrl
        });

    } catch (err) {
        console.error('getUserAvatar error:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};
