import { jsonResponse, errorResponse } from '../../../../utils/response.js';
import { authenticateRequest } from '../../../../utils/auth.js';

export async function onRequestPut(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    if (auth.user.role !== 'admin') {
        return errorResponse('Only admins can deactivate users', 403);
    }

    const targetId = parseInt(params.id, 10);
    if (targetId === auth.user.id) {
        return errorResponse('Cannot deactivate your own account', 400);
    }

    try {
        await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?')
            .bind(targetId)
            .run();

        return jsonResponse({ success: true, message: 'User deactivated successfully' });
    } catch (err) {
        console.error('Deactivate user error:', err);
        return errorResponse('Database error deactivating user', 500, err.message);
    }
}
