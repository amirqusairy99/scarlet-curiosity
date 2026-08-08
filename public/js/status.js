// public/js/status.js
// Format Date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('statusContainer');
    
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        container.innerHTML = `
            <div class="error-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <h2>Missing Token</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">No ticket tracking token was provided in the URL.</p>
                <a href="index.html" class="btn btn-primary" style="margin-top: 1.5rem; display: inline-block;">Submit a New Ticket</a>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_URL}/tickets/public/${token}`);
        if (!response.ok) {
            throw new Error(response.status === 404 ? 'Ticket not found' : 'Failed to fetch ticket status');
        }

        const ticket = await response.json();
        
        let statusClass = 'badge-open';
        if (ticket.status.toLowerCase() === 'in progress') {
            statusClass = 'badge-progress';
        } else if (ticket.status.toLowerCase() === 'resolved') {
            statusClass = 'badge-resolved';
        }

        let attachmentsHtml = '';
        if (ticket.attachments && ticket.attachments.length > 0) {
            const links = ticket.attachments.map(att => {
                const name = att.original_name || att.file_path.split('/').pop();
                return `<li style="margin-bottom: 0.5rem;">
                    <a href="${escapeHTML(att.file_path)}" target="_blank" class="attachment-link">
                        <i class="fa-solid fa-paperclip"></i> ${escapeHTML(name)}
                    </a>
                </li>`;
            }).join('');
            attachmentsHtml = `<div class="detail-item" style="grid-column: span 2;">
                 <label>Attachments (${ticket.attachments.length})</label>
                 <ul style="list-style: none; padding: 0; margin: 0;">${links}</ul>
               </div>`;
        }

        container.innerHTML = `
            <div class="status-header">
                <div>
                    <h2 style="font-size: 1.5rem; margin-bottom: 0.25rem;">${escapeHTML(ticket.title)}</h2>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Ticket #${ticket.id}</p>
                </div>
                <span class="status-badge ${statusClass}">${escapeHTML(ticket.status)}</span>
            </div>

            <div class="detail-grid">
                <div class="detail-item">
                    <label>Submitted By</label>
                    <span>${escapeHTML(ticket.name)}</span>
                </div>
                <div class="detail-item">
                    <label>Email Address</label>
                    <span>${escapeHTML(ticket.email)}</span>
                </div>
                <div class="detail-item">
                    <label>Department</label>
                    <span>${escapeHTML(ticket.department)}</span>
                </div>
                <div class="detail-item">
                    <label>Date Created</label>
                    <span>${formatDate(ticket.created_at)}</span>
                </div>
                ${attachmentsHtml}
            </div>

            <div style="margin-top: 2rem;">
                <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.5rem;">Description</label>
                <div class="ticket-description">${escapeHTML(ticket.description)}</div>
            </div>
            
            <div style="text-align: center; margin-top: 2rem; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
                <p style="color: var(--text-secondary); font-size: 0.875rem;">This is a secure, unguessable status link. Keep this URL to monitor updates.</p>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching ticket status:', error);
        container.innerHTML = `
            <div class="error-state">
                <i class="fa-solid fa-circle-xmark"></i>
                <h2>Error</h2>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">${escapeHTML(error.message)}</p>
                <a href="index.html" class="btn btn-primary" style="margin-top: 1.5rem; display: inline-block;">Submit a New Ticket</a>
            </div>
        `;
    }
});
