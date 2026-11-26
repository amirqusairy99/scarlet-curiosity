import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { authenticateRequest } from '../../../utils/auth.js';

// Admin Dashboard: Update ticket details
export async function onRequestPut(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);

    try {
        const body = await request.json();
        const { name, department, title, description, priority, status } = body;

        if (status && !['Open', 'In Progress', 'Resolved'].includes(status)) {
            return errorResponse('Invalid status', 400);
        }

        const existing = await env.DB.prepare('SELECT status FROM tickets WHERE id = ?')
            .bind(ticketId)
            .first();

        if (!existing) {
            return errorResponse('Ticket not found', 404);
        }

        const oldStatus = existing.status;

        await env.DB.prepare(
            `UPDATE tickets 
             SET name = ?, department = ?, title = ?, description = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
        ).bind(name, department, title, description, priority, status, ticketId).run();

        if (oldStatus !== status) {
            await env.DB.prepare(
                'INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)'
            ).bind(
                ticketId,
                auth.user.id,
                'STATUS_CHANGED',
                `Status changed from '${oldStatus}' to '${status}'`
            ).run();
        }

        return jsonResponse({ success: true, message: 'Ticket updated' });
    } catch (err) {
        console.error('Error updating ticket:', err);
        return errorResponse('Database error updating ticket', 500, err.message);
    }
}

// Admin Dashboard: Delete ticket
export async function onRequestDelete(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);

    try {
        // Fetch attachments so we can also purge them from Cloudflare R2
        const { results: attachments } = await env.DB.prepare(
            'SELECT file_path FROM attachments WHERE ticket_id = ?'
        ).bind(ticketId).all();

        if (env.UPLOADS_BUCKET && attachments && attachments.length > 0) {
            for (const att of attachments) {
                const filename = att.file_path.replace('/uploads/', '');
                try {
                    await env.UPLOADS_BUCKET.delete(filename);
                } catch (e) {
                    console.warn(`Could not delete R2 object ${filename}:`, e);
                }
            }
        }

        const res = await env.DB.prepare('DELETE FROM tickets WHERE id = ?')
            .bind(ticketId)
            .run();

        if (res.meta.changes === 0) {
            return errorResponse('Ticket not found', 404);
        }

        return jsonResponse({ success: true, message: 'Ticket deleted' });
    } catch (err) {
        console.error('Error deleting ticket:', err);
        return errorResponse('Database error deleting ticket', 500, err.message);
    }
}
