const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');                 // <<<< HERE
const handlebars = require('handlebars');
const crypto = require('crypto');

const sendTicketNotification = async (toEmail, ticketId, title, ticketUrl, status = 'OPEN') => {
  try {
    // Read template file
    const templateSource = fs.readFileSync(path.join(__dirname, '../emails/ticketCreated.hbs'), 'utf8');
    
    // Compile Handlebars template
    const template = handlebars.compile(templateSource);
    
    // Generate HTML with dynamic data
    const html = template({ ticketId, title, status, ticketUrl });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 's1364.securessl.net',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"MIS Ticket System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Ticket #${ticketId} Created Successfully`,
      html
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

// Secure multer configuration with sanitization, size limit, and MIME whitelist
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Store uploads outside public directory for safety
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        // Sanitize filename and prepend timestamp to avoid collisions
        const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        cb(null, `${timestamp}_${safeBase}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit per file
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
        }
    }
});

// Store one or more uploaded files as attachment rows for a ticket
const storeAttachments = async (ticketId, files) => {
    if (!files || files.length === 0) return;
    for (const file of files) {
        await db.execute(
            'INSERT INTO attachments (ticket_id, file_path, original_name) VALUES (?, ?, ?)',
            [ticketId, `/uploads/${file.filename}`, file.originalname]
        );
    }
};

// Fetch all attachments for a set of ticket ids
const fetchAttachments = async (ticketIds) => {
    if (!ticketIds || ticketIds.length === 0) return {};
    const placeholders = ticketIds.map(() => '?').join(',');
    const [rows] = await db.execute(
        `SELECT id, ticket_id, file_path, original_name, created_at FROM attachments WHERE ticket_id IN (${placeholders}) ORDER BY id ASC`,
        ticketIds
    );
    const map = {};
    rows.forEach(a => {
        if (!map[a.ticket_id]) map[a.ticket_id] = [];
        map[a.ticket_id].push(a);
    });
    return map;
};

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

// User Form: Submit a ticket (Allow multiple attachments, up to 5)
router.post('/', upload.array('attachments', 5), async (req, res) => {
    const { name, email, department, title, description, priority, status } = req.body;
    if (!name || !email || !department || !title || !description || !priority) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const ticketStatus = status || 'Open';
    const token = crypto.randomBytes(32).toString('hex');

    try {
        const [result] = await db.execute(
            'INSERT INTO tickets (name, email, department, title, description, priority, status, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, email, department, title, description, priority, ticketStatus, token]
        );

        // Store all uploaded attachments as separate rows
        await storeAttachments(result.insertId, req.files);

        const ticketUrl = `${req.protocol}://${req.get('host')}/ticket-status.html?token=${token}`;

        sendTicketNotification(email, result.insertId, title, ticketUrl)
            .catch(err => console.error('Failed to send email:', err));

        res.status(201).json({ success: true, ticketId: result.insertId, token });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ success: false, error: 'Database error', details: error.message });
    }
});

// Public Route: View ticket by token (unguessable link)
router.get('/public/:token', async (req, res) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT id, name, email, department, title, description, priority, status, created_at, updated_at FROM tickets WHERE token = ?',
            [token]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }

        const ticket = rows[0];
        const attMap = await fetchAttachments([ticket.id]);
        ticket.attachments = attMap[ticket.id] || [];

        res.json(ticket);
    } catch (error) {
        console.error('Error fetching public ticket:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

console.log('Tickets route logic initialized');

// Admin Dashboard: View tickets (with search + pagination)
router.get('/', authenticate, async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();

    try {
        let where = '';
        const params = [];

        if (search) {
            const like = `%${search}%`;
            where = `WHERE id LIKE ? OR name LIKE ? OR email LIKE ? OR department LIKE ? OR title LIKE ? OR description LIKE ? OR priority LIKE ? OR status LIKE ?`;
            params.push(like, like, like, like, like, like, like, like);
        }

        const [countRows] = await db.execute(
            `SELECT COUNT(*) AS total FROM tickets ${where}`,
            params
        );
        const total = countRows[0].total;

        // limit/offset are already parsed as integers above, so they are safe to interpolate.
        // mysql2 does not support binding placeholders for LIMIT/OFFSET in prepared statements.
        const [tickets] = await db.execute(
            `SELECT * FROM tickets ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        // Attach each ticket's attachments
        const ids = tickets.map(t => t.id);
        const attMap = await fetchAttachments(ids);
        tickets.forEach(t => { t.attachments = attMap[t.id] || []; });

        res.json({
            success: true,
            tickets,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Update ticket details (fields only, attachments managed separately)
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { name, department, title, description, priority, status } = req.body;

    if (status && !['Open', 'In Progress', 'Resolved'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [result] = await db.execute(
            'UPDATE tickets SET name = ?, department = ?, title = ?, description = ?, priority = ?, status = ? WHERE id = ?',
            [name, department, title, description, priority, status, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });
        res.json({ success: true, message: 'Ticket updated' });
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Add more attachments to an existing ticket (preserves existing ones)
router.post('/:id/attachments', authenticate, upload.array('attachments', 5), async (req, res) => {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    try {
        // Ensure the ticket exists
        const [rows] = await db.execute('SELECT id FROM tickets WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'Ticket not found' });

        await storeAttachments(parseInt(id, 10), req.files);

        const attMap = await fetchAttachments([parseInt(id, 10)]);
        res.json({ success: true, message: `${req.files.length} attachment(s) added`, attachments: attMap[parseInt(id, 10)] || [] });
    } catch (error) {
        console.error('Error adding attachments:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Admin Dashboard: Delete a specific attachment
router.delete('/:id/attachments/:attachmentId', authenticate, async (req, res) => {
    const { id, attachmentId } = req.params;

    try {
        const [result] = await db.execute(
            'DELETE FROM attachments WHERE id = ? AND ticket_id = ?',
            [attachmentId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Attachment not found' });
        res.json({ success: true, message: 'Attachment removed' });
    } catch (error) {
        console.error('Error deleting attachment:', error);
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
