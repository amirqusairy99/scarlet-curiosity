import bcrypt from 'bcryptjs';
import { jsonResponse, errorResponse } from '../../utils/response.js';
import { authenticateRequest } from '../../utils/auth.js';

export async function onRequestPut(context) {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const userId = auth.user.id;

    try {
        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return errorResponse('Current and new password are required', 400);
        }

        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
            .bind(userId)
            .first();

        if (!user) {
            return errorResponse('User not found', 404);
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return errorResponse('Incorrect current password', 401);
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
            .bind(hashed, userId)
            .run();

        return jsonResponse({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        return errorResponse('Internal error updating password', 500, err.message);
    }
}
