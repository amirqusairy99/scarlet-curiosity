const db = require('./db');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 's1364.securessl.net',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const sendReminderEmail = async (reminder, ticket) => {
    const templateSource = fs.readFileSync(path.join(__dirname, 'emails', 'reminder.hbs'), 'utf8');
    const template = handlebars.compile(templateSource);

    const remindAt = reminder.remind_at
        ? (typeof reminder.remind_at === 'string' 
            ? new Date(reminder.remind_at.replace(' ', 'T') + 'Z').toLocaleString() 
            : reminder.remind_at.toLocaleString())
        : '';

    const ticketUrl = ticket.token
        ? `${process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`}/ticket-status.html?token=${ticket.token}`
        : '';

    const html = template({
        ticketId: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        department: ticket.department,
        remindAt,
        ticketUrl
    });

    const transporter = createTransporter();
    await transporter.sendMail({
        from: `"MIS Ticket System" <${process.env.EMAIL_USER}>`,
        to: reminder.email,
        subject: `Reminder: Ticket #${ticket.id} - ${ticket.title}`,
        html
    });
};

// Find and email due, unsent reminders. Mark them sent on success.
const processDueReminders = async () => {
    try {
        const [rows] = await db.execute(
            `SELECT r.id, r.ticket_id, r.email, r.remind_at, t.title, t.status, t.priority, t.department, t.token
             FROM reminders r
             JOIN tickets t ON t.id = r.ticket_id
             WHERE r.sent = 0 AND r.remind_at <= UTC_TIMESTAMP()
             ORDER BY r.remind_at ASC
             LIMIT 50`
        );

        if (rows.length === 0) return;

        for (const row of rows) {
            try {
                await sendReminderEmail(row, row);
                await db.execute('UPDATE reminders SET sent = 1 WHERE id = ?', [row.id]);
                console.log(`Reminder email sent for ticket #${row.ticket_id}`);
            } catch (err) {
                console.error(`Failed to send reminder for ticket #${row.ticket_id}:`, err);
            }
        }
    } catch (error) {
        console.error('Reminder scheduler error:', error);
    }
};

const startReminderScheduler = (intervalMs = 60 * 1000) => {
    processDueReminders();
    setInterval(processDueReminders, intervalMs);
    console.log(`Reminder scheduler started (every ${intervalMs / 1000}s)`);
};

module.exports = { startReminderScheduler, processDueReminders };