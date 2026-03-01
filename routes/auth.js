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

module.exports = router;
console.log('Auth logic initialized');
