const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET missing');
        return res.status(500).json({ success: false, error: 'Internal server configuration error' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
            return res.status(403).json({ success: false, error: message });
        }

        req.user = decoded;
        next();
    });
};

const toMySqlDatetime = (date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    // Store as UTC so the scheduler can compare against UTC_TIMESTAMP()
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

// Admin Dashboard: Create a reminder for a ticket
router.post('/', authenticate, async (req, res) => {
    const { ticketId, remindAt, email } = req.body;

    if (!ticketId || !remindAt) {
        return res.status(400).json({ success: false, error: 'Ticket ID and reminder time are required' });
    }

    const sentTime = toMySqlDatetime(remindAt);
    if (!sentTime) {
        return res.status(400).json({ success: false, error: 'Invalid reminder time' });
    }

    const reminderEmail = (email && email.trim()) || process.env.EMAIL_USER || '';

    try {
        const [rows] = await db.execute('SELECT id FROM tickets WHERE id = ?', [ticketId]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

        const [result] = await db.execute(
            'INSERT INTO reminders (ticket_id, email, remind_at) VALUES (?, ?, ?)',
            [ticketId, reminderEmail, sentTime]
        );

        res.status(201).json({
            success: true,
            id: result.insertId,
            ticketId,
            remindAt: sentTime,
            email: reminderEmail
        });
    } catch (error) {
        console.error('Error creating reminder:', error);
        res.status(500).json({ success: false, error: 'Database error', details: error.message });
    }
});

// Admin Dashboard: List reminders for a specific ticket
router.get('/ticket/:ticketId', authenticate, async (req, res) => {
    const { ticketId } = req.params;

    try {
        const [reminders] = await db.execute(
            'SELECT id, ticket_id, email, remind_at, sent, created_at FROM reminders WHERE ticket_id = ? ORDER BY remind_at ASC',
            [ticketId]
        );
        // Convert the wrongly parsed local Date objects back to their correct UTC string representation
        const correctedReminders = reminders.map(r => {
            if (r.remind_at instanceof Date) {
                const pad = n => String(n).padStart(2, '0');
                const d = r.remind_at;
                r.remind_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`;
            }
            return r;
        });
        res.json({ success: true, reminders: correctedReminders });
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Delete a reminder
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute('DELETE FROM reminders WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Reminder not found' });
        res.json({ success: true, message: 'Reminder removed' });
    } catch (error) {
        console.error('Error deleting reminder:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;