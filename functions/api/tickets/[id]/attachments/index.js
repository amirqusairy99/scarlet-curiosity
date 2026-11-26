import { jsonResponse, errorResponse } from '../../../../utils/response.js';
import { authenticateRequest } from '../../../../utils/auth.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function onRequestPost(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);

    try {
        const ticket = await env.DB.prepare('SELECT id FROM tickets WHERE id = ?')
            .bind(ticketId)
            .first();

        if (!ticket) {
            return errorResponse('Ticket not found', 404);
        }

        const formData = await request.formData();
        const rawFiles = formData.getAll('attachments');
        const filesToUpload = rawFiles.filter(f => f && typeof f === 'object' && f.name && f.size > 0);

        if (filesToUpload.length === 0) {
            return errorResponse('No files uploaded', 400);
        }

        let uploadedCount = 0;
        for (const file of filesToUpload.slice(0, 5)) {
            if (file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.includes(file.type)) {
                continue;
            }

            const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const r2Filename = `${Date.now()}_${safeBase}`;

            if (env.UPLOADS_BUCKET) {
                await env.UPLOADS_BUCKET.put(r2Filename, file.stream(), {
                    httpMetadata: { contentType: file.type || 'application/octet-stream' }
                });
            }

            const filePath = `/uploads/${r2Filename}`;
            await env.DB.prepare(
                'INSERT INTO attachments (ticket_id, file_path, original_name) VALUES (?, ?, ?)'
            ).bind(ticketId, filePath, file.name).run();

            uploadedCount++;
        }

        const { results: attachments } = await env.DB.prepare(
            'SELECT id, ticket_id, file_path, original_name, created_at FROM attachments WHERE ticket_id = ? ORDER BY id ASC'
        ).bind(ticketId).all();

        return jsonResponse({
            success: true,
            message: `${uploadedCount} attachment(s) added`,
            attachments: attachments || []
        });
    } catch (err) {
        console.error('Error adding attachments:', err);
        return errorResponse('Database error adding attachments', 500, err.message);
    }
}
