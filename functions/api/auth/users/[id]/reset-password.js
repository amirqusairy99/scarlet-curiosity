import bcrypt from 'bcryptjs';
import { jsonResponse, errorResponse } from '../../../../utils/response.js';
import { authenticateRequest } from '../../../../utils/auth.js';

export async function onRequestPut(context) {
    const { request, params, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    if (auth.user.role !== 'admin') {
        return errorResponse('Only admins can reset passwords', 403);
    }

    const targetId = parseInt(params.id, 10);

    try {
        const body = await request.json();
        const { newPassword } = body;

        if (!newPassword) {
            return errorResponse('New password is required', 400);
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
            .bind(hashedPassword, targetId)
            .run();

        return jsonResponse({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        return errorResponse('Database error resetting password', 500, err.message);
    }
}
