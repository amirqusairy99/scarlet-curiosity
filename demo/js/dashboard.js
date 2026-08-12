// Dashboard logic (demo)
let currentTicketId = null;
let isEditMode = false;
let allTickets = [];
let searchTerm = '';
let currentPage = 1;
const PAGE_SIZE = 25;

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  DemoAuth.logout();
  window.location.href = 'login.html';
});

function fetchTickets(page = currentPage) {
  currentPage = page;
  const tbody = document.getElementById('ticketsTableBody');
  const loading = document.getElementById('loadingIndicator');
  const empty = document.getElementById('emptyState');
  if (!tbody) return;

  tbody.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';

  const data = DemoApi.list({ page, limit: PAGE_SIZE, search: searchTerm });
  allTickets = data.tickets;
  loading.style.display = 'none';

  updateSummary(data.pagination.total);
  renderTickets(data.tickets);
  renderPagination(data.pagination);
  syncSearchUI();
}

function updateSummary(total) {
  document.getElementById('summaryTotal').textContent = total;
  const all = DemoStore.get(DemoStore.KEYS.tickets) || [];
  document.getElementById('summaryOpen').textContent = all.filter(t => t.status === 'Open').length;
  document.getElementById('summaryProgress').textContent = all.filter(t => t.status === 'In Progress').length;
  document.getElementById('summaryResolved').textContent = all.filter(t => t.status === 'Resolved').length;
}

function renderTickets(tickets) {
  const tbody = document.getElementById('ticketsTableBody');
  const empty = document.getElementById('emptyState');
  tbody.innerHTML = '';

  if (tickets.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tickets.forEach(ticket => {
    const badgeClass = ticket.status === 'In Progress' ? 'badge-progress' : (ticket.status === 'Resolved' ? 'badge-resolved' : 'badge-open');
    const priorityClass = ticket.priority === 'High' ? 'badge-high' : (ticket.priority === 'Low' ? 'badge-low' : 'badge-medium');
    const attIcon = (ticket.attachments && ticket.attachments.length) ? ' <i class="fa-solid fa-paperclip" title="has attachments" style="color: var(--text-secondary); font-size: 0.75rem;"></i>' : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: var(--text-secondary); font-family: monospace;">#${ticket.id}</td>
      <td style="font-weight: 500;">${escapeHTML(ticket.name)}${attIcon}</td>
      <td><span style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">${escapeHTML(ticket.department)}</span></td>
      <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(ticket.title)}</td>
      <td><span class="badge ${priorityClass}">${escapeHTML(ticket.priority)}</span></td>
      <td><span class="badge ${badgeClass}">${escapeHTML(ticket.status)}</span></td>
      <td style="color: var(--text-secondary); font-size: 0.875rem;">${formatDate(ticket.created_at)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick='openEditModal(${ticket.id})'>View/Edit</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPagination(pagination) {
  const container = document.getElementById('paginationControls');
  const { page, totalPages, total, limit } = pagination;

  if (total === 0) { container.innerHTML = ''; return; }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  let html = `<div class="pagination-info">Showing ${from}&ndash;${to} of ${total} tickets</div><div class="pagination-buttons">`;
  html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;

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

  html += `<button class="btn btn-secondary btn-sm" onclick="fetchTickets(${page + 1})" ${page >= totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
  html += `</div>`;
  container.innerHTML = html;
}

// Search
let searchDebounceTimer = null;
function filterTickets() {
  searchTerm = document.getElementById('ticketSearch').value.trim();
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => fetchTickets(1), 250);
}
function syncSearchUI() {
  document.getElementById('clearSearchBtn').style.display = document.getElementById('ticketSearch').value.trim() ? 'inline-flex' : 'none';
}
function clearSearch() {
  document.getElementById('ticketSearch').value = '';
  searchTerm = '';
  clearTimeout(searchDebounceTimer);
  fetchTickets(1);
}
document.getElementById('ticketSearch').addEventListener('input', filterTickets);

// Modal
function openEditModal(id) {
  const ticket = DemoApi.getById(id);
  if (!ticket) return;
  isEditMode = true;
  currentTicketId = id;

  document.getElementById('modalTitleText').textContent = `Edit Ticket #${id}`;
  document.getElementById('modalName').value = ticket.name;
  document.getElementById('modalEmail').value = ticket.email || '';
  document.getElementById('modalDepartment').value = ticket.department;
  document.getElementById('modalPriority').value = ticket.priority;
  document.getElementById('modalTitleInput').value = ticket.title;
  document.getElementById('modalDescriptionInput').value = ticket.description;
  document.getElementById('modalStatus').value = ticket.status;

  document.getElementById('saveBtn').textContent = 'Save Changes';
  document.getElementById('deleteBtn').style.display = 'inline-flex';

  document.getElementById('newAttachmentSection').style.display = 'block';
  document.getElementById('addAttachmentsSection').style.display = 'block';
  document.getElementById('modalAttachmentInput').value = '';

  renderAttachments(ticket.attachments || []);
  document.getElementById('attachmentSection').style.display = (ticket.attachments && ticket.attachments.length) ? 'block' : 'none';

  document.getElementById('ticketModal').classList.add('active');
}

function openCreateModal() {
  isEditMode = false;
  currentTicketId = null;
  document.getElementById('modalForm').reset();
  document.getElementById('modalTitleText').textContent = 'Create New Ticket';
  document.getElementById('modalPriority').value = 'Medium';
  document.getElementById('modalStatus').value = 'Open';
  document.getElementById('saveBtn').textContent = 'Create Ticket';
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('attachmentSection').style.display = 'none';
  document.getElementById('addAttachmentsSection').style.display = 'none';
  document.getElementById('newAttachmentSection').style.display = 'block';
  renderAttachments([]);
  document.getElementById('ticketModal').classList.add('active');
}

function closeModal() {
  document.getElementById('ticketModal').classList.remove('active');
  currentTicketId = null;
}

function renderAttachments(attachments) {
  const display = document.getElementById('attachmentDisplay');
  if (!attachments || attachments.length === 0) {
    display.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No attachments on this ticket.</p>';
    return;
  }
  display.innerHTML = attachments.map(att => {
    const name = att.original_name || att.file_path.split('/').pop() || 'file';
    const ext = (name.split('.').pop() || 'file').toUpperCase();
    return `
      <div class="attachment-item">
        <i class="fa-solid fa-file-arrow-down" style="color: var(--accent-primary); font-size: 1.25rem;"></i>
        <span class="name">${escapeHTML(name)} <span style="color: var(--text-secondary); font-size: 0.75rem;">(${ext})</span></span>
        <button class="btn btn-secondary btn-sm" onclick="deleteAttachment(${att.id})" title="Remove" style="border-color: var(--danger); color: var(--danger);"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
  }).join('');
}

// Form submit
document.getElementById('modalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    name: document.getElementById('modalName').value,
    email: document.getElementById('modalEmail').value,
    department: document.getElementById('modalDepartment').value,
    priority: document.getElementById('modalPriority').value,
    title: document.getElementById('modalTitleInput').value,
    description: document.getElementById('modalDescriptionInput').value,
    status: document.getElementById('modalStatus').value
  };

  if (isEditMode) {
    DemoApi.update(currentTicketId, data);
    showAlert('dashboardAlert', 'Ticket updated successfully', 'success');
  } else {
    const files = Array.from(document.getElementById('modalAttachmentInput').files || []).map(f => ({
      id: String(Date.now()) + '-' + f.name, file_path: '', original_name: f.name
    }));
    data.attachments = files;
    DemoApi.create(data);
    showAlert('dashboardAlert', 'Ticket created successfully', 'success');
  }
  closeModal();
  fetchTickets();
});

// Add attachments (edit mode)
document.getElementById('addAttachmentsBtn').addEventListener('click', () => {
  if (!currentTicketId) return;
  const files = Array.from(document.getElementById('modalAttachmentInput').files || []);
  if (!files.length) { showAlert('dashboardAlert', 'Select at least one file', 'error'); return; }
  const names = files.map(f => ({ name: f.name }));
  DemoApi.addAttachments(currentTicketId, names);
  const updated = DemoApi.getById(currentTicketId);
  renderAttachments(updated.attachments || []);
  document.getElementById('attachmentSection').style.display = 'block';
  document.getElementById('modalAttachmentInput').value = '';
  showAlert('dashboardAlert', 'Attachments added', 'success');
  fetchTickets();
});

// Delete attachment
function deleteAttachment(attachmentId) {
  if (!currentTicketId) return;
  if (!confirm('Remove this attachment?')) return;
  DemoApi.deleteAttachment(currentTicketId, attachmentId);
  const updated = DemoApi.getById(currentTicketId);
  renderAttachments(updated.attachments || []);
  document.getElementById('attachmentSection').style.display = (updated.attachments && updated.attachments.length) ? 'block' : 'none';
  showAlert('dashboardAlert', 'Attachment removed', 'success');
  fetchTickets();
}

// Delete ticket
function deleteTicket() {
  if (!currentTicketId) return;
  if (!confirm('Delete this ticket? This cannot be undone.')) return;
  DemoApi.delete(currentTicketId);
  closeModal();
  showAlert('dashboardAlert', `Ticket #${currentTicketId} deleted`, 'success');
  fetchTickets();
}
