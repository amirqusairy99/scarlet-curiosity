import { jsonResponse, errorResponse } from '../../../../utils/response.js';
import { authenticateRequest } from '../../../../utils/auth.js';

export async function onRequestDelete(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const ticketId = parseInt(params.id, 10);
    const attachmentId = parseInt(params.attachmentId, 10);

    try {
        const attachment = await env.DB.prepare(
            'SELECT file_path FROM attachments WHERE id = ? AND ticket_id = ?'
        ).bind(attachmentId, ticketId).first();

        if (!attachment) {
            return errorResponse('Attachment not found', 404);
        }

        // Delete from Cloudflare R2
        if (env.UPLOADS_BUCKET && attachment.file_path) {
            const filename = attachment.file_path.replace('/uploads/', '');
            try {
                await env.UPLOADS_BUCKET.delete(filename);
            } catch (e) {
                console.warn(`Could not delete R2 object ${filename}:`, e);
            }
        }

        // Delete from D1
        await env.DB.prepare('DELETE FROM attachments WHERE id = ? AND ticket_id = ?')
            .bind(attachmentId, ticketId)
            .run();

        return jsonResponse({ success: true, message: 'Attachment removed' });
    } catch (err) {
        console.error('Error deleting attachment:', err);
        return errorResponse('Database error deleting attachment', 500, err.message);
    }
}
