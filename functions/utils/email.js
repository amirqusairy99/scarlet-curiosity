export async function sendTicketNotification({ toEmail, ticketId, title, ticketUrl, env }) {
    const subject = `Ticket #${ticketId} Created Successfully`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #6366f1;">MIS Ticket System</h2>
            <p>Your ticket has been successfully submitted!</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Ticket ID:</strong> #${ticketId}</p>
                <p style="margin: 5px 0;"><strong>Title:</strong> ${title}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> OPEN</p>
            </div>
            <p>You can track the progress of your request anytime using this link:</p>
            <p style="margin: 25px 0;">
                <a href="${ticketUrl}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket Status</a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">This is an automated notification from Scarlet Curiosity MIS Ticketing System.</p>
        </div>
    `;

    return sendEmail({ to: toEmail, subject, html, env });
}

export async function sendReminderEmail({ reminder, ticket, env }) {
    const ticketUrl = ticket.token
        ? `${env.BASE_URL || ''}/ticket-status.html?token=${ticket.token}`
        : '';

    const subject = `Reminder: Ticket #${ticket.id} - ${ticket.title}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #6366f1;">MIS Ticket Reminder</h2>
            <p>This is a scheduled reminder for the following ticket:</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Ticket ID:</strong> #${ticket.id}</p>
                <p style="margin: 5px 0;"><strong>Title:</strong> ${ticket.title}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> ${ticket.status}</p>
                <p style="margin: 5px 0;"><strong>Priority:</strong> ${ticket.priority}</p>
                <p style="margin: 5px 0;"><strong>Department:</strong> ${ticket.department}</p>
            </div>
            ${ticketUrl ? `<p><a href="${ticketUrl}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket</a></p>` : ''}
        </div>
    `;

    return sendEmail({ to: reminder.email, subject, html, env });
}

async function sendEmail({ to, subject, html, env }) {
    const from = env.EMAIL_FROM || 'noreply@scarlet-curiosity.pages.dev';

    // 1. Resend API
    if (env.RESEND_API_KEY) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from,
                    to: [to],
                    subject,
                    html
                })
            });
            if (!res.ok) {
                const errText = await res.text();
                console.error('Resend API error:', errText);
            }
            return;
        } catch (err) {
            console.error('Failed to send email via Resend:', err);
            return;
        }
    }

    // 2. MailChannels API (Native free integration on Cloudflare Workers/Pages)
    try {
        const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: from, name: 'MIS Ticket System' },
                subject,
                content: [{ type: 'text/html', value: html }]
            })
        });
        if (!res.ok) {
            const errText = await res.text();
            console.warn('MailChannels response:', errText);
        }
    } catch (err) {
        console.warn('No email provider configured or failed to send email. Email logged to console:', { to, subject });
    }
}
