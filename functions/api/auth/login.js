import bcrypt from 'bcryptjs';
import { jsonResponse, errorResponse } from '../../utils/response.js';
import { signJwt } from '../../utils/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    if (!env.DB) {
        return errorResponse('Database binding (DB) is not configured', 500);
    }

    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return errorResponse('Username and password are required', 400);
        }

        const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
            .bind(username)
            .first();

        if (!user) {
            return errorResponse('Invalid credentials', 401);
        }

        if (user.is_active === 0) {
            return errorResponse('Account deactivated', 403);
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return errorResponse('Invalid credentials', 401);
        }

        const secret = env.JWT_SECRET || 'scarlet_super_secret_jwt_key_change_in_production';
        const token = await signJwt(
            { id: user.id, username: user.username, role: user.role },
            secret,
            3600
        );

        return jsonResponse({ success: true, token });
    } catch (err) {
        console.error('Login error:', err);
        return errorResponse('Database or internal server error', 500, err.message);
    }
}
