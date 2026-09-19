const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = rows[0];
        if (user.is_active === 0) {
            return res.status(403).json({ success: false, error: 'Account deactivated' });
        }
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET || 'supersecret123',
                { expiresIn: '1h' }
            );
            return res.json({ success: true, token });
        }

        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            return res.status(403).json({ success: false, error: message });
        }
        req.user = decoded;
        next();
    });
};

router.put('/change-password', authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });

        const user = rows[0];
        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Incorrect current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Get list of all users
router.get('/users', authenticate, async (req, res) => {
    try {
        // We will fetch is_active if it exists, otherwise just the others. 
        // We use a safe query that works even if is_active is added later.
        const [rows] = await db.execute('SELECT id, username, role, created_at FROM users');
        
        // Let's try to see if is_active exists by catching an error
        let usersWithActive = rows;
        try {
            const [rowsWithActive] = await db.execute('SELECT id, username, role, created_at, is_active FROM users');
            usersWithActive = rowsWithActive;
        } catch (e) {
            // is_active column probably doesn't exist yet, ignore
            usersWithActive = rows.map(u => ({...u, is_active: 1}));
        }

        res.json({ success: true, users: usersWithActive });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Create new user
router.post('/users', authenticate, async (req, res) => {
    // Only admins should do this, we can check role if needed.
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can create users' });
    }

    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );
        res.json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Deactivate user
router.put('/users/:id/deactivate', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can deactivate users' });
    }

    const { id } = req.params;
    
    // Prevent deactivating self
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }

    try {
        // Try to update is_active column
        try {
            await db.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
        } catch (e) {
            // If is_active doesn't exist, we delete instead, or tell them to run migration
            return res.status(500).json({ success: false, error: 'Please run the SQL script to add the is_active column first.' });
        }
        res.json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Reset password
router.put('/users/:id/reset-password', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can reset passwords' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ success: false, error: 'New password is required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
console.log('Auth logic initialized');
