import { jsonResponse, errorResponse } from '../../../utils/response.js';
import { sendReminderEmail } from '../../../utils/email.js';

export async function onRequest(context) {
    const { request, env } = context;

    // Optional secret key check to prevent unauthorized external calls
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret') || request.headers.get('x-cron-secret');
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
        return errorResponse('Unauthorized cron request', 401);
    }

    try {
        const { results: dueReminders } = await env.DB.prepare(
            `SELECT r.id, r.ticket_id, r.email, r.remind_at, t.title, t.status, t.priority, t.department, t.token
             FROM reminders r
             JOIN tickets t ON t.id = r.ticket_id
             WHERE r.sent = 0 AND r.remind_at <= datetime('now')
             ORDER BY r.remind_at ASC
             LIMIT 50`
        ).all();

        if (!dueReminders || dueReminders.length === 0) {
            return jsonResponse({ success: true, message: 'No reminders due', processed: 0 });
        }

        let processedCount = 0;
        for (const row of dueReminders) {
            try {
                await sendReminderEmail({ reminder: row, ticket: row, env });
                await env.DB.prepare('UPDATE reminders SET sent = 1 WHERE id = ?')
                    .bind(row.id)
                    .run();
                processedCount++;
            } catch (err) {
                console.error(`Failed to send reminder for ticket #${row.ticket_id}:`, err);
            }
        }

        return jsonResponse({
            success: true,
            message: `Processed ${processedCount} reminder(s)`,
            processed: processedCount
        });
    } catch (err) {
        console.error('Reminder processor error:', err);
        return errorResponse('Database error processing reminders', 500, err.message);
    }
}
