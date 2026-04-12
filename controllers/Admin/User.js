const pool = require('../../db.js');
const adminAuth = require('../../middleware/admin.middleware');

async function getAllUsers(req, res) {
  try {
    const query = `
      SELECT UserID, FullName, Email, AvatarUrl, IsActive, CreatedAt, RoleID as Role, Describe
      FROM USERS
      ORDER BY CreatedAt DESC
    `;
    const users = await pool.query(query);
    res.json(users.rows.map(u => ({
      ...u,
      UserID: u.userid || u.UserID,
      FullName: u.fullname || u.FullName,
      Email: u.email || u.Email,
      AvatarUrl: u.avatarurl || u.AvatarUrl,
      IsActive: u.isactive !== undefined ? u.isactive : u.IsActive,
      CreatedAt: u.createdat || u.CreatedAt,
      Role: u.role || u.Role,
      Describe: u.describe || u.Describe || ''
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function getUserById(req, res) {
  try {
    const { id } = req.params;
    const query = `
      SELECT *, RoleID as Role
      FROM USERS 
      WHERE UserID = $1
    `;
    const result = await pool.query(query, [parseInt(id)]);
    const users = result.rows;
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const u = users[0];
    res.json({
      ...u,
      UserID: u.userid || u.UserID,
      FullName: u.fullname || u.FullName,
      Email: u.email || u.Email,
      PassWord: u.password || u.PassWord,
      AvatarUrl: u.avatarurl || u.AvatarUrl,
      IsActive: u.isactive !== undefined ? u.isactive : u.IsActive,
      CreatedAt: u.createdat || u.CreatedAt,
      Role: u.role || u.Role,
      Describe: u.describe || u.Describe || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function createUser(req, res) {
  try {
    const { FullName, Email, PassWord, RoleID, IsActive } = req.body;
    if (!FullName || !Email || !PassWord || RoleID === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const checkQuery = `SELECT UserID FROM USERS WHERE Email = $1`;
    const result = await pool.query(checkQuery, [Email]);
    const existing = result.rows;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email exists' });
    }

    const insertQuery = `
      INSERT INTO USERS (FullName, Email, PassWord, RoleID, AvatarUrl, IsActive, CreatedAt, UpdatedAt)
      VALUES ($1, $2, $3, $4, 'default-avatar.png', $5, NOW(), NOW())
      RETURNING UserID
    `;
    const resultInsert = await pool.query(insertQuery, [
      FullName,
      Email,
      PassWord,
      RoleID,
      IsActive ? true : false
    ]);
    const insertResult = resultInsert.rows;
    res.status(201).json({ UserID: insertResult[0].userid || insertResult[0].UserID });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { FullName, Email, PassWord, RoleID, IsActive, Describe } = req.body;

    let updates = ['UpdatedAt = NOW()'];
    const params = [];
    let paramIndex = 1;

    if (FullName !== undefined) {
      updates.push(`FullName = $${paramIndex}`);
      params.push(FullName);
      paramIndex++;
    }
    if (Email !== undefined) {
      updates.push(`Email = $${paramIndex}`);
      params.push(Email);
      paramIndex++;
    }
    if (PassWord !== undefined && PassWord !== '') {
      updates.push(`PassWord = $${paramIndex}`);
      params.push(PassWord);
      paramIndex++;
    }
    if (RoleID !== undefined) {
      updates.push(`RoleID = $${paramIndex}`);
      params.push(parseInt(RoleID));
      paramIndex++;
    }
    if (IsActive !== undefined) {
      updates.push(`IsActive = $${paramIndex}`);
      params.push(IsActive ? true : false);
      paramIndex++;
    }
    if (Describe !== undefined) {
      updates.push(`Describe = $${paramIndex}`);
      params.push(Describe);
      paramIndex++;
    }

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`WHERE UserID = $${paramIndex}`);
    params.push(parseInt(id));

    const query = `UPDATE USERS SET ${updates.slice(0, -1).join(', ')} ${updates.slice(-1)[0]} RETURNING UserID`;

    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found or no changes' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
}

async function deactivateUser(req, res) {
  try {
    const { id } = req.params;
    const query = `UPDATE USERS SET IsActive = false, UpdatedAt = NOW() WHERE UserID = $1 RETURNING UserID`;
    const result = await pool.query(query, [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate' });
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser
};
