// Theme Toggle Logic
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeIcon('light');
    }
};

const updateThemeIcon = (theme) => {
    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                updateThemeIcon('light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                updateThemeIcon('dark');
            }
        });
    }
});

const API_URL = '/api';

// Utility to escape HTML and prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Utility to show alerts
function showAlert(elementId, message, type = 'success') {
    const alertEl = document.getElementById(elementId);
    if (!alertEl) return;
    alertEl.innerHTML = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'block';
    setTimeout(() => {
        alertEl.style.display = 'none';
    }, 15000); // Increased timeout to 15s to let user read/click link
}

// Format Date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// ---------------------------------------------------------
// Ticket Submission Logic (index.html)
// ---------------------------------------------------------
const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = ticketForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('email', document.getElementById('email').value);
        formData.append('department', document.getElementById('department').value);
        formData.append('priority', document.getElementById('priority').value);
        formData.append('title', document.getElementById('title').value);
        formData.append('description', document.getElementById('description').value);

        const attachmentInput = document.getElementById('attachment');
        const files = attachmentInput ? attachmentInput.files : [];
        for (const file of files) {
            formData.append('attachments', file);
        }

        try {
            const response = await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                body: formData // No Content-Type header, browser sets it for FormData
            });

            const result = await response.json();
            if (response.ok) {
                const trackUrl = `${window.location.origin}/ticket-status.html?token=${result.token}`;
                showAlert('submitAlert', `Success! Your ticket #${result.ticketId} has been submitted. <br><a href="${trackUrl}" target="_blank" style="color: var(--accent-primary); text-decoration: underline; font-weight: 600;">Track Ticket Status here</a>`, 'success');
                ticketForm.reset();
            } else {
                showAlert('submitAlert', result.error || result.message || 'Failed to submit ticket', 'error');
            }
        } catch (error) {
            console.error('Error submitting ticket:', error);
            showAlert('submitAlert', 'Network error. Please try again.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ---------------------------------------------------------
// Login Logic (login.html)
// ---------------------------------------------------------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
        btn.disabled = true;

        const data = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                localStorage.setItem('token', result.token);
                window.location.href = 'dashboard.html?t=' + Date.now();
            } else {
                showAlert('loginAlert', result.error || result.message || 'Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('loginAlert', 'Network error. Please try again.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

// ---------------------------------------------------------
// Dashboard Logic (dashboard.html)
// ---------------------------------------------------------
let currentTicketId = null;
let isEditMode = false;
let allTickets = [];
let searchTerm = '';
let currentPage = 1;
const PAGE_SIZE = 25;

async function fetchTickets(page = currentPage, keepSummary = false) {
    const token = localStorage.getItem('token');
    if (!token) return;

    const tbody = document.getElementById('ticketsTableBody');
    const loading = document.getElementById('loadingIndicator');
    const empty = document.getElementById('emptyState');

    if (!tbody) return;

    currentPage = page;
    tbody.innerHTML = '';
    loading.style.display = 'block';
    empty.style.display = 'none';

    const params = new URLSearchParams({ page, limit: PAGE_SIZE, _: Date.now() });
    if (searchTerm) params.set('search', searchTerm);

    try {
        const response = await fetch(`${API_URL}/tickets?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        const tickets = Array.isArray(data) ? data : (data.tickets || []);
        const pagination = data.pagination || { page: 1, limit: PAGE_SIZE, total: tickets.length, totalPages: 1 };

        loading.style.display = 'none';

        allTickets = tickets;

        if (!keepSummary) {
            updateSummary(pagination.total);
        }

        renderTickets(tickets);
        renderPagination(pagination);
        syncSearchUI();
    } catch (error) {
        console.error('Error fetching tickets:', error);
        loading.style.display = 'none';
        showAlert('dashboardAlert', 'Failed to fetch tickets. Check console or try logging in again.', 'error');
    }
}

function updateSummary(total) {
    const summaryTotalEl = document.getElementById('summaryTotal');
    if (summaryTotalEl) summaryTotalEl.textContent = total;

    // Summary cards by status are approximated from the paginated data.
    // For exact per-status totals at scale, add a dedicated summary endpoint.
    let openCount = 0;
    let progressCount = 0;
    let resolvedCount = 0;

    allTickets.forEach(ticket => {
        if (ticket.status === 'Open') openCount++;
        else if (ticket.status === 'In Progress') progressCount++;
        else if (ticket.status === 'Resolved') resolvedCount++;
    });

    const summaryOpenEl = document.getElementById('summaryOpen');
    const summaryProgressEl = document.getElementById('summaryProgress');
    const summaryResolvedEl = document.getElementById('summaryResolved');

    if (summaryOpenEl) summaryOpenEl.textContent = openCount;
    if (summaryProgressEl) summaryProgressEl.textContent = progressCount;
    if (summaryResolvedEl) summaryResolvedEl.textContent = resolvedCount;
}

function renderPagination(pagination) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    const { page, totalPages, total, limit } = pagination;

    if (total === 0) {
        container.innerHTML = '';
        return;
    }

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    let html = `<div class="pagination-info" style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.5rem;">
        Showing ${from}&ndash;${to} of ${total} tickets
    </div>
    <div class="pagination-buttons" style="display: flex; align-items: center; gap: 0.5rem;">`;

    html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i>
    </button>`;

    // Window of page numbers around current page
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    if (startPage > 1) {
        html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(1)">1</button>`;
        if (startPage > 2) html += `<span style="color: var(--text-secondary);">&hellip;</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        html += `<button class="btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}" onclick="fetchTickets(${p})">${p}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="color: var(--text-secondary);">&hellip;</span>`;
        html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-right"></i>
    </button>`;

    html += `</div>`;

    container.innerHTML = html;
}

function renderTickets(tickets) {
    const tbody = document.getElementById('ticketsTableBody');
    const empty = document.getElementById('emptyState');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (tickets.length === 0) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';

    tickets.forEach(ticket => {
        let badgeClass = 'badge-open';
        if (ticket.status === 'In Progress') badgeClass = 'badge-progress';
        else if (ticket.status === 'Resolved') badgeClass = 'badge-resolved';

        let priorityClass = 'badge-medium';
        if (ticket.priority === 'High') priorityClass = 'badge-high';
        else if (ticket.priority === 'Low') priorityClass = 'badge-low';

        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td style="color: var(--text-secondary); font-family: monospace;">#${ticket.id}</td>
        <td style="font-weight: 500;">${escapeHTML(ticket.name)}</td>
        <td><span style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">${escapeHTML(ticket.department)}</span></td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(ticket.title)}</td>
        <td><span class="badge ${priorityClass}">${ticket.priority || 'Medium'}</span></td>
        <td><span class="badge ${badgeClass}">${ticket.status}</span></td>
        <td style="color: var(--text-secondary); font-size: 0.875rem;">${formatDate(ticket.created_at)}</td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn btn-secondary btn-sm" onclick='openEditModal(${JSON.stringify(ticket).replace(/'/g, "&apos;")})'>
            View/Edit
          </button>
          <button class="btn btn-secondary btn-sm" title="Set reminder" onclick='openReminderModal(${JSON.stringify(ticket).replace(/'/g, "&apos;")})'>
            <i class="fa-solid fa-bell"></i>
          </button>
          </div>
        </td>
      `;
        tbody.appendChild(tr);
    });
}

let searchDebounceTimer = null;

function filterTickets() {
    const query = (document.getElementById('ticketSearch')?.value || '').trim();
    searchTerm = query;
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        fetchTickets(1);
    }, 300);
}

function syncSearchUI() {
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchInput = document.getElementById('ticketSearch');
    if (clearBtn) {
        clearBtn.style.display = (searchInput && searchInput.value.trim()) ? 'inline-flex' : 'none';
    }
}

function clearSearch() {
    const searchInput = document.getElementById('ticketSearch');
    if (searchInput) searchInput.value = '';
    searchTerm = '';
    clearTimeout(searchDebounceTimer);
    fetchTickets(1);
}

document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'ticketSearch') {
        filterTickets();
    }
});

// Modal Logic
function openEditModal(ticket) {
    isEditMode = true;
    currentTicketId = ticket.id;

    document.getElementById('modalTitleText').textContent = `Edit Ticket #${ticket.id}`;
    document.getElementById('modalName').value = ticket.name;
    document.getElementById('modalEmail').value = ticket.email || '';
    document.getElementById('modalDepartment').value = ticket.department;
    document.getElementById('modalPriority').value = ticket.priority || 'Medium';
    document.getElementById('modalTitleInput').value = ticket.title;
    document.getElementById('modalDescriptionInput').value = ticket.description;
    document.getElementById('modalStatus').value = ticket.status;

    document.getElementById('saveBtn').textContent = 'Save Changes';

    // Show attachment upload input in edit mode so admins can add a new attachment
    const newAttachmentSection = document.getElementById('newAttachmentSection');
    if (newAttachmentSection) {
        newAttachmentSection.style.display = 'block';
    }
    // Reset the file input for a fresh pick
    const modalAttachmentInput = document.getElementById('modalAttachmentInput');
    if (modalAttachmentInput) modalAttachmentInput.value = '';

    // Render the ticket's attachments (multiple) with delete buttons
    const attachmentSection = document.getElementById('attachmentSection');
    const attachmentDisplay = document.getElementById('attachmentDisplay');
    const addAttachmentsSection = document.getElementById('addAttachmentsSection');

    renderAttachments(ticket.attachments || []);
    if (ticket.attachments && ticket.attachments.length > 0) {
        attachmentSection.style.display = 'block';
    } else {
        attachmentSection.style.display = 'none';
    }

    // In edit mode, allow adding more attachments via the separate button
    if (addAttachmentsSection) addAttachmentsSection.style.display = 'block';

    document.getElementById('ticketModal').classList.add('active');
}

// Render a list of attachment items with view/delete controls
function renderAttachments(attachments) {
    const attachmentDisplay = document.getElementById('attachmentDisplay');
    if (!attachmentDisplay) return;

    if (!attachments || attachments.length === 0) {
        attachmentDisplay.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No attachments on this ticket.</p>';
        return;
    }

    const baseUrl = API_URL.replace('/api', '');
    let html = '';
    attachments.forEach(att => {
        const fullUrl = `${baseUrl}${att.file_path}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_path);
        const displayName = att.original_name || att.file_path.split('/').pop();

        if (isImage) {
            html += `
                <div class="attachment-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border: 1px solid var(--glass-border); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                    <img src="${fullUrl}" alt="Attachment" style="width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--glass-border);">
                    <a href="${fullUrl}" target="_blank" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); text-decoration: none;">${escapeHTML(displayName)}</a>
                    <button class="btn btn-secondary btn-sm" onclick="deleteAttachment(${att.id})" title="Remove" style="border-color: var(--danger); color: var(--danger);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        } else {
            const ext = (att.file_path.split('.').pop() || 'file').toUpperCase();
            html += `
                <div class="attachment-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border: 1px solid var(--glass-border); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-file-arrow-down" style="color: var(--accent-primary); font-size: 1.25rem;"></i>
                    <a href="${fullUrl}" target="_blank" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary); text-decoration: none;">${escapeHTML(displayName)} <span style="color: var(--text-secondary); font-size: 0.75rem;">(${ext})</span></a>
                    <button class="btn btn-secondary btn-sm" onclick="deleteAttachment(${att.id})" title="Remove" style="border-color: var(--danger); color: var(--danger);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }
    });
    attachmentDisplay.innerHTML = html;
}

// Delete a single attachment from the current ticket
async function deleteAttachment(attachmentId) {
    if (!currentTicketId) return;
    if (!confirm('Remove this attachment? This cannot be undone.')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/tickets/${currentTicketId}/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showAlert('dashboardAlert', 'Attachment removed', 'success');
            // Refresh ticket data to update the modal list
            const t = await fetchSingleTicket(currentTicketId);
            if (t) renderAttachments(t.attachments || []);
        } else {
            showAlert('dashboardAlert', 'Failed to remove attachment', 'error');
        }
    } catch (error) {
        console.error('Error deleting attachment:', error);
        showAlert('dashboardAlert', 'Network error', 'error');
    }
}

// Fetch a single ticket from the current page data
function fetchSingleTicket(id) {
    const t = allTickets.find(x => x.id === id);
    return Promise.resolve(t || null);
}

function openCreateModal() {
    isEditMode = false;
    currentTicketId = null;

    document.getElementById('modalForm').reset();
    document.getElementById('modalTitleText').textContent = 'Create New Ticket';
    document.getElementById('modalPriority').value = 'Medium';
    document.getElementById('modalStatus').value = 'Open';

    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('saveBtn').textContent = 'Create Ticket';

    document.getElementById('attachmentSection').style.display = 'none';
    const newAttachmentSection = document.getElementById('newAttachmentSection');
    if (newAttachmentSection) newAttachmentSection.style.display = 'block';
    const addAttachmentsSection = document.getElementById('addAttachmentsSection');
    if (addAttachmentsSection) addAttachmentsSection.style.display = 'none';

    document.getElementById('ticketModal').classList.add('active');
}

function closeModal() {
    document.getElementById('ticketModal').classList.remove('active');
    currentTicketId = null;
}

// Handle Form Submission in Modal
const modalForm = document.getElementById('modalForm');
if (modalForm) {
    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const url = isEditMode ? `${API_URL}/tickets/${currentTicketId}` : `${API_URL}/tickets`;
        
        let fetchOptions = {};

        if (isEditMode) {
            // Edit updates ticket fields only (JSON). Attachments are added separately.
            const data = {
                name: document.getElementById('modalName').value,
                department: document.getElementById('modalDepartment').value,
                priority: document.getElementById('modalPriority').value,
                title: document.getElementById('modalTitleInput').value,
                description: document.getElementById('modalDescriptionInput').value,
                status: document.getElementById('modalStatus').value
            };
            fetchOptions = {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            };
        } else {
            const formData = new FormData();
            formData.append('name', document.getElementById('modalName').value);
            formData.append('email', document.getElementById('modalEmail').value);
            formData.append('department', document.getElementById('modalDepartment').value);
            formData.append('priority', document.getElementById('modalPriority').value);
            formData.append('title', document.getElementById('modalTitleInput').value);
            formData.append('description', document.getElementById('modalDescriptionInput').value);
            formData.append('status', document.getElementById('modalStatus').value);

            const files = document.getElementById('modalAttachmentInput').files;
            for (const file of files) {
                formData.append('attachments', file);
            }

            fetchOptions = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            };
        }

        try {
            const response = await fetch(url, fetchOptions);

            if (response.ok) {
                closeModal();
                fetchTickets();
                showAlert('dashboardAlert', `Ticket ${isEditMode ? 'updated' : 'created'} successfully`, 'success');
            } else {
                const err = await response.json();
                showAlert('dashboardAlert', err.error || err.message || 'Operation failed', 'error');
            }
        } catch (error) {
            console.error('Error saving ticket:', error);
            showAlert('dashboardAlert', 'Network error', 'error');
        }
    });
}

// Add selected attachments to an existing ticket (edit mode)
const addAttachmentsBtn = document.getElementById('addAttachmentsBtn');
if (addAttachmentsBtn) {
    addAttachmentsBtn.addEventListener('click', async () => {
        if (!currentTicketId) return;
        const fileInput = document.getElementById('modalAttachmentInput');
        const files = fileInput ? fileInput.files : [];
        if (!files.length) {
            showAlert('dashboardAlert', 'Select at least one file to add', 'error');
            return;
        }

        const token = localStorage.getItem('token');
        const btn = addAttachmentsBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Adding...';
        btn.disabled = true;

        const formData = new FormData();
        for (const file of files) {
            formData.append('attachments', file);
        }

        try {
            const response = await fetch(`${API_URL}/tickets/${currentTicketId}/attachments`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                showAlert('dashboardAlert', `${result.message || 'Attachments added'}`, 'success');
                // Update the modal attachment list with the new full set
                renderAttachments(result.attachments || []);
                const attachmentSection = document.getElementById('attachmentSection');
                if (attachmentSection && result.attachments && result.attachments.length > 0) {
                    attachmentSection.style.display = 'block';
                }
                if (fileInput) fileInput.value = '';
                fetchTickets(currentPage);
            } else {
                const err = await response.json();
                showAlert('dashboardAlert', err.error || 'Failed to add attachments', 'error');
            }
        } catch (error) {
            console.error('Error adding attachments:', error);
            showAlert('dashboardAlert', 'Network error', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

async function deleteTicket() {
    if (!currentTicketId) return;
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) return;

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/tickets/${currentTicketId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            closeModal();
            fetchTickets();
            showAlert('dashboardAlert', `Ticket #${currentTicketId} deleted`, 'success');
        } else {
            showAlert('dashboardAlert', 'Failed to delete ticket', 'error');
        }
    } catch (error) {
        console.error('Error deleting ticket:', error);
        showAlert('dashboardAlert', 'Network error', 'error');
    }
}

// ---------------------------------------------------------
// Reminder Modal Logic
// ---------------------------------------------------------
let currentReminderTicket = null;

// Convert a UTC "YYYY-MM-DD HH:MM:SS" string to a local datetime-local value
function utcToLocalInputValue(utcString) {
    if (!utcString) return '';
    const d = new Date(utcString.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatReminderDate(utcString) {
    if (!utcString) return '';
    return new Date(utcString.replace(' ', 'T') + 'Z').toLocaleString();
}

function openReminderModal(ticket) {
    currentReminderTicket = ticket;
    document.getElementById('reminderTitle').textContent = `Set Reminder - Ticket #${ticket.id}`;
    document.getElementById('reminderTicketInfo').textContent = `#${ticket.id} - ${ticket.title}`;
    document.getElementById('reminderForm').reset();
    document.getElementById('reminderDatetime').value = '';
    document.getElementById('reminderEmail').value = '';
    document.getElementById('reminderAlert').style.display = 'none';
    document.getElementById('reminderModal').classList.add('active');
    loadReminders(ticket.id);
}

function closeReminderModal() {
    document.getElementById('reminderModal').classList.remove('active');
    currentReminderTicket = null;
}

async function loadReminders(ticketId) {
    const token = localStorage.getItem('token');
    const listEl = document.getElementById('reminderList');

    try {
        const response = await fetch(`${API_URL}/reminders/ticket/${ticketId}?_=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to load reminders');

        const data = await response.json();
        renderReminders(data.reminders || []);
    } catch (error) {
        console.error('Error loading reminders:', error);
        if (listEl) listEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">Failed to load reminders.</p>';
    }
}

function renderReminders(reminders) {
    const listEl = document.getElementById('reminderList');
    if (!listEl) return;

    if (!reminders.length) {
        listEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No reminders set for this ticket.</p>';
        return;
    }

    let html = '';
    reminders.forEach(r => {
        const sentBadge = r.sent === 1
            ? '<span class="badge badge-resolved">Sent</span>'
            : '<span class="badge badge-open">Pending</span>';
        html += `
        <div class="attachment-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border: 1px solid var(--glass-border); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
            <i class="fa-solid fa-bell" style="color: var(--warning); font-size: 1.1rem;"></i>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; font-size: 0.9rem;">${formatReminderDate(r.remind_at)}</div>
                <div style="color: var(--text-secondary); font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(r.email || '')}</div>
            </div>
            ${sentBadge}
            <button class="btn btn-secondary btn-sm" onclick="deleteReminder(${r.id})" title="Remove" style="border-color: var(--danger); color: var(--danger);">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>`;
    });
    listEl.innerHTML = html;
}

async function deleteReminder(reminderId) {
    if (!confirm('Remove this reminder?')) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/reminders/${reminderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showAlert('reminderAlert', 'Reminder removed', 'success');
            if (currentReminderTicket) loadReminders(currentReminderTicket.id);
        } else {
            showAlert('reminderAlert', 'Failed to remove reminder', 'error');
        }
    } catch (error) {
        console.error('Error deleting reminder:', error);
        showAlert('reminderAlert', 'Network error', 'error');
    }
}

const reminderForm = document.getElementById('reminderForm');
if (reminderForm) {
    reminderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentReminderTicket) return;

        const remindAtRaw = document.getElementById('reminderDatetime').value;
        if (!remindAtRaw) {
            showAlert('reminderAlert', 'Please choose a reminder date and time', 'error');
            return;
        }
        const remindAt = new Date(remindAtRaw).toISOString();

        const email = document.getElementById('reminderEmail').value.trim();

        const token = localStorage.getItem('token');
        const btn = document.getElementById('saveReminderBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/reminders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ticketId: currentReminderTicket.id, remindAt, email })
            });

            const result = await response.json();
            if (response.ok) {
                showAlert('reminderAlert', `Reminder set for ${formatReminderDate(result.remindAt)}`, 'success');
                document.getElementById('reminderDatetime').value = '';
                document.getElementById('reminderEmail').value = '';
                loadReminders(currentReminderTicket.id);
            } else {
                showAlert('reminderAlert', result.error || 'Failed to set reminder', 'error');
            }
        } catch (error) {
            console.error('Error setting reminder:', error);
            showAlert('reminderAlert', 'Network error', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// Password Modal Logic
function openPasswordModal() {
    document.getElementById('passwordForm').reset();
    document.getElementById('passwordModal').classList.add('active');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

const passwordForm = document.getElementById('passwordForm');
if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            showAlert('passwordAlert', 'New passwords do not match', 'error');
            return;
        }

        const token = localStorage.getItem('token');
        const btn = passwordForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Changing...';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const result = await response.json();
            if (response.ok) {
                closePasswordModal();
                showAlert('dashboardAlert', 'Password changed successfully', 'success');
            } else {
                showAlert('passwordAlert', result.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showAlert('passwordAlert', 'Network error. Please try again.', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
