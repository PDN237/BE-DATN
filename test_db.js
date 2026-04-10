const pool = require('./db.js');

async function alterTable() {
    try {
        // Add Phone
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);');
            console.log('Added Phone column');
        } catch(e) { console.log('Phone column may already exist'); }
        
        // Add Location
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);');
            console.log('Added Location column');
        } catch(e) { console.log('Location column may already exist'); }
        
        // Add Gender
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);');
            console.log('Added Gender column');
        } catch(e) { console.log('Gender column may already exist'); }
        
        // Add BirthYear
        try {
            await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS birthyear VARCHAR(10);');
            console.log('Added BirthYear column');
        } catch(e) { console.log('BirthYear column may already exist'); }
        
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

alterTable();
