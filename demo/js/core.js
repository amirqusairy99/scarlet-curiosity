// ---------------------------------------------------------------------------
// Demo core: localStorage-backed storage, seed data, auth, and shared utils.
// This runs entirely in the browser (no backend) so it works on Cloudflare Pages.
// ---------------------------------------------------------------------------

const DemoStore = {
  KEYS: {
    tickets: 'demo_tickets',
    users: 'demo_users',
    session: 'demo_session',
    theme: 'theme',
    seeded: 'demo_seeded_v1'
  },

  get(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); }
};

// ---------------- Seed data ----------------
const seedTitles = [
  'Cannot access company VPN after update',
  'Email not syncing on Outlook',
  'Printer in meeting room offline',
  'Slow internet connection',
  'Laptop not charging properly',
  'Software installation request',
  'Password reset request',
  'Access to shared drive denied',
  'Video call audio issues',
  'New employee workstation setup',
  'Database query performance issue',
  'License renewal for design tools',
  'Additional monitor requested',
  'CRM system access request',
  'Email signature not displaying'
];

const departments = ['Development', 'Support', 'HR', 'MIS', 'BA', 'Marketing', 'Finance'];
const statuses = ['Open', 'In Progress', 'Resolved'];
const priorities = ['Low', 'Medium', 'High'];

const firstNames = ['Nurul', 'Fatin', 'Muhammad', 'Siti', 'Daniel', 'Aminah', 'Hafiz', 'Kavitha', 'Lee', 'Norazlina', 'Faizal', 'Priya', 'Azlan', 'Rachel', 'Syafiq', 'Wan', 'Melissa', 'Rizal'];
const lastNames = ['Aisyah', 'Hazwani', 'Izzat', 'Mariam', 'Tan', 'Razak', 'Nordin', 'Menon', 'Chong Wei', 'Ismail', 'Omar', 'Krishnan', 'Shah', 'Lim', 'Rahman', 'Ahmad', 'Goh', 'Fadzil'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomToken() {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function generateSeedTickets(count = 120) {
  const tickets = [];
  for (let i = 0; i < count; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const name = `${first} ${last}`;
    const email = (name.toLowerCase().replace(/[^a-z0-9]/g, '.')) + '@infoconnect.com.my';
    const dept = pick(departments);
    const status = pick(statuses);
    const priority = pick(priorities);
    const title = pick(seedTitles);
    tickets.push({
      id: i + 1,
      name,
      email,
      department: dept,
      title,
      description: `Reported by ${name} (${dept}): ${title}. This is a demo ticket to showcase the dashboard, search and pagination features.`,
      priority,
      status,
      attachments: i % 7 === 0 ? [{ id: `${i + 1}-a1`, file_path: '', original_name: 'sample-report.pdf' }] : [],
      token: randomToken(),
      created_at: daysAgo(i % 120),
      updated_at: daysAgo(Math.max(i % 120 - 1, 0))
    });
  }
  // Ensure all 3 statuses are well represented
  return tickets;
}

function ensureSeed() {
  if (DemoStore.get(DemoStore.KEYS.tickets)) return;

  const users = [
    { id: 1, username: 'administrator', password: 'misdashboard9090', role: 'admin' },
    { id: 2, username: 'demo', password: 'demo1234', role: 'user' }
  ];
  DemoStore.set(DemoStore.KEYS.users, users);
  DemoStore.set(DemoStore.KEYS.tickets, generateSeedTickets(120));
  DemoStore.set(DemoStore.KEYS.seeded, true);
}

// ---------------- Auth ----------------
const DemoAuth = {
  login(username, password) {
    const users = DemoStore.get(DemoStore.KEYS.users) || [];
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return { ok: false, error: 'Invalid username or password' };
    const session = { username: user.username, role: user.role, loginAt: Date.now() };
    DemoStore.set(DemoStore.KEYS.session, session);
    return { ok: true, user: session };
  },
  session() { return DemoStore.get(DemoStore.KEYS.session); },
  logout() { DemoStore.remove(DemoStore.KEYS.session); },
  requireAuth() {
    if (!this.session()) { window.location.href = 'login.html'; return false; }
    return true;
  }
};

// ---------------- Ticket "API" ----------------
const DemoApi = {
  list({ page = 1, limit = 25, search = '' } = {}) {
    let tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    search = (search || '').trim().toLowerCase();

    if (search) {
      tickets = tickets.filter(t =>
        String(t.id).includes(search) ||
        (t.name || '').toLowerCase().includes(search) ||
        (t.email || '').toLowerCase().includes(search) ||
        (t.department || '').toLowerCase().includes(search) ||
        (t.title || '').toLowerCase().includes(search) ||
        (t.description || '').toLowerCase().includes(search) ||
        (t.priority || '').toLowerCase().includes(search) ||
        (t.status || '').toLowerCase().includes(search)
      );
    }

    tickets = tickets.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = tickets.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const start = (page - 1) * limit;
    const pageTickets = tickets.slice(start, start + limit);

    return {
      tickets: pageTickets,
      pagination: { page, limit, total, totalPages }
    };
  },

  getById(id) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    return tickets.find(t => t.id === id) || null;
  },

  getByToken(token) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    return tickets.find(t => t.token === token) || null;
  },

  create(data) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    const nextId = tickets.reduce((m, t) => Math.max(m, t.id), 0) + 1;
    const token = randomToken();
    const ticket = {
      id: nextId,
      name: data.name,
      email: data.email,
      department: data.department,
      title: data.title,
      description: data.description,
      priority: data.priority || 'Medium',
      status: data.status || 'Open',
      attachments: data.attachments || [],
      token,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    tickets.unshift(ticket);
    DemoStore.set(DemoStore.KEYS.tickets, tickets);
    return ticket;
  },

  update(id, data) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tickets[idx] = { ...tickets[idx], ...data, updated_at: new Date().toISOString() };
    DemoStore.set(DemoStore.KEYS.tickets, tickets);
    return tickets[idx];
  },

  delete(id) {
    let tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    tickets = tickets.filter(t => t.id !== id);
    DemoStore.set(DemoStore.KEYS.tickets, tickets);
  },

  addAttachments(id, files) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const existing = tickets[idx].attachments || [];
    let newId = 0;
    existing.forEach(a => { const n = parseInt(a.id, 10); if (!isNaN(n) && n > newId) newId = n; });
    const added = files.map(f => ({
      id: `${newId + 1}`,
      file_path: '',
      original_name: f.name
    }));
    tickets[idx].attachments = existing.concat(added);
    tickets[idx].updated_at = new Date().toISOString();
    DemoStore.set(DemoStore.KEYS.tickets, tickets);
    return tickets[idx].attachments;
  },

  deleteAttachment(id, attachmentId) {
    const tickets = DemoStore.get(DemoStore.KEYS.tickets) || [];
    const idx = tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tickets[idx].attachments = (tickets[idx].attachments || []).filter(a => a.id !== String(attachmentId));
    DemoStore.set(DemoStore.KEYS.tickets, tickets);
    return tickets[idx].attachments;
  }
};

// ---------------- Shared utils ----------------
function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showAlert(id, message, type = 'success') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = message;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 12000);
}

// Theme
function initTheme() {
  const saved = localStorage.getItem(DemoStore.KEYS.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  updateThemeIcon();
}
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(DemoStore.KEYS.theme, 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(DemoStore.KEYS.theme, 'dark');
  }
  updateThemeIcon();
}
function updateThemeIcon() {
  const icon = document.querySelector('#themeToggle i');
  if (!icon) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

document.addEventListener('DOMContentLoaded', () => {
  ensureSeed();
  initTheme();
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.addEventListener('click', toggleTheme);
});
