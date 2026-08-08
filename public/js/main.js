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

        const attachment = document.getElementById('attachment').files[0];
        if (attachment) {
            formData.append('attachment', attachment);
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
                window.location.href = 'dashboard.html';
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

async function fetchTickets() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const tbody = document.getElementById('ticketsTableBody');
    const loading = document.getElementById('loadingIndicator');
    const empty = document.getElementById('emptyState');

    if (!tbody) return;

    tbody.innerHTML = '';
    loading.style.display = 'block';
    empty.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/tickets`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        allTickets = await response.json();
        loading.style.display = 'none';

        let openCount = 0;
        let progressCount = 0;
        let resolvedCount = 0;

        allTickets.forEach(ticket => {
            if (ticket.status === 'Open') openCount++;
            else if (ticket.status === 'In Progress') progressCount++;
            else if (ticket.status === 'Resolved') resolvedCount++;
        });

        const summaryTotalEl = document.getElementById('summaryTotal');
        const summaryOpenEl = document.getElementById('summaryOpen');
        const summaryProgressEl = document.getElementById('summaryProgress');
        const summaryResolvedEl = document.getElementById('summaryResolved');

        if (summaryTotalEl) summaryTotalEl.textContent = allTickets.length;
        if (summaryOpenEl) summaryOpenEl.textContent = openCount;
        if (summaryProgressEl) summaryProgressEl.textContent = progressCount;
        if (summaryResolvedEl) summaryResolvedEl.textContent = resolvedCount;

        renderTickets(allTickets);
        syncSearchUI();
    } catch (error) {
        console.error('Error fetching tickets:', error);
        loading.style.display = 'none';
        showAlert('dashboardAlert', 'Failed to fetch tickets. Check console or try logging in again.', 'error');
    }
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
          <button class="btn btn-secondary btn-sm" onclick='openEditModal(${JSON.stringify(ticket).replace(/'/g, "&apos;")})'>
            View/Edit
          </button>
        </td>
      `;
        tbody.appendChild(tr);
    });
}

function filterTickets() {
    const query = (document.getElementById('ticketSearch')?.value || '').trim().toLowerCase();
    if (!query) {
        renderTickets(allTickets);
        syncSearchUI();
        return;
    }

    const filtered = allTickets.filter(ticket => {
        return (
            String(ticket.id).toLowerCase().includes(query) ||
            (ticket.name || '').toLowerCase().includes(query) ||
            (ticket.email || '').toLowerCase().includes(query) ||
            (ticket.department || '').toLowerCase().includes(query) ||
            (ticket.title || '').toLowerCase().includes(query) ||
            (ticket.description || '').toLowerCase().includes(query) ||
            (ticket.priority || '').toLowerCase().includes(query) ||
            (ticket.status || '').toLowerCase().includes(query)
        );
    });

    renderTickets(filtered);
    syncSearchUI();
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
    renderTickets(allTickets);
    syncSearchUI();
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
    
    // Hide new attachment input during edit
    const newAttachmentSection = document.getElementById('newAttachmentSection');
    if (newAttachmentSection) newAttachmentSection.style.display = 'none';

    // Handle Attachment Display
    const attachmentSection = document.getElementById('attachmentSection');
    const attachmentDisplay = document.getElementById('attachmentDisplay');

    if (ticket.attachment_path) {
        attachmentSection.style.display = 'block';
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(ticket.attachment_path);
        const fullUrl = `${API_URL.replace('/api', '')}${ticket.attachment_path}`;

        if (isImage) {
            attachmentDisplay.innerHTML = `
                <a href="${fullUrl}" target="_blank" class="attachment-preview-container">
                    <img src="${fullUrl}" alt="Attachment Preview" style="max-width: 100%; border-radius: var(--radius-md); border: 1px solid var(--glass-border); margin-bottom: 0.5rem; display: block;">
                    <span class="btn btn-secondary btn-sm"><i class="fa-solid fa-up-right-from-square"></i> View Full Image</span>
                </a>
            `;
        } else {
            attachmentDisplay.innerHTML = `
                <a href="${fullUrl}" target="_blank" class="btn btn-secondary">
                    <i class="fa-solid fa-file-arrow-down"></i> Download Attachment (${ticket.attachment_path.split('.').pop().toUpperCase()})
                </a>
            `;
        }
    } else {
        attachmentSection.style.display = 'none';
        attachmentDisplay.innerHTML = '';
    }

    document.getElementById('ticketModal').classList.add('active');
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
            
            const attachment = document.getElementById('modalAttachmentInput').files[0];
            if (attachment) {
                formData.append('attachment', attachment);
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
