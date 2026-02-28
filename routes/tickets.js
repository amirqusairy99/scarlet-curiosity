const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware to protect admin routes
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

// User Form: Submit a ticket
router.post('/', async (req, res) => {
    const { name, department, title, description, status } = req.body;
    if (!name || !department || !title || !description) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const ticketStatus = status || 'Open';

    try {
        const [result] = await db.execute(
            'INSERT INTO tickets (name, department, title, description, status) VALUES (?, ?, ?, ?, ?)',
            [name, department, title, description, ticketStatus]
        );
        res.status(201).json({ success: true, ticketId: result.insertId });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: View all tickets
router.get('/', authenticate, async (req, res) => {
    try {
        const [tickets] = await db.execute('SELECT * FROM tickets ORDER BY created_at DESC');
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Update ticket details (full CRUD)
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { name, department, title, description, status } = req.body;

    if (status && !['Open', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [result] = await db.execute(
            'UPDATE tickets SET name = ?, department = ?, title = ?, description = ?, status = ? WHERE id = ?',
            [name, department, title, description, status, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });
        res.json({ success: true, message: 'Ticket updated' });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Delete ticket
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute('DELETE FROM tickets WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });
        res.json({ success: true, message: 'Ticket deleted' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
