import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { authenticateRequest } from '../../../utils/auth.js';

export async function onRequestGet(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);

    try {
        const { results } = await env.DB.prepare(
            `SELECT th.id, th.action, th.details, th.created_at, u.username
             FROM ticket_history th
             LEFT JOIN users u ON th.user_id = u.id
             WHERE th.ticket_id = ?
             ORDER BY th.created_at DESC`
        ).bind(ticketId).all();

        return jsonResponse({ success: true, history: results || [] });
    } catch (err) {
        console.error('Error fetching ticket history:', err);
        return errorResponse('Database error fetching ticket history', 500, err.message);
    }
}
