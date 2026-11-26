import { jsonResponse, errorResponse } from '../../utils/response.js';
import { authenticateRequest } from '../../utils/auth.js';
import { sendTicketNotification } from '../../utils/email.js';

function generateSecureToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Admin Dashboard: View tickets (with search + pagination + filter)
export async function onRequestGet(context) {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
    const offset = (page - 1) * limit;
    const search = (url.searchParams.get('search') || '').trim();
    const filter = url.searchParams.get('filter');

    try {
        const whereClauses = [];
        const params = [];

        if (search) {
            const like = `%${search}%`;
            whereClauses.push(
                '(id LIKE ? OR name LIKE ? OR email LIKE ? OR department LIKE ? OR title LIKE ? OR description LIKE ? OR priority LIKE ? OR status LIKE ?)'
            );
            params.push(like, like, like, like, like, like, like, like);
        }

        if (filter === 'my_tickets') {
            whereClauses.push('assigned_to = ?');
            params.push(auth.user.id);
        } else if (filter === 'unassigned') {
            whereClauses.push('assigned_to IS NULL');
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 1. Total count
        const countQuery = `SELECT COUNT(*) AS total FROM tickets ${whereSql}`;
        const countStmt = env.DB.prepare(countQuery);
        const countRes = params.length > 0 ? await countStmt.bind(...params).first() : await countStmt.first();
        const total = countRes?.total || 0;

        // 2. Paginated tickets
        const selectQuery = `SELECT * FROM tickets ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
        const selectStmt = env.DB.prepare(selectQuery);
        const queryParams = [...params, limit, offset];
        const { results: tickets } = await selectStmt.bind(...queryParams).all();

        // 3. Attach attachments
        const ticketList = tickets || [];
        if (ticketList.length > 0) {
            const placeholders = ticketList.map(() => '?').join(',');
            const ticketIds = ticketList.map(t => t.id);
            const { results: attRows } = await env.DB.prepare(
                `SELECT id, ticket_id, file_path, original_name, created_at FROM attachments WHERE ticket_id IN (${placeholders}) ORDER BY id ASC`
            ).bind(...ticketIds).all();

            const attMap = {};
            (attRows || []).forEach(a => {
                if (!attMap[a.ticket_id]) attMap[a.ticket_id] = [];
                attMap[a.ticket_id].push(a);
            });

            ticketList.forEach(t => {
                t.attachments = attMap[t.id] || [];
            });
        }

        return jsonResponse({
            success: true,
            tickets: ticketList,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch (err) {
        console.error('Error fetching tickets:', err);
        return errorResponse('Database error fetching tickets', 500, err.message);
    }
}

// User Form: Submit a ticket (Allow multiple attachments, uploaded directly to Cloudflare R2)
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const formData = await request.formData();

        const name = (formData.get('name') || '').toString().trim();
        const email = (formData.get('email') || '').toString().trim();
        const department = (formData.get('department') || '').toString().trim();
        const title = (formData.get('title') || '').toString().trim();
        const description = (formData.get('description') || '').toString().trim();
        const priority = (formData.get('priority') || 'Medium').toString().trim();
        const status = (formData.get('status') || 'Open').toString().trim();

        if (!name || !email || !department || !title || !description || !priority) {
            return errorResponse('All fields are required', 400);
        }

        const token = generateSecureToken();

        // Insert ticket into D1
        const insertRes = await env.DB.prepare(
            `INSERT INTO tickets (name, email, department, title, description, priority, status, token)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(name, email, department, title, description, priority, status, token).run();

        const ticketId = insertRes.meta.last_row_id;

        // Process attachments and upload to Cloudflare R2
        const rawFiles = formData.getAll('attachments');
        const filesToUpload = rawFiles.filter(f => f && typeof f === 'object' && f.name && f.size > 0);

        for (const file of filesToUpload.slice(0, 5)) {
            if (file.size > MAX_FILE_SIZE) {
                continue; // Skip oversized files
            }
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                continue; // Skip disallowed MIME types
            }

            const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const r2Filename = `${Date.now()}_${safeBase}`;

            // Save to Cloudflare R2 Storage
            if (env.UPLOADS_BUCKET) {
                await env.UPLOADS_BUCKET.put(r2Filename, file.stream(), {
                    httpMetadata: { contentType: file.type || 'application/octet-stream' }
                });
            }

            // Save record in D1 attachments table
            const filePath = `/uploads/${r2Filename}`;
            await env.DB.prepare(
                'INSERT INTO attachments (ticket_id, file_path, original_name) VALUES (?, ?, ?)'
            ).bind(ticketId, filePath, file.name).run();
        }

        // Email notification
        const url = new URL(request.url);
        const ticketUrl = `${url.origin}/ticket-status.html?token=${token}`;

        // Send email asynchronously in the background
        context.waitUntil(
            sendTicketNotification({ toEmail: email, ticketId, title, ticketUrl, env })
                .catch(err => console.error('Failed to send notification email:', err))
        );

        return jsonResponse({ success: true, ticketId, token }, 201);
    } catch (err) {
        console.error('Error creating ticket:', err);
        return errorResponse('Failed to create ticket', 500, err.message);
    }
}
