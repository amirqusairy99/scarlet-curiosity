import bcrypt from 'bcryptjs';
import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { authenticateRequest } from '../../../utils/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    try {
        const { results } = await env.DB.prepare(
            'SELECT id, username, role, is_active, created_at FROM users ORDER BY id ASC'
        ).all();

        return jsonResponse({ success: true, users: results || [] });
    } catch (err) {
        console.error('Fetch users error:', err);
        return errorResponse('Database error fetching users', 500, err.message);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    if (auth.user.role !== 'admin') {
        return errorResponse('Only admins can create users', 403);
    }

    try {
        const body = await request.json();
        const { username, password, role } = body;

        if (!username || !password || !role) {
            return errorResponse('All fields are required', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await env.DB.prepare(
            'INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, 1)'
        ).bind(username, hashedPassword, role).run();

        return jsonResponse({ success: true, message: 'User created successfully' });
    } catch (err) {
        console.error('Create user error:', err);
        if (err.message && err.message.includes('UNIQUE')) {
            return errorResponse('Username already exists', 400);
        }
        return errorResponse('Database error creating user', 500, err.message);
    }
}
