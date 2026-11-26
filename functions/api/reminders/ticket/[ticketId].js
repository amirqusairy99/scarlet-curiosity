import { jsonResponse, errorResponse } from '../../../../utils/response.js';
import { authenticateRequest } from '../../../../utils/auth.js';

export async function onRequestGet(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.ticketId, 10);

    try {
        const { results: reminders } = await env.DB.prepare(
            'SELECT id, ticket_id, email, remind_at, sent, created_at FROM reminders WHERE ticket_id = ? ORDER BY remind_at ASC'
        ).bind(ticketId).all();

        return jsonResponse({ success: true, reminders: reminders || [] });
    } catch (err) {
        console.error('Error fetching reminders:', err);
        return errorResponse('Database error fetching reminders', 500, err.message);
    }
}
