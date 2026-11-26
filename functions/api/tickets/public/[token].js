import { jsonResponse, errorResponse } from '../../../utils/response.js';

export async function onRequestGet(context) {
    const { params, env } = context;
    const token = params.token;

    if (!token) {
        return errorResponse('Token is required', 400);
    }

    try {
        const ticket = await env.DB.prepare(
            `SELECT id, name, email, department, title, description, priority, status, created_at, updated_at 
             FROM tickets 
             WHERE token = ?`
        ).bind(token).first();

        if (!ticket) {
            return errorResponse('Ticket not found', 404);
        }

        const { results: attachments } = await env.DB.prepare(
            'SELECT id, ticket_id, file_path, original_name, created_at FROM attachments WHERE ticket_id = ? ORDER BY id ASC'
        ).bind(ticket.id).all();

        ticket.attachments = attachments || [];

        return jsonResponse(ticket);
    } catch (err) {
        console.error('Error fetching public ticket:', err);
        return errorResponse('Database error fetching ticket', 500, err.message);
    }
}
