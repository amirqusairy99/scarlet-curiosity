const API_URL = 'http://10.214.239.142:3000/api';

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
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'block';
    setTimeout(() => {
        alertEl.style.display = 'none';
    }, 5000);
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

        const data = {
            name: document.getElementById('name').value,
            department: document.getElementById('department').value,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value
        };

        try {
            const response = await fetch(`${API_URL}/tickets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                showAlert('submitAlert', `Success! Your ticket #${result.ticketId} has been submitted.`, 'success');
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

        const tickets = await response.json();
        loading.style.display = 'none';

        if (tickets.length === 0) {
            empty.style.display = 'block';
            return;
        }

        tickets.forEach(ticket => {
            let badgeClass = 'badge-open';
            if (ticket.status === 'In Progress') badgeClass = 'badge-progress';
            else if (ticket.status === 'Resolved') badgeClass = 'badge-resolved';

            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td style="color: var(--text-secondary); font-family: monospace;">#${ticket.id}</td>
        <td style="font-weight: 500;">${escapeHTML(ticket.name)}</td>
        <td><span style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">${escapeHTML(ticket.department)}</span></td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(ticket.title)}</td>
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
    } catch (error) {
        console.error('Error fetching tickets:', error);
        loading.style.display = 'none';
        showAlert('dashboardAlert', 'Failed to fetch tickets. Check console or try logging in again.', 'error');
    }
}

// Modal Logic
function openEditModal(ticket) {
    isEditMode = true;
    currentTicketId = ticket.id;

    document.getElementById('modalTitleText').textContent = `Edit Ticket #${ticket.id}`;
    document.getElementById('modalName').value = ticket.name;
    document.getElementById('modalDepartment').value = ticket.department;
    document.getElementById('modalTitleInput').value = ticket.title;
    document.getElementById('modalDescriptionInput').value = ticket.description;
    document.getElementById('modalStatus').value = ticket.status;

    document.getElementById('deleteBtn').style.display = 'block';
    document.getElementById('saveBtn').textContent = 'Save Changes';

    document.getElementById('ticketModal').classList.add('active');
}

function openCreateModal() {
    isEditMode = false;
    currentTicketId = null;

    document.getElementById('modalForm').reset();
    document.getElementById('modalTitleText').textContent = 'Create New Ticket';
    document.getElementById('modalStatus').value = 'Open';

    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('saveBtn').textContent = 'Create Ticket';

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
        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode ? `${API_URL}/tickets/${currentTicketId}` : `${API_URL}/tickets`;

        const data = {
            name: document.getElementById('modalName').value,
            department: document.getElementById('modalDepartment').value,
            title: document.getElementById('modalTitleInput').value,
            description: document.getElementById('modalDescriptionInput').value,
            status: document.getElementById('modalStatus').value
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

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
