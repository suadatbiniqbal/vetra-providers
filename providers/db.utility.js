const mysql = require('mysql2/promise');

const DB_URI = 'mysql://3oSgbi19w7ptfha.root:6xip1hMtn2jFDs1o@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

let pool;

async function getPool() {
    if (pool) return pool;

    const url = new URL(DB_URI);
    pool = mysql.createPool({
        host: url.hostname,
        port: url.port,
        user: url.username,
        password: url.password,
        database: url.pathname.split('/')[1] || 'sys',
        ssl: JSON.parse(url.searchParams.get('ssl')),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    await initDb();
    return pool;
}

async function initDb() {
    const connection = await pool.getConnection();
    try {
        // Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Watch History
        await connection.query(`
            CREATE TABLE IF NOT EXISTS watch_history (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Bookmarks
        await connection.query(`
            CREATE TABLE IF NOT EXISTS bookmarks (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Series Progress
        await connection.query(`
            CREATE TABLE IF NOT EXISTS series_progress (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Media Collections
        await connection.query(`
            CREATE TABLE IF NOT EXISTS media_collections (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Music Playlists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS music_playlists (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Music History
        await connection.query(`
            CREATE TABLE IF NOT EXISTS music_history (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // App Settings
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                user_id INT,
                data JSON,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);



        console.log('[DB] Database tables initialized');
    } finally {
        connection.release();
    }
}

module.exports = { getPool };