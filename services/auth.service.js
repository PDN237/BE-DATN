const pool = require('../db.js');

async function register(fullName, email, password) {
  try {
    // Check if email exists
    const checkQuery = `
      SELECT Email FROM USERS WHERE Email = $1
    `;
    const existingUsers = await pool.query(checkQuery, [email]);
    
    if (existingUsers.rows.length > 0) {
      throw new Error('Email đã được sử dụng');
    }

    // Insert new user (RoleID=3 for student, default avatar, active, score=0)
    const insertQuery = `
      INSERT INTO USERS (FullName, Email, AvatarUrl, IsActive, CreatedAt, UpdatedAt, RoleID, PassWord, score)
      VALUES ($1, $2, 'default-avatar.png', true, NOW(), NOW(), 3, $3, 0)
    `;
    
    await pool.query(insertQuery, [
      fullName,
      email,
      password
    ]);

    console.log(`✅ New user registered: ${email}`);
  } catch (err) {
    console.error('Register service error:', err);
    throw err;
  }
}

async function findByEmail(email) {
  try {
    const query = `
      SELECT UserID, FullName, Email, PassWord, RoleID, AvatarUrl, IsActive 
      FROM USERS 
      WHERE Email = $1 AND IsActive = true
    `;
    const users = await pool.query(query, [email]);
    let user = users.rows[0];
    if (user) {
        user = {
            ...user,
            UserID: user.userid || user.UserID,
            FullName: user.fullname || user.FullName,
            Email: user.email || user.Email,
            PassWord: user.password || user.PassWord,
            RoleID: user.roleid || user.RoleID,
            AvatarUrl: user.avatarurl || user.AvatarUrl,
            IsActive: user.isactive || user.IsActive
        };
    }
    return user || null;
  } catch (err) {
    console.error('Find user error:', err);
    throw err;
  }
}

module.exports = {
  register,
  findByEmail
};
