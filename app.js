// ===== AUTH — Login Gate =====
const Auth = {
  CREDENTIALS: { username: 'Adminfoji', password: 'Pwdgoji@0300' },
  SESSION_KEY: 'fg_auth_session',

  isLoggedIn() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'ok';
  },

  login(username, password) {
    if (username === this.CREDENTIALS.username && password === this.CREDENTIALS.password) {
      sessionStorage.setItem(this.SESSION_KEY, 'ok');
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  showLoginScreen() {
    document.body.innerHTML = `
      <div class="login-overlay" id="loginOverlay">
        <div class="login-box">
          <div class="login-brand">
            <span class="login-brand-icon">⛽</span>
            <div class="login-brand-name">FOJI GAS</div>
            <div class="login-brand-sub">Shop Management</div>
          </div>
          <div class="login-form-group">
            <label>Username</label>
            <input type="text" id="login_user" placeholder="Enter username" autocomplete="username" />
          </div>
          <div class="login-form-group">
            <label>Password</label>
            <input type="password" id="login_pass" placeholder="Enter password" autocomplete="current-password" />
          </div>
          <button class="login-btn" onclick="Auth.attemptLogin()">🔐 Login</button>
          <div class="login-error" id="loginError">❌ Invalid username or password</div>
        </div>
      </div>
    `;

    // Allow Enter key to submit
    document.getElementById('login_pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') Auth.attemptLogin();
    });
    document.getElementById('login_user').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('login_pass').focus();
    });
  },

  attemptLogin() {
    const user = document.getElementById('login_user').value.trim();
    const pass = document.getElementById('login_pass').value;
    if (Auth.login(user, pass)) {
      location.reload();
    } else {
      const err = document.getElementById('loginError');
      err.classList.add('show');
      document.getElementById('login_pass').value = '';
      document.getElementById('login_pass').focus();
      setTimeout(() => err.classList.remove('show'), 3000);
    }
  }
};

// ===== BOOT — Check auth before anything =====
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) {
    Auth.showLoginScreen();
    return; // stop — don't run App.init()
  }
  App.init();
});

// ===== FOJI GAS — APP v3 =====

const App = {
  currentPage: 'dashboard',

  init() {
    this.setDate();
    this.bindNav();
    this.bindModal();
    this.bindMenuToggle();
    this.navigate('dashboard');
    this.initSyncBadge();
  },

  setDate() {
    const opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    document.getElementById('todayDate').textContent = new Date().toLocaleDateString('en-PK', opts);
  },

  bindNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const page = link.dataset.page;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        this.navigate(page);
        document.getElementById('sidebar').classList.remove('open');
      });
    });
  },

  bindMenuToggle() {
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  },

  bindModal() {
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modalOverlay')) this.closeModal();
    });
  },

  navigate(page) {
    this.currentPage = page;
    const titles = {
      dashboard: 'Dashboard', stock: 'Cylinder Stock', sales: 'LPG Sales',
      parts: 'Parts Sales', expenses: 'Expenses', prevmonth: 'Previous Month Entry',
      reports: 'Reports & Analytics', history: 'Transaction History',
      cylinders: 'Cylinder Inventory', sync: 'Cloud Sync'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    const renderers = {
      dashboard: () => this.renderDashboard(), stock: () => this.renderStock(),
      sales: () => this.renderSales(), parts: () => this.renderParts(),
      expenses: () => this.renderExpenses(), prevmonth: () => this.renderPrevMonth(),
      reports: () => this.renderReports(), history: () => this.renderHistory(),
      cylinders: () => this.renderCylinders(), sync: () => this.renderSync()
    };
    if (renderers[page]) renderers[page]();
  },

  openModal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    this.navigate(this.currentPage);
  },

  setContent(html) { document.getElementById('content').innerHTML = html; },

  // ======================== SYNC BADGE ========================
  initSyncBadge() {
    const code = DB.Sync.getSyncCode();
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    if (code) {
      badge.textContent = '☁ Synced';
      badge.className = 'sync-badge synced';
    } else {
      badge.textContent = '☁ Sync';
      badge.className = 'sync-badge';
    }
    badge.onclick = () => this.navigate('sync');
  },

  // ======================== DASHBOARD ========================
  renderDashboard() {
    const today = DB.today();
    const { year, month } = DB.nowYM();
    const todaySales = DB.Sales.getByDate(today);
    const todayParts = DB.Parts.getByDate(today);
    const monthSales = DB.Sales.getByMonth(year, month);
    const monthParts = DB.Parts.getByMonth(year, month);
    const yearSales = DB.Sales.getByYear(year);
    const yearParts = DB.Parts.getByYear(year);
    const monthExp = DB.Expenses.getByMonth(year, month);

    const todaySalesAmt = DB.sum(todaySales, 'amount');
    const todayPartsAmt = DB.sum(todayParts, 'amount');
    const todaySalesCost = DB.sum(todaySales, 'cost');
    const todayPartsCost = DB.sum(todayParts, 'cost');
    const todayLpgKg = DB.sum(todaySales, 'qty_kg');
    const todayLpgProfit = todaySalesAmt - todaySalesCost;
    const todayProfitPerKg = todayLpgKg > 0 ? todayLpgProfit / todayLpgKg : 0;
    const todayPartsProfit = todayPartsAmt - todayPartsCost;

    const monthSalesAmt = DB.sum(monthSales, 'amount');
    const monthPartsAmt = DB.sum(monthParts, 'amount');
    const monthExpAmt = DB.sum(monthExp, 'amount');
    const monthTurnover = monthSalesAmt + monthPartsAmt;
    const monthLpgKg = DB.sum(monthSales, 'qty_kg');
    const monthLpgCost = DB.sum(monthSales, 'cost');
    const monthPartsCost = DB.sum(monthParts, 'cost');
    const monthLpgProfit = monthSalesAmt - monthLpgCost;
    const monthPartsProfit = monthPartsAmt - monthPartsCost;
    const monthProfitPerKg = monthLpgKg > 0 ? monthLpgProfit / monthLpgKg : 0;
    const yearTurnover = DB.sum(yearSales, 'amount') + DB.sum(yearParts, 'amount');
    const stock = DB.Stock.getOrInit();
    const prevMonths = DB.PrevMonth.getAll();
    const prevTotal = DB.sum(prevMonths, 'turnover');

    this.setContent(`
      <div class="stats-grid">
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">12kg Cylinders</div><div class="stat-value">${stock.cyl_12kg}</div><div class="stat-unit">in stock</div><div class="stat-icon">🛢️</div>
        </div>
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">45kg Cylinders</div><div class="stat-value">${stock.cyl_45kg}</div><div class="stat-unit">in stock</div><div class="stat-icon">⛽</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Gas Stock (kg)</div><div class="stat-value">${DB.fmt(stock.gas_kg)}</div><div class="stat-unit">kilograms</div><div class="stat-icon">💨</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Today LPG Sold</div><div class="stat-value">${DB.fmt(todayLpgKg)}</div><div class="stat-unit">kg today</div><div class="stat-icon">📦</div>
        </div>
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">Today LPG Revenue</div><div class="stat-value">₨${DB.fmt(todaySalesAmt)}</div><div class="stat-unit">earning</div><div class="stat-icon">💰</div>
        </div>
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">Today Parts Revenue</div><div class="stat-value">₨${DB.fmt(todayPartsAmt)}</div><div class="stat-unit">parts & accessories</div><div class="stat-icon">🔧</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Today LPG Profit</div>
          <div class="stat-value" style="color:${todayLpgProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayLpgProfit)}</div>
          <div class="stat-unit">₨${DB.fmt(todayProfitPerKg)}/kg profit</div><div class="stat-icon">📈</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Today Parts Profit</div>
          <div class="stat-value" style="color:${todayPartsProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayPartsProfit)}</div>
          <div class="stat-unit">after cost</div><div class="stat-icon">🔩</div>
        </div>
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">Monthly Gas Sold</div><div class="stat-value">${DB.fmt(monthLpgKg)}</div><div class="stat-unit">kg this month</div><div class="stat-icon">🔥</div>
        </div>
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">Monthly Turnover</div><div class="stat-value">₨${DB.fmt(monthTurnover)}</div><div class="stat-unit">LPG + Parts</div><div class="stat-icon">📅</div>
        </div>
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">Monthly Expenses</div><div class="stat-value">₨${DB.fmt(monthExpAmt)}</div><div class="stat-unit">this month</div><div class="stat-icon">🧾</div>
        </div>
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">Yearly Turnover</div><div class="stat-value">₨${DB.fmt(yearTurnover)}</div><div class="stat-unit">year ${year}</div><div class="stat-icon">🏆</div>
        </div>
      </div>

      <div class="grid-2" style="margin-top:20px">
        <div class="panel">
          <div class="panel-title">📅 Today Summary</div>
          <div class="profit-row"><span>LPG Revenue</span><span class="profit-amount">₨${DB.fmt(todaySalesAmt)}</span></div>
          <div class="profit-row"><span>LPG Cost</span><span style="color:var(--red)">₨${DB.fmt(todaySalesCost)}</span></div>
          <div class="profit-row"><span>LPG Profit</span><span style="color:${todayLpgProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayLpgProfit)}</span></div>
          <div class="profit-row"><span>Profit/kg</span><span style="color:var(--yellow)">₨${DB.fmt(todayProfitPerKg)}/kg</span></div>
          <div class="profit-row"><span>Parts Revenue</span><span class="profit-amount">₨${DB.fmt(todayPartsAmt)}</span></div>
          <div class="profit-row"><span>Parts Profit</span><span style="color:${todayPartsProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayPartsProfit)}</span></div>
          <div class="profit-row" style="border-top:2px solid var(--flame);margin-top:6px;padding-top:12px">
            <span><strong>Total Today</strong></span>
            <span style="font-family:'Bebas Neue';font-size:20px;color:var(--flame)">₨${DB.fmt(todaySalesAmt+todayPartsAmt)}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">📊 This Month</div>
          <div class="profit-row"><span>Gas Sold</span><span style="color:var(--yellow)">${DB.fmt(monthLpgKg)} kg</span></div>
          <div class="profit-row"><span>LPG Revenue</span><span class="profit-amount">₨${DB.fmt(monthSalesAmt)}</span></div>
          <div class="profit-row"><span>LPG Profit</span><span style="color:${monthLpgProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(monthLpgProfit)}</span></div>
          <div class="profit-row"><span>Avg Profit/kg</span><span style="color:var(--yellow)">₨${DB.fmt(monthProfitPerKg)}/kg</span></div>
          <div class="profit-row"><span>Parts Revenue</span><span class="profit-amount">₨${DB.fmt(monthPartsAmt)}</span></div>
          <div class="profit-row"><span>Parts Profit</span><span style="color:${monthPartsProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(monthPartsProfit)}</span></div>
          <div class="profit-row"><span>Expenses</span><span style="color:var(--red)">₨${DB.fmt(monthExpAmt)}</span></div>
          <div class="profit-row" style="border-top:2px solid var(--flame);margin-top:6px;padding-top:12px">
            <span><strong>Net This Month</strong></span>
            <span style="font-family:'Bebas Neue';font-size:20px;color:var(--flame)">₨${DB.fmt(monthTurnover)}</span>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:20px">
        <div class="panel-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>📁 Previous Month Records</span>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('prevmonth')">+ Add / View</button>
        </div>
        ${prevMonths.length ? `
          <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">
            <thead><tr>
              <th style="text-align:left;padding:6px 10px;color:var(--flame-light);font-size:11px">Month</th>
              <th style="text-align:left;padding:6px 10px;color:var(--flame-light);font-size:11px">LPG</th>
              <th style="text-align:left;padding:6px 10px;color:var(--flame-light);font-size:11px">Parts</th>
              <th style="text-align:left;padding:6px 10px;color:var(--flame-light);font-size:11px">Expenses</th>
              <th style="text-align:left;padding:6px 10px;color:var(--flame-light);font-size:11px">Total</th>
            </tr></thead>
            <tbody>
              ${prevMonths.slice(0,5).map(r=>`
                <tr>
                  <td style="padding:6px 10px;border-top:1px solid var(--border)">${r.month_label}</td>
                  <td style="padding:6px 10px;border-top:1px solid var(--border)">₨${DB.fmt(r.lpg_turnover||0)}</td>
                  <td style="padding:6px 10px;border-top:1px solid var(--border)">₨${DB.fmt(r.parts_turnover||0)}</td>
                  <td style="padding:6px 10px;border-top:1px solid var(--border);color:var(--red)">₨${DB.fmt(r.expenses||0)}</td>
                  <td style="padding:6px 10px;border-top:1px solid var(--border);color:var(--flame)">₨${DB.fmt(r.turnover||0)}</td>
                </tr>`).join('')}
            </tbody>
          </table></div>
          <div class="profit-row" style="border-top:2px solid var(--flame);margin-top:10px;padding-top:10px">
            <span>All Previous Months Total</span>
            <span style="color:var(--flame);font-weight:700">₨${DB.fmt(prevTotal)}</span>
          </div>
        ` : `<div class="empty-state" style="padding:16px">No previous month records. <a href="#" onclick="App.navigate('prevmonth')" style="color:var(--flame)">Add now →</a></div>`}
      </div>

      <div style="margin-top:20px" class="section-header"><div class="section-title">Recent Transactions</div></div>
      ${this.recentTransactions()}
    `);
  },

  recentTransactions() {
    const sales = DB.Sales.getAll().slice(0,5);
    const parts = DB.Parts.getAll().slice(0,5);
    const combined = [...sales.map(r=>({...r,_type:'LPG'})),...parts.map(r=>({...r,_type:'Parts'}))]
      .sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
    if (!combined.length) return `<div class="empty-state"><div class="empty-icon">📭</div>No transactions yet. Start by adding a sale!</div>`;
    return `<div class="table-wrap" style="overflow-x:auto"><table>
      <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Qty(kg)</th><th>Revenue</th><th>Profit</th><th>₨/kg</th></tr></thead>
      <tbody>${combined.map(r=>{
        const profit=(r.amount||0)-(r.cost||0);
        const perKg=r.qty_kg>0?profit/r.qty_kg:null;
        return `<tr>
          <td>${r.date}</td>
          <td><span class="tag ${r._type==='LPG'?'tag-orange':'tag-green'}">${r._type}</span></td>
          <td>${r.description||r.item_name||'-'}</td>
          <td>${r.qty_kg?DB.fmt(r.qty_kg):'-'}</td>
          <td>₨${DB.fmt(r.amount)}</td>
          <td style="color:var(--green)">₨${DB.fmt(profit)}</td>
          <td style="color:var(--yellow)">${perKg!==null?'₨'+DB.fmt(perKg):'-'}</td>
        </tr>`}).join('')}</tbody>
    </table></div>`;
  },

  // ======================== STOCK ========================
  renderStock() {
    const stock = DB.Stock.getOrInit();
    const logs = DB.Stock.getLogs().slice(0,20);
    this.setContent(`
      <div class="section-header">
        <div class="section-title">Current Stock</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('cylinders')">🛢️ Cylinder List</button>
          <button class="btn btn-primary" onclick="App.openStockForm()">✏️ Update Stock</button>
        </div>
      </div>
      <div class="stats-grid" style="margin-bottom:28px">
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">12 kg Cylinders</div><div class="stat-value">${stock.cyl_12kg}</div><div class="stat-unit">units</div><div class="stat-icon">🛢️</div>
          <div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill" style="width:${Math.min(stock.cyl_12kg/100*100,100)}%"></div></div></div>
        </div>
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">45 kg Cylinders</div><div class="stat-value">${stock.cyl_45kg}</div><div class="stat-unit">units</div><div class="stat-icon">⛽</div>
          <div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill" style="width:${Math.min(stock.cyl_45kg/50*100,100)}%;background:var(--yellow)"></div></div></div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Total Gas Stock</div><div class="stat-value">${DB.fmt(stock.gas_kg)}</div><div class="stat-unit">kilograms</div><div class="stat-icon">💨</div>
        </div>
        <div class="stat-card" style="--accent:var(--silver-dim)">
          <div class="stat-label">Last Updated</div><div class="stat-value" style="font-size:20px">${stock.updatedAt}</div><div class="stat-unit">date</div>
        </div>
      </div>
      <div class="section-header"><div class="section-title">Stock Update History</div></div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Date</th><th>12kg</th><th>45kg</th><th>Gas (kg)</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${logs.length?logs.map(l=>`
          <tr>
            <td>${l.date}</td>
            <td>${l.cyl_12kg??'-'}</td>
            <td>${l.cyl_45kg??'-'}</td>
            <td>${l.gas_kg??'-'}</td>
            <td>${l.notes||'-'}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="App.editStockLog('${l.id}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteStockLog('${l.id}')">🗑️</button>
            </td>
          </tr>`).join(''):'<tr><td colspan="6" class="empty-state">No history</td></tr>'}</tbody>
      </table></div>
    `);
  },

  openStockForm() {
    const stock = DB.Stock.getOrInit();
    this.openModal('Update Stock', `
      <div class="form-grid">
        <div class="form-group"><label>12kg Cylinders</label><input type="number" id="s_12kg" value="${stock.cyl_12kg}" min="0"></div>
        <div class="form-group"><label>45kg Cylinders</label><input type="number" id="s_45kg" value="${stock.cyl_45kg}" min="0"></div>
        <div class="form-group"><label>Total Gas Stock (kg)</label><input type="number" id="s_gas" value="${stock.gas_kg}" min="0" step="0.1"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="s_notes" placeholder="Optional"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.saveStock()">💾 Save</button>
      </div>
    `);
  },

  saveStock() {
    const cyl_12kg=parseFloat(document.getElementById('s_12kg').value)||0;
    const cyl_45kg=parseFloat(document.getElementById('s_45kg').value)||0;
    const gas_kg=parseFloat(document.getElementById('s_gas').value)||0;
    const notes=document.getElementById('s_notes').value;
    DB.Stock.update({cyl_12kg,cyl_45kg,gas_kg});
    DB.Stock.addLog({cyl_12kg,cyl_45kg,gas_kg,notes});
    this.closeModal(); this.showAlert('Stock updated!','success');
  },

  editStockLog(id) {
    const logs = DB.Stock.getLogs();
    const l = logs.find(r => r.id === id);
    if (!l) return;
    this.openModal('Edit Stock Log', `
      <div class="form-grid">
        <div class="form-group"><label>Date</label><input type="date" id="sl_date" value="${l.date}"></div>
        <div class="form-group"><label>12kg Cylinders</label><input type="number" id="sl_12kg" value="${l.cyl_12kg??''}" min="0"></div>
        <div class="form-group"><label>45kg Cylinders</label><input type="number" id="sl_45kg" value="${l.cyl_45kg??''}" min="0"></div>
        <div class="form-group"><label>Gas Stock (kg)</label><input type="number" id="sl_gas" value="${l.gas_kg??''}" min="0" step="0.1"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="sl_notes" value="${l.notes||''}"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.saveStockLog('${id}')">💾 Save Changes</button>
      </div>
    `);
  },

  saveStockLog(id) {
    const logs = DB.Stock.getLogs();
    const idx = logs.findIndex(r => r.id === id);
    if (idx === -1) return;
    logs[idx] = {
      ...logs[idx],
      date: document.getElementById('sl_date').value,
      cyl_12kg: parseFloat(document.getElementById('sl_12kg').value)||0,
      cyl_45kg: parseFloat(document.getElementById('sl_45kg').value)||0,
      gas_kg: parseFloat(document.getElementById('sl_gas').value)||0,
      notes: document.getElementById('sl_notes').value,
    };
    localStorage.setItem('fg_stock_logs', JSON.stringify(logs));
    const latest = logs[0];
    DB.Stock.update({ cyl_12kg: latest.cyl_12kg, cyl_45kg: latest.cyl_45kg, gas_kg: latest.gas_kg });
    this.closeModal();
    this.showAlert('Stock log updated!', 'success');
  },

  deleteStockLog(id) {
    if (!confirm('Delete this stock log entry?')) return;
    const logs = DB.Stock.getLogs().filter(r => r.id !== id);
    localStorage.setItem('fg_stock_logs', JSON.stringify(logs));
    if (logs.length) {
      const latest = logs[0];
      DB.Stock.update({ cyl_12kg: latest.cyl_12kg, cyl_45kg: latest.cyl_45kg, gas_kg: latest.gas_kg });
    }
    this.navigate('stock');
    this.showAlert('Stock log deleted.', 'error');
  },

  // ======================== CYLINDER INVENTORY (NEW) ========================
  renderCylinders() {
    const cyls12 = DB.Cylinders.getByType('12kg');
    const cyls45 = DB.Cylinders.getByType('45kg');
    const all = DB.Cylinders.getAll();

    const makeCylCards = (list, type) => {
      if (!list.length) return `<div class="empty-state" style="padding:20px;grid-column:1/-1"><div class="empty-icon">${type==='12kg'?'🛢️':'⛽'}</div>No ${type} cylinders in stock</div>`;
      return list.map(c => `
        <div class="cyl-card">
          <button class="cyl-delete" onclick="App.deleteCylinder('${c.id}')" title="Remove from inventory">✕</button>
          <div class="cyl-icon">${type==='12kg'?'🛢️':'⛽'}</div>
          <div class="cyl-id">${c.number || c.id.slice(-4).toUpperCase()}</div>
          <div class="cyl-type">${type}</div>
          ${c.notes ? `<div style="font-size:10px;color:var(--silver-dim);margin-top:4px">${c.notes}</div>` : ''}
          <button class="btn btn-danger btn-sm" style="width:100%;margin-top:8px;font-size:10px" onclick="App.sellCylinder('${c.id}')">💰 Sold</button>
        </div>
      `).join('');
    };

    this.setContent(`
      <div class="section-header">
        <div class="section-title">Cylinder Inventory</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="App.openAddCylinder('12kg')">➕ Add 12kg</button>
          <button class="btn btn-primary btn-sm" onclick="App.openAddCylinder('45kg')">➕ Add 45kg</button>
        </div>
      </div>

      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">12kg In Stock</div><div class="stat-value">${cyls12.length}</div><div class="stat-unit">cylinders</div><div class="stat-icon">🛢️</div>
        </div>
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">45kg In Stock</div><div class="stat-value">${cyls45.length}</div><div class="stat-unit">cylinders</div><div class="stat-icon">⛽</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Total Cylinders</div><div class="stat-value">${all.length}</div><div class="stat-unit">all sizes</div>
        </div>
        <div class="stat-card" style="--accent:var(--silver-dim)">
          <div class="stat-label">Gas Stock (kg)</div><div class="stat-value">${DB.fmt(DB.Stock.getOrInit().gas_kg)}</div><div class="stat-unit">kilograms</div>
        </div>
      </div>

      <div class="section-title" style="margin-bottom:12px">🛢️ 12kg Cylinders (${cyls12.length})</div>
      <div class="cyl-grid" style="margin-bottom:28px">
        ${makeCylCards(cyls12, '12kg')}
      </div>

      <div class="section-title" style="margin-bottom:12px">⛽ 45kg Cylinders (${cyls45.length})</div>
      <div class="cyl-grid">
        ${makeCylCards(cyls45, '45kg')}
      </div>

      <div style="margin-top:20px;padding:14px 18px;background:rgba(255,107,0,0.07);border:1px solid rgba(255,107,0,0.2);border-radius:10px;font-size:13px;color:var(--silver-dim)">
        💡 <strong style="color:var(--white)">Tip:</strong> Press <strong style="color:var(--flame)">💰 Sold</strong> on a cylinder to remove it from your inventory when you sell it to a customer. The count updates automatically.
      </div>
    `);
  },

  openAddCylinder(defaultType) {
    this.openModal('Add Cylinder to Inventory', `
      <div class="form-grid">
        <div class="form-group"><label>Cylinder Type</label>
          <select id="cyl_type">
            <option value="12kg" ${defaultType==='12kg'?'selected':''}>12 kg</option>
            <option value="45kg" ${defaultType==='45kg'?'selected':''}>45 kg</option>
          </select>
        </div>
        <div class="form-group"><label>Cylinder Number / ID</label>
          <input type="text" id="cyl_number" placeholder="e.g. CYL-001 or 1234" autofocus>
        </div>
        <div class="form-group"><label>Notes (Optional)</label>
          <input type="text" id="cyl_notes" placeholder="e.g. New, Refurbished">
        </div>
      </div>
      <div style="margin-top:12px;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:12px;color:var(--silver-dim)">
        Adding a cylinder will increase your stock count automatically.
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.saveAddCylinder()">➕ Add Cylinder</button>
      </div>
    `);
  },

  saveAddCylinder() {
    const type = document.getElementById('cyl_type').value;
    const number = document.getElementById('cyl_number').value.trim();
    const notes = document.getElementById('cyl_notes').value.trim();
    if (!number) { alert('Enter a cylinder number/ID'); return; }
    const result = DB.Cylinders.add({ type, number, notes });
    if (!result) { alert(`A ${type} cylinder with number "${number}" already exists!`); return; }
    this.closeModal();
    this.showAlert(`${type} cylinder "${number}" added!`, 'success');
  },

  sellCylinder(id) {
    const all = DB.Cylinders.getAll();
    const cyl = all.find(c => c.id === id);
    if (!cyl) return;
    if (!confirm(`Mark cylinder "${cyl.number}" (${cyl.type}) as SOLD and remove from inventory?`)) return;
    DB.Cylinders.sell(id);
    this.navigate('cylinders');
    this.showAlert(`Cylinder "${cyl.number}" sold & removed from stock!`, 'success');
  },

  deleteCylinder(id) {
    const all = DB.Cylinders.getAll();
    const cyl = all.find(c => c.id === id);
    if (!cyl) return;
    if (!confirm(`Remove cylinder "${cyl.number}" from inventory? (Use this only if added by mistake)`)) return;
    DB.Cylinders.delete(id);
    this.navigate('cylinders');
    this.showAlert(`Cylinder removed.`, 'error');
  },

  // ======================== LPG SALES ========================
  renderSales() {
    const today=DB.today(); const all=DB.Sales.getAll();
    const todaySales=DB.Sales.getByDate(today);
    const {year,month}=DB.nowYM();
    const monthSales=DB.Sales.getByMonth(year,month);
    const todayAmt=DB.sum(todaySales,'amount'),todayKg=DB.sum(todaySales,'qty_kg'),todayCost=DB.sum(todaySales,'cost');
    const todayProfit=todayAmt-todayCost, todayPPK=todayKg>0?todayProfit/todayKg:0;
    const monthAmt=DB.sum(monthSales,'amount'),monthKg=DB.sum(monthSales,'qty_kg');
    const stock=DB.Stock.getOrInit();
    this.setContent(`
      <div class="section-header">
        <div class="section-title">LPG Sales</div>
        <button class="btn btn-primary" onclick="App.openSaleForm()">➕ Add Sale</button>
      </div>
      <div style="background:rgba(0,196,140,0.07);border:1px solid rgba(0,196,140,0.2);border-radius:8px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:var(--silver-dim)">
        ⚡ Gas stock auto-updates when you record a sale. Current stock: <strong style="color:var(--green)">${DB.fmt(stock.gas_kg)} kg</strong>
      </div>
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Today KG Sold</div><div class="stat-value">${DB.fmt(todayKg)}</div><div class="stat-unit">kg</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Today Revenue</div><div class="stat-value">₨${DB.fmt(todayAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Today Profit</div><div class="stat-value" style="color:${todayProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayProfit)}</div><div class="stat-unit">₨${DB.fmt(todayPPK)}/kg</div></div>
        <div class="stat-card" style="--accent:var(--yellow)"><div class="stat-label">Month KG Sold</div><div class="stat-value">${DB.fmt(monthKg)}</div><div class="stat-unit">this month</div></div>
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Monthly Revenue</div><div class="stat-value">₨${DB.fmt(monthAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--silver-dim)"><div class="stat-label">Total Records</div><div class="stat-value">${all.length}</div></div>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Qty(kg)</th><th>Buy ₨/kg</th><th>Sell ₨/kg</th><th>Cost</th><th>Revenue</th><th>Profit</th><th>₨/kg</th><th>Actions</th></tr></thead>
        <tbody>${all.length?all.slice(0,60).map(r=>{
          const profit=(r.amount||0)-(r.cost||0),perKg=r.qty_kg>0?profit/r.qty_kg:0;
          return `<tr>
            <td>${r.date}</td><td>${r.description||'-'}</td>
            <td><span class="tag tag-orange">${r.type||'LPG'}</span></td>
            <td>${DB.fmt(r.qty_kg||0)}</td>
            <td>₨${DB.fmt(r.buy_price||0)}</td><td>₨${DB.fmt(r.sell_price||0)}</td>
            <td>₨${DB.fmt(r.cost||0)}</td><td>₨${DB.fmt(r.amount||0)}</td>
            <td style="color:${profit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(profit)}</td>
            <td style="color:var(--yellow)">₨${DB.fmt(perKg)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="App.openSaleForm('${r.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="App.deleteSale('${r.id}')">🗑️</button></td>
          </tr>`}).join(''):'<tr><td colspan="11" class="empty-state">No sales yet.</td></tr>'}</tbody>
      </table></div>
    `);
  },

  openSaleForm(id=null) {
    let rec={}; if(id) rec=DB.Sales.getAll().find(r=>r.id===id)||{};
    const stock=DB.Stock.getOrInit();
    this.openModal(id?'Edit LPG Sale':'Add LPG Sale',`
      <div style="background:rgba(255,107,0,0.08);border:1px solid rgba(255,107,0,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--silver-dim)">
        💡 Enter Buy Price + Sell Price + Quantity → Revenue & Cost auto-calculate.
        Gas stock (${DB.fmt(stock.gas_kg)} kg) will auto-deduct on save.
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Date</label><input type="date" id="sale_date" value="${rec.date||DB.today()}"></div>
        <div class="form-group"><label>Type</label>
          <select id="sale_type">
            <option value="LPG" ${rec.type==='LPG'?'selected':''}>LPG Gas</option>
            <option value="Cylinder" ${rec.type==='Cylinder'?'selected':''}>Cylinder Sale</option>
            <option value="Refill" ${rec.type==='Refill'?'selected':''}>Refill</option>
            <option value="Other" ${rec.type==='Other'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label>Description / Customer</label><input type="text" id="sale_desc" value="${rec.description||''}" placeholder="e.g. Regular customer"></div>
        <div class="form-group"><label>Quantity (kg)</label><input type="number" id="sale_kg" value="${rec.qty_kg||''}" min="0" step="0.1" placeholder="e.g. 200" oninput="App.calcSalePrices()"></div>
        <div class="form-group"><label>Buy Price (₨/kg)</label><input type="number" id="sale_buy" value="${rec.buy_price||''}" min="0" step="0.01" placeholder="e.g. 400" oninput="App.calcSalePrices()"></div>
        <div class="form-group"><label>Sell Price (₨/kg)</label><input type="number" id="sale_sell" value="${rec.sell_price||''}" min="0" step="0.01" placeholder="e.g. 430" oninput="App.calcSalePrices()"></div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:12px">
        <div style="font-size:11px;color:var(--silver-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚡ Auto Calculated</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center">
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Cost</div><div id="calc_cost" style="font-family:'Bebas Neue';font-size:22px;color:var(--red)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Revenue</div><div id="calc_revenue" style="font-family:'Bebas Neue';font-size:22px;color:var(--green)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Profit</div><div id="calc_profit" style="font-family:'Bebas Neue';font-size:22px;color:var(--yellow)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Profit/kg</div><div id="calc_perkg" style="font-family:'Bebas Neue';font-size:22px;color:var(--flame)">₨0</div></div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.saveSale('${id||''}')">💾 Save Sale</button>
      </div>
    `);
    if(id) setTimeout(()=>this.calcSalePrices(),50);
  },

  calcSalePrices() {
    const kg=parseFloat(document.getElementById('sale_kg')?.value)||0;
    const buy=parseFloat(document.getElementById('sale_buy')?.value)||0;
    const sell=parseFloat(document.getElementById('sale_sell')?.value)||0;
    const cost=kg*buy, revenue=kg*sell, profit=revenue-cost, perKg=sell-buy;
    if(document.getElementById('calc_cost')) {
      document.getElementById('calc_cost').textContent='₨'+DB.fmt(cost);
      document.getElementById('calc_revenue').textContent='₨'+DB.fmt(revenue);
      document.getElementById('calc_profit').textContent='₨'+DB.fmt(profit);
      document.getElementById('calc_profit').style.color=profit>=0?'var(--green)':'var(--red)';
      document.getElementById('calc_perkg').textContent='₨'+DB.fmt(perKg);
    }
  },

  saveSale(id) {
    const kg=parseFloat(document.getElementById('sale_kg').value)||0;
    const buy=parseFloat(document.getElementById('sale_buy').value)||0;
    const sell=parseFloat(document.getElementById('sale_sell').value)||0;
    const data={
      date:document.getElementById('sale_date').value,
      type:document.getElementById('sale_type').value,
      description:document.getElementById('sale_desc').value,
      qty_kg:kg, buy_price:buy, sell_price:sell,
      cost:kg*buy, amount:kg*sell
    };
    if(!kg && !data.amount){alert('Enter quantity');return;}
    if(id) DB.Sales.update(id,data); else DB.Sales.add(data);
    this.closeModal();
    this.showAlert('Sale saved! Gas stock updated automatically.','success');
  },

  deleteSale(id) {
    if(confirm('Delete this sale? Gas stock will be restored.')){
      DB.Sales.delete(id);
      this.navigate('sales');
      this.showAlert('Sale deleted. Gas stock restored.', 'error');
    }
  },

  // ======================== PARTS ========================
  renderParts() {
    const today=DB.today(); const all=DB.Parts.getAll();
    const todayParts=DB.Parts.getByDate(today);
    const {year,month}=DB.nowYM();
    const monthParts=DB.Parts.getByMonth(year,month);
    const todayAmt=DB.sum(todayParts,'amount'),todayCost=DB.sum(todayParts,'cost');
    const todayProfit=todayAmt-todayCost, monthAmt=DB.sum(monthParts,'amount');
    this.setContent(`
      <div class="section-header">
        <div class="section-title">Parts & Accessories Sales</div>
        <button class="btn btn-primary" onclick="App.openPartForm()">➕ Add Sale</button>
      </div>
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Today Revenue</div><div class="stat-value">₨${DB.fmt(todayAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Today Profit</div><div class="stat-value" style="color:${todayProfit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(todayProfit)}</div></div>
        <div class="stat-card" style="--accent:var(--yellow)"><div class="stat-label">Monthly Revenue</div><div class="stat-value">₨${DB.fmt(monthAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Total Records</div><div class="stat-value">${all.length}</div></div>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Qty</th><th>Buy ₨</th><th>Sell ₨</th><th>Cost</th><th>Revenue</th><th>Profit</th><th>Actions</th></tr></thead>
        <tbody>${all.length?all.slice(0,60).map(r=>{
          const profit=(r.amount||0)-(r.cost||0);
          return `<tr>
            <td>${r.date}</td><td>${r.item_name||'-'}</td>
            <td><span class="tag tag-green">${r.category||'Parts'}</span></td>
            <td>${r.qty||1}</td>
            <td>₨${DB.fmt(r.buy_price||0)}</td><td>₨${DB.fmt(r.sell_price||0)}</td>
            <td>₨${DB.fmt(r.cost||0)}</td><td>₨${DB.fmt(r.amount||0)}</td>
            <td style="color:${profit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(profit)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="App.openPartForm('${r.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="App.deletePart('${r.id}')">🗑️</button></td>
          </tr>`}).join(''):'<tr><td colspan="10" class="empty-state">No parts sales yet.</td></tr>'}</tbody>
      </table></div>
    `);
  },

  openPartForm(id=null) {
    let rec={}; if(id) rec=DB.Parts.getAll().find(r=>r.id===id)||{};
    this.openModal(id?'Edit Parts Sale':'Add Parts Sale',`
      <div style="background:rgba(0,196,140,0.08);border:1px solid rgba(0,196,140,0.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--silver-dim)">
        💡 Enter Buy Price + Sell Price + Quantity → Cost & Revenue auto-calculate
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Date</label><input type="date" id="p_date" value="${rec.date||DB.today()}"></div>
        <div class="form-group"><label>Item Name</label><input type="text" id="p_item" value="${rec.item_name||''}" placeholder="e.g. Regulator"></div>
        <div class="form-group"><label>Category</label>
          <select id="p_cat">
            <option value="Parts" ${rec.category==='Parts'?'selected':''}>Parts</option>
            <option value="Regulator" ${rec.category==='Regulator'?'selected':''}>Regulator</option>
            <option value="Pipe" ${rec.category==='Pipe'?'selected':''}>Pipe</option>
            <option value="Accessories" ${rec.category==='Accessories'?'selected':''}>Accessories</option>
            <option value="Service" ${rec.category==='Service'?'selected':''}>Service</option>
            <option value="Other" ${rec.category==='Other'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label>Quantity</label><input type="number" id="p_qty" value="${rec.qty||1}" min="1" oninput="App.calcPartPrices()"></div>
        <div class="form-group"><label>Buy Price (₨/unit)</label><input type="number" id="p_buy" value="${rec.buy_price||''}" min="0" step="0.01" placeholder="e.g. 800" oninput="App.calcPartPrices()"></div>
        <div class="form-group"><label>Sell Price (₨/unit)</label><input type="number" id="p_sell" value="${rec.sell_price||''}" min="0" step="0.01" placeholder="e.g. 1000" oninput="App.calcPartPrices()"></div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:12px">
        <div style="font-size:11px;color:var(--silver-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">⚡ Auto Calculated</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Cost</div><div id="pcalc_cost" style="font-family:'Bebas Neue';font-size:22px;color:var(--red)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Revenue</div><div id="pcalc_revenue" style="font-family:'Bebas Neue';font-size:22px;color:var(--green)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Total Profit</div><div id="pcalc_profit" style="font-family:'Bebas Neue';font-size:22px;color:var(--yellow)">₨0</div></div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.savePart('${id||''}')">💾 Save</button>
      </div>
    `);
    if(id) setTimeout(()=>this.calcPartPrices(),50);
  },

  calcPartPrices() {
    const qty=parseFloat(document.getElementById('p_qty')?.value)||0;
    const buy=parseFloat(document.getElementById('p_buy')?.value)||0;
    const sell=parseFloat(document.getElementById('p_sell')?.value)||0;
    const cost=qty*buy,revenue=qty*sell,profit=revenue-cost;
    if(document.getElementById('pcalc_cost')) {
      document.getElementById('pcalc_cost').textContent='₨'+DB.fmt(cost);
      document.getElementById('pcalc_revenue').textContent='₨'+DB.fmt(revenue);
      document.getElementById('pcalc_profit').textContent='₨'+DB.fmt(profit);
      document.getElementById('pcalc_profit').style.color=profit>=0?'var(--green)':'var(--red)';
    }
  },

  savePart(id) {
    const qty=parseFloat(document.getElementById('p_qty').value)||1;
    const buy=parseFloat(document.getElementById('p_buy').value)||0;
    const sell=parseFloat(document.getElementById('p_sell').value)||0;
    const data={
      date:document.getElementById('p_date').value,
      item_name:document.getElementById('p_item').value,
      category:document.getElementById('p_cat').value,
      qty, buy_price:buy, sell_price:sell,
      cost:qty*buy, amount:qty*sell
    };
    if(!data.item_name){alert('Enter item name');return;}
    if(!data.amount){alert('Enter sell price');return;}
    if(id) DB.Parts.update(id,data); else DB.Parts.add(data);
    this.closeModal(); this.showAlert('Parts sale saved!','success');
  },

  deletePart(id) {
    if(confirm('Delete?')){DB.Parts.delete(id);this.navigate('parts');}
  },

  // ======================== EXPENSES ========================
  renderExpenses() {
    const today=DB.today(); const all=DB.Expenses.getAll();
    const {year,month}=DB.nowYM();
    const todayAmt=DB.sum(DB.Expenses.getByDate(today),'amount');
    const monthAmt=DB.sum(DB.Expenses.getByMonth(year,month),'amount');
    this.setContent(`
      <div class="section-header">
        <div class="section-title">Expenses</div>
        <button class="btn btn-primary" onclick="App.openExpenseForm()">➕ Add Expense</button>
      </div>
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card" style="--accent:var(--red)"><div class="stat-label">Today</div><div class="stat-value">₨${DB.fmt(todayAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--red)"><div class="stat-label">Monthly</div><div class="stat-value">₨${DB.fmt(monthAmt)}</div></div>
        <div class="stat-card" style="--accent:var(--yellow)"><div class="stat-label">Records</div><div class="stat-value">${all.length}</div></div>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount (₨)</th><th>Actions</th></tr></thead>
        <tbody>${all.length?all.slice(0,60).map(r=>`
          <tr>
            <td>${r.date}</td><td><span class="tag tag-red">${r.category||'General'}</span></td>
            <td>${r.description||'-'}</td>
            <td style="color:var(--red)">₨${DB.fmt(r.amount||0)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="App.openExpenseForm('${r.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="App.deleteExpense('${r.id}')">🗑️</button></td>
          </tr>`).join(''):'<tr><td colspan="5" class="empty-state">No expenses.</td></tr>'}</tbody>
      </table></div>
    `);
  },

  openExpenseForm(id=null) {
    let rec={}; if(id) rec=DB.Expenses.getAll().find(r=>r.id===id)||{};
    this.openModal(id?'Edit Expense':'Add Expense',`
      <div class="form-grid">
        <div class="form-group"><label>Date</label><input type="date" id="e_date" value="${rec.date||DB.today()}"></div>
        <div class="form-group"><label>Category</label>
          <select id="e_cat">
            <option value="Rent" ${rec.category==='Rent'?'selected':''}>Rent</option>
            <option value="Electricity" ${rec.category==='Electricity'?'selected':''}>Electricity</option>
            <option value="Salary" ${rec.category==='Salary'?'selected':''}>Salary</option>
            <option value="Transport" ${rec.category==='Transport'?'selected':''}>Transport</option>
            <option value="Purchase" ${rec.category==='Purchase'?'selected':''}>Stock Purchase</option>
            <option value="Maintenance" ${rec.category==='Maintenance'?'selected':''}>Maintenance</option>
            <option value="Other" ${rec.category==='Other'?'selected':''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label>Description</label><input type="text" id="e_desc" value="${rec.description||''}" placeholder="Details..."></div>
        <div class="form-group"><label>Amount (₨)</label><input type="number" id="e_amount" value="${rec.amount||''}" min="0"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.saveExpense('${id||''}')">💾 Save</button>
      </div>
    `);
  },

  saveExpense(id) {
    const data={
      date:document.getElementById('e_date').value,
      category:document.getElementById('e_cat').value,
      description:document.getElementById('e_desc').value,
      amount:parseFloat(document.getElementById('e_amount').value)||0
    };
    if(!data.amount){alert('Enter amount');return;}
    if(id) DB.Expenses.update(id,data); else DB.Expenses.add(data);
    this.closeModal(); this.showAlert('Expense saved!','success');
  },

  deleteExpense(id) {
    if(confirm('Delete?')){DB.Expenses.delete(id);this.navigate('expenses');}
  },

  // ======================== PREVIOUS MONTH MANUAL ========================
  renderPrevMonth() {
    const all=DB.PrevMonth.getAll();
    const total=DB.sum(all,'turnover');
    this.setContent(`
      <div class="section-header">
        <div class="section-title">Previous Month Manual Entry</div>
        <button class="btn btn-primary" onclick="App.openPrevMonthForm()">➕ Add Month</button>
      </div>
      <div style="background:rgba(255,107,0,0.07);border:1px solid rgba(255,107,0,0.2);border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:var(--silver-dim)">
        📌 Record previous months as <strong style="color:var(--white)">single lump-sum entries</strong> — no need to enter transactions day-by-day. Enter total KG sold, buy/sell price and the system auto-calculates everything.
      </div>
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Records</div><div class="stat-value">${all.length}</div></div>
        <div class="stat-card" style="--accent:var(--yellow)"><div class="stat-label">Total Turnover</div><div class="stat-value">₨${DB.fmt(total)}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Total LPG</div><div class="stat-value">₨${DB.fmt(DB.sum(all,'lpg_turnover'))}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Total Parts</div><div class="stat-value">₨${DB.fmt(DB.sum(all,'parts_turnover'))}</div></div>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Month</th><th>LPG Revenue</th><th>KG Sold</th><th>₨/kg Profit</th><th>Parts</th><th>Expenses</th><th>Net Profit</th><th>Total</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${all.length?all.map(r=>{
          const net=(r.lpg_turnover||0)+(r.parts_turnover||0)-(r.expenses||0)-(r.lpg_cost||0)-(r.parts_cost||0);
          const ppk=r.lpg_kg>0?((r.lpg_turnover||0)-(r.lpg_cost||0))/r.lpg_kg:0;
          return `<tr>
            <td><strong>${r.month_label}</strong></td>
            <td>₨${DB.fmt(r.lpg_turnover||0)}</td>
            <td>${DB.fmt(r.lpg_kg||0)} kg</td>
            <td style="color:var(--yellow)">₨${DB.fmt(ppk)}</td>
            <td>₨${DB.fmt(r.parts_turnover||0)}</td>
            <td style="color:var(--red)">₨${DB.fmt(r.expenses||0)}</td>
            <td style="color:${net>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(net)}</td>
            <td style="color:var(--flame)">₨${DB.fmt(r.turnover||0)}</td>
            <td>${r.notes||'-'}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="App.openPrevMonthForm('${r.id}')">✏️</button> <button class="btn btn-danger btn-sm" onclick="App.deletePrevMonth('${r.id}')">🗑️</button></td>
          </tr>`}).join(''):'<tr><td colspan="10" class="empty-state">No previous month records yet.</td></tr>'}</tbody>
      </table></div>
    `);
  },

  openPrevMonthForm(id=null) {
    let rec={}; if(id) rec=DB.PrevMonth.getAll().find(r=>r.id===id)||{};
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const years=[2022,2023,2024,2025,2026];
    this.openModal(id?'Edit Previous Month':'Add Previous Month',`
      <div class="form-grid">
        <div class="form-group"><label>Month</label>
          <select id="pm_month">${months.map((m,i)=>`<option value="${i+1}" ${rec.month==i+1?'selected':''}>${m}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Year</label>
          <select id="pm_year">${years.map(y=>`<option value="${y}" ${rec.year==y?'selected':''}>${y}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>LPG KG Sold (whole month)</label><input type="number" id="pm_lpg_kg" value="${rec.lpg_kg||''}" min="0" step="0.1" placeholder="e.g. 5000" oninput="App.calcPrevMonth()"></div>
        <div class="form-group"><label>Avg Buy Price ₨/kg</label><input type="number" id="pm_buy" value="${rec.buy_price||''}" min="0" step="0.01" placeholder="e.g. 400" oninput="App.calcPrevMonth()"></div>
        <div class="form-group"><label>Avg Sell Price ₨/kg</label><input type="number" id="pm_sell" value="${rec.sell_price||''}" min="0" step="0.01" placeholder="e.g. 430" oninput="App.calcPrevMonth()"></div>
        <div class="form-group"><label>LPG Revenue ₨ (auto or override)</label><input type="number" id="pm_lpg" value="${rec.lpg_turnover||''}" min="0" placeholder="Auto: kg × sell price"></div>
        <div class="form-group"><label>LPG Cost ₨ (auto or override)</label><input type="number" id="pm_lpg_cost" value="${rec.lpg_cost||''}" min="0" placeholder="Auto: kg × buy price"></div>
        <div class="form-group"><label>Parts Revenue ₨</label><input type="number" id="pm_parts" value="${rec.parts_turnover||''}" min="0" placeholder="0"></div>
        <div class="form-group"><label>Parts Cost ₨</label><input type="number" id="pm_parts_cost" value="${rec.parts_cost||''}" min="0" placeholder="0"></div>
        <div class="form-group"><label>Total Expenses ₨</label><input type="number" id="pm_exp" value="${rec.expenses||''}" min="0" placeholder="0"></div>
        <div class="form-group"><label>Notes</label><input type="text" id="pm_notes" value="${rec.notes||''}" placeholder="Optional"></div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:12px">
        <div style="font-size:11px;color:var(--silver-dim);text-transform:uppercase;margin-bottom:10px">⚡ Auto Preview</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          <div><div style="font-size:11px;color:var(--silver-dim)">LPG Revenue</div><div id="pm_calc_rev" style="font-family:'Bebas Neue';font-size:20px;color:var(--green)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">LPG Cost</div><div id="pm_calc_cost" style="font-family:'Bebas Neue';font-size:20px;color:var(--red)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Profit/kg</div><div id="pm_calc_pkg" style="font-family:'Bebas Neue';font-size:20px;color:var(--yellow)">₨0</div></div>
          <div><div style="font-size:11px;color:var(--silver-dim)">Total LPG Profit</div><div id="pm_calc_tot" style="font-family:'Bebas Neue';font-size:20px;color:var(--flame)">₨0</div></div>
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="App.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="App.savePrevMonth('${id||''}')">💾 Save Month</button>
      </div>
    `);
    if(id) setTimeout(()=>this.calcPrevMonth(),50);
  },

  calcPrevMonth() {
    const kg=parseFloat(document.getElementById('pm_lpg_kg')?.value)||0;
    const buy=parseFloat(document.getElementById('pm_buy')?.value)||0;
    const sell=parseFloat(document.getElementById('pm_sell')?.value)||0;
    const rev=kg*sell, cost=kg*buy, perKg=sell-buy, totalProfit=rev-cost;
    if(document.getElementById('pm_calc_rev')) {
      document.getElementById('pm_calc_rev').textContent='₨'+DB.fmt(rev);
      document.getElementById('pm_calc_cost').textContent='₨'+DB.fmt(cost);
      document.getElementById('pm_calc_pkg').textContent='₨'+DB.fmt(perKg);
      document.getElementById('pm_calc_tot').textContent='₨'+DB.fmt(totalProfit);
      const lpgEl=document.getElementById('pm_lpg');
      const costEl=document.getElementById('pm_lpg_cost');
      if(lpgEl && !lpgEl.value && rev>0) lpgEl.value=rev;
      if(costEl && !costEl.value && cost>0) costEl.value=cost;
    }
  },

  savePrevMonth(id) {
    const m=parseInt(document.getElementById('pm_month').value);
    const y=parseInt(document.getElementById('pm_year').value);
    const labels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const kg=parseFloat(document.getElementById('pm_lpg_kg').value)||0;
    const buy=parseFloat(document.getElementById('pm_buy').value)||0;
    const sell=parseFloat(document.getElementById('pm_sell').value)||0;
    const lpg_turnover=parseFloat(document.getElementById('pm_lpg').value)||(kg*sell);
    const parts_turnover=parseFloat(document.getElementById('pm_parts').value)||0;
    const lpg_cost=parseFloat(document.getElementById('pm_lpg_cost').value)||(kg*buy);
    const parts_cost=parseFloat(document.getElementById('pm_parts_cost').value)||0;
    const expenses=parseFloat(document.getElementById('pm_exp').value)||0;
    const notes=document.getElementById('pm_notes').value;
    const data={
      month:m, year:y, month_label:`${labels[m-1]} ${y}`,
      lpg_kg:kg, buy_price:buy, sell_price:sell,
      lpg_turnover, parts_turnover, lpg_cost, parts_cost,
      expenses, notes, turnover:lpg_turnover+parts_turnover
    };
    if(id) DB.PrevMonth.update(id,data); else DB.PrevMonth.add(data);
    this.closeModal(); this.showAlert('Month record saved!','success');
  },

  deletePrevMonth(id) {
    if(confirm('Delete this month record?')){DB.PrevMonth.delete(id);this.navigate('prevmonth');}
  },

  // ======================== REPORTS ========================
  renderReports() {
    const {year,month}=DB.nowYM();
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let rows='';
    for(let m=1;m<=12;m++) {
      const s=DB.Sales.getByMonth(year,m), p=DB.Parts.getByMonth(year,m), e=DB.Expenses.getByMonth(year,m);
      const sAmt=DB.sum(s,'amount'), pAmt=DB.sum(p,'amount'), eAmt=DB.sum(e,'amount');
      const sKg=DB.sum(s,'qty_kg'), sCost=DB.sum(s,'cost'), pCost=DB.sum(p,'cost');
      const total=sAmt+pAmt, profit=total-eAmt-sCost-pCost;
      const ppk=sKg>0?(sAmt-sCost)/sKg:0;
      if(total>0||m<=month) rows+=`<tr>
        <td>${months[m-1]} ${year}</td><td>${DB.fmt(sKg)} kg</td>
        <td>₨${DB.fmt(sAmt)}</td><td>₨${DB.fmt(pAmt)}</td><td>₨${DB.fmt(total)}</td>
        <td style="color:var(--red)">₨${DB.fmt(eAmt)}</td>
        <td style="color:var(--yellow)">₨${DB.fmt(ppk)}/kg</td>
        <td style="color:${profit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(profit)}</td>
      </tr>`;
    }
    const allS=DB.Sales.getByYear(year), allP=DB.Parts.getByYear(year);
    const allE=[]; for(let m=1;m<=12;m++) allE.push(...DB.Expenses.getByMonth(year,m));
    const yLpg=DB.sum(allS,'amount'), yParts=DB.sum(allP,'amount'), yExp=DB.sum(allE,'amount');
    const yKg=DB.sum(allS,'qty_kg'), yLpgC=DB.sum(allS,'cost'), yPC=DB.sum(allP,'cost');
    const yGross=(yLpg+yParts)-yLpgC-yPC, yNet=yGross-yExp;
    const yPPK=yKg>0?(yLpg-yLpgC)/yKg:0;
    this.setContent(`
      <div class="section-title" style="margin-bottom:20px">Year ${year} — Full Report</div>
      <div class="stats-grid" style="margin-bottom:28px">
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Year LPG KG</div><div class="stat-value">${DB.fmt(yKg)}</div><div class="stat-unit">kg sold</div></div>
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Year LPG Revenue</div><div class="stat-value">₨${DB.fmt(yLpg)}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Year Parts Revenue</div><div class="stat-value">₨${DB.fmt(yParts)}</div></div>
        <div class="stat-card" style="--accent:var(--flame)"><div class="stat-label">Year Turnover</div><div class="stat-value">₨${DB.fmt(yLpg+yParts)}</div></div>
        <div class="stat-card" style="--accent:var(--red)"><div class="stat-label">Year Expenses</div><div class="stat-value" style="color:var(--red)">₨${DB.fmt(yExp)}</div></div>
        <div class="stat-card" style="--accent:var(--yellow)"><div class="stat-label">Avg ₨/kg Profit</div><div class="stat-value">₨${DB.fmt(yPPK)}</div><div class="stat-unit">per kg</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Year Gross Profit</div><div class="stat-value" style="color:${yGross>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(yGross)}</div></div>
        <div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Year Net Profit</div><div class="stat-value" style="color:${yNet>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(yNet)}</div></div>
      </div>
      <div class="section-header"><div class="section-title">Monthly Breakdown — ${year}</div></div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Month</th><th>Gas KG</th><th>LPG Sales</th><th>Parts</th><th>Total</th><th>Expenses</th><th>₨/kg</th><th>Net Profit</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="8" class="empty-state">No data</td></tr>'}</tbody>
      </table></div>
    `);
  },

  // ======================== HISTORY ========================
  renderHistory() {
    const sales=DB.Sales.getAll().map(r=>({...r,_type:'LPG',_color:'tag-orange'}));
    const parts=DB.Parts.getAll().map(r=>({...r,description:r.item_name,_type:'Parts',_color:'tag-green'}));
    const expenses=DB.Expenses.getAll().map(r=>({...r,_type:'Expense',_color:'tag-red',amount:-r.amount}));
    const all=[...sales,...parts,...expenses].sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date));
    this.setContent(`
      <div class="section-header">
        <div class="section-title">All Transactions</div>
        <span style="color:var(--silver-dim);font-size:13px">${all.length} records</span>
      </div>
      <div class="table-wrap" style="overflow-x:auto"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Qty(kg)</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>₨/kg</th></tr></thead>
        <tbody>${all.length?all.map(r=>{
          const profit=(r.amount||0)-(r.cost||0);
          const perKg=r.qty_kg>0?profit/r.qty_kg:null;
          return `<tr>
            <td>${r.date}</td><td><span class="tag ${r._color}">${r._type}</span></td>
            <td>${r.description||'-'}</td>
            <td>${r.qty_kg?DB.fmt(r.qty_kg):'-'}</td>
            <td style="color:${r.amount>=0?'var(--green)':'var(--red)'}">${r.amount>=0?'+':''}₨${DB.fmt(r.amount)}</td>
            <td style="color:var(--red)">${r.cost?'₨'+DB.fmt(r.cost):'-'}</td>
            <td style="color:${profit>=0?'var(--green)':'var(--red)'}">₨${DB.fmt(profit)}</td>
            <td style="color:var(--yellow)">${perKg!==null?'₨'+DB.fmt(perKg):'-'}</td>
          </tr>`}).join(''):'<tr><td colspan="8" class="empty-state">No records yet.</td></tr>'}</tbody>
      </table></div>
    `);
  },

  // ======================== CLOUD SYNC PAGE ========================
  renderSync() {
    const code = DB.Sync.getSyncCode();
    const lastSync = DB.Sync.getLastSync();
    const lastSyncStr = lastSync ? new Date(lastSync).toLocaleString('en-PK') : 'Never';
    this.setContent(`
      <div class="section-title" style="margin-bottom:6px">☁ Cloud Sync — Use on Multiple Devices</div>
      <p style="color:var(--silver-dim);font-size:13px;margin-bottom:24px">
        Sync your data across your phone, tablet, and computer for free. No account needed.
      </p>

      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card" style="--accent:var(--yellow)">
          <div class="stat-label">Sync Status</div>
          <div class="stat-value" style="font-size:20px">${code ? '✅ Active' : '⬜ Not Set'}</div>
          <div class="stat-unit">${code ? 'Connected to cloud' : 'Setup required'}</div>
        </div>
        <div class="stat-card" style="--accent:var(--green)">
          <div class="stat-label">Last Sync</div>
          <div class="stat-value" style="font-size:16px">${lastSync ? lastSyncStr.split(',')[0] : '—'}</div>
          <div class="stat-unit">${lastSync ? lastSyncStr.split(',')[1]||'' : 'Never synced'}</div>
        </div>
        <div class="stat-card" style="--accent:var(--flame)">
          <div class="stat-label">Your Sync Code</div>
          <div class="stat-value" style="font-size:14px;word-break:break-all">${code ? code.slice(0,8)+'...' : 'None'}</div>
          <div class="stat-unit">Save this code!</div>
        </div>
        <div class="stat-card" style="--accent:var(--silver-dim)">
          <div class="stat-label">Records</div>
          <div class="stat-value">${DB.Sales.getAll().length + DB.Parts.getAll().length + DB.Expenses.getAll().length}</div>
          <div class="stat-unit">total transactions</div>
        </div>
      </div>

      <!-- HOW TO USE -->
      <div style="background:rgba(255,214,0,0.06);border:1px solid rgba(255,214,0,0.15);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-weight:700;color:var(--yellow);margin-bottom:12px;font-size:14px">📖 How to Sync Between Devices</div>
        <div style="font-size:13px;color:var(--silver-dim);line-height:2">
          <strong style="color:var(--white)">Step 1 — First Device (Main Device):</strong><br>
          Press <strong style="color:var(--flame)">"Push to Cloud"</strong> below. This saves all your data online and gives you a Sync Code.<br><br>
          <strong style="color:var(--white)">Step 2 — Other Devices:</strong><br>
          Open the app on your other device (phone/tablet), go to Cloud Sync, enter the Sync Code, and press <strong style="color:var(--green)">"Pull from Cloud"</strong>.<br><br>
          <strong style="color:var(--white)">Step 3 — Keep Updated:</strong><br>
          Any time you add data on one device, push to cloud. Then pull on the other device to get the latest data.
        </div>
      </div>

      <!-- PUSH -->
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-title">📤 Push — Save My Data to Cloud</div>
        <p style="font-size:13px;color:var(--silver-dim);margin-bottom:16px">Uploads all your local data to the cloud. First push creates your Sync Code.</p>
        <button class="btn btn-primary" id="pushBtn" onclick="App.doSync('push')">📤 Push to Cloud</button>
        ${code ? `<div style="margin-top:12px">
          <div style="font-size:12px;color:var(--silver-dim);margin-bottom:6px">Your Sync Code (save this!):</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div class="sync-code">${code}</div>
            <button class="btn btn-ghost btn-sm" onclick="App.copySyncCode()">📋 Copy</button>
          </div>
        </div>` : ''}
      </div>

      <!-- PULL -->
      <div class="panel">
        <div class="panel-title">📥 Pull — Load Data from Cloud</div>
        <p style="font-size:13px;color:var(--silver-dim);margin-bottom:16px">Enter your Sync Code from another device to download all data here.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="form-group" style="flex:1;min-width:200px">
            <label>Sync Code</label>
            <input type="text" id="pull_code" placeholder="Paste sync code here..." value="${code||''}">
          </div>
          <button class="btn btn-success" onclick="App.doSync('pull')">📥 Pull from Cloud</button>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:rgba(255,77,77,0.08);border:1px solid rgba(255,77,77,0.2);border-radius:8px;font-size:12px;color:var(--red)">
          ⚠️ Pulling will OVERWRITE all local data on this device with the cloud data.
        </div>
      </div>
    `);
  },

  async doSync(direction) {
    const badge = document.getElementById('syncBadge');
    if (badge) { badge.textContent = '☁ Syncing...'; badge.className = 'sync-badge syncing'; }

    try {
      if (direction === 'push') {
        const btn = document.getElementById('pushBtn');
        if (btn) { btn.textContent = '⏳ Pushing...'; btn.disabled = true; }
        const code = await DB.Sync.push();
        this.showAlert(`Pushed! Sync Code: ${code}`, 'success');
        if (badge) { badge.textContent = '☁ Synced'; badge.className = 'sync-badge synced'; }
        this.navigate('sync');
      } else {
        const code = document.getElementById('pull_code')?.value?.trim();
        if (!code) { alert('Enter a Sync Code'); return; }
        if (!confirm('This will replace ALL local data with cloud data. Are you sure?')) return;
        await DB.Sync.pull(code);
        this.showAlert('Data pulled from cloud!', 'success');
        if (badge) { badge.textContent = '☁ Synced'; badge.className = 'sync-badge synced'; }
        this.navigate('dashboard');
      }
    } catch (err) {
      this.showAlert('Sync failed: ' + err.message, 'error');
      if (badge) { badge.textContent = '☁ Sync'; badge.className = 'sync-badge'; }
    }
  },

  copySyncCode() {
    const code = DB.Sync.getSyncCode();
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => this.showAlert('Sync code copied!', 'success'));
  },

  showAlert(msg,type='success') {
    const ex=document.querySelector('.alert-toast'); if(ex) ex.remove();
    const el=document.createElement('div');
    el.className=`alert alert-${type} alert-toast`;
    el.style.cssText='position:fixed;top:80px;right:20px;z-index:9999;min-width:220px;max-width:340px;animation:slideIn 0.3s ease';
    el.textContent=msg; document.body.appendChild(el);
    setTimeout(()=>el.remove(),3200);
  }
};
