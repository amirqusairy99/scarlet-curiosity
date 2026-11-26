import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { authenticateRequest } from '../../../utils/auth.js';

export async function onRequestPatch(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);

    try {
        const body = await request.json();
        const assignedTo = body.assigned_to ? parseInt(body.assigned_to, 10) : null;

        const updateRes = await env.DB.prepare(
            'UPDATE tickets SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(assignedTo, ticketId).run();

        if (updateRes.meta.changes === 0) {
            return errorResponse('Ticket not found', 404);
        }

        if (assignedTo) {
            const userRow = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
                .bind(assignedTo)
                .first();
            const username = userRow ? userRow.username : 'Unknown';
            await env.DB.prepare(
                'INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)'
            ).bind(ticketId, auth.user.id, 'ASSIGNED', `Assigned to user '${username}'`).run();
        } else {
            await env.DB.prepare(
                'INSERT INTO ticket_history (ticket_id, user_id, action, details) VALUES (?, ?, ?, ?)'
            ).bind(ticketId, auth.user.id, 'UNASSIGNED', 'Ticket unassigned').run();
        }

        return jsonResponse({ success: true, message: 'Ticket assignment updated' });
    } catch (err) {
        console.error('Error assigning ticket:', err);
        return errorResponse('Database error updating ticket assignment', 500, err.message);
    }
}
