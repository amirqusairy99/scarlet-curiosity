import { jsonResponse, errorResponse } from '../../utils/response.js';
import { authenticateRequest } from '../../utils/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    try {
        const body = await request.json();
        const { ticketId, remindAt, email } = body;

        if (!ticketId || !remindAt) {
            return errorResponse('Ticket ID and reminder time are required', 400);
        }

        const dateObj = new Date(remindAt);
        if (isNaN(dateObj.getTime())) {
            return errorResponse('Invalid reminder time', 400);
        }
        const sentTime = dateObj.toISOString().slice(0, 19).replace('T', ' ');

        const ticket = await env.DB.prepare('SELECT id FROM tickets WHERE id = ?')
            .bind(ticketId)
            .first();

        if (!ticket) {
            return errorResponse('Ticket not found', 404);
        }

        const reminderEmail = (email && email.trim()) || env.EMAIL_USER || '';

        const insertRes = await env.DB.prepare(
            'INSERT INTO reminders (ticket_id, email, remind_at, sent) VALUES (?, ?, ?, 0)'
        ).bind(ticketId, reminderEmail, sentTime).run();

        return jsonResponse({
            success: true,
            id: insertRes.meta.last_row_id,
            ticketId,
            remindAt: sentTime,
            email: reminderEmail
        }, 201);
    } catch (err) {
        console.error('Error creating reminder:', err);
        return errorResponse('Database error creating reminder', 500, err.message);
    }
}
