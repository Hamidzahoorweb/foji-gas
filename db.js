// ===== FOJI GAS — DATABASE v4 (Auto Cloud Sync via JSONBin.io) =====

const DB = {
  KEYS: {
    stock: 'fg_stock',
    sales: 'fg_sales',
    parts: 'fg_parts',
    expenses: 'fg_expenses',
    cylinders: 'fg_cylinders',
    syncCode: 'fg_sync_code',
    lastSync: 'fg_last_sync',
  },

  SHOP_SYNC_KEY: 'fg_shop_id',
  _cache: {},

  _get(key) {
    if (this._cache[key] !== undefined) return this._cache[key];
    try {
      const val = JSON.parse(localStorage.getItem(key));
      this._cache[key] = val || [];
      return this._cache[key];
    } catch { return []; }
  },

  _set(key, data) {
    this._cache[key] = data;
    localStorage.setItem(key, JSON.stringify(data));
    DB.CloudSync.scheduleSave();
  },

  _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  _today() {
    return new Date().toISOString().split('T')[0];
  },

  // ============================
  // CLOUD SYNC — JSONBin.io
  // ============================
  CloudSync: {
    API: 'https://api.jsonbin.io/v3/b',
    API_KEY: '$2a$10$mvppWo7kGrTtUAY2BUCfzumQ7qR7HzUL8HvT.04YMaG0XcdYd.qq2',

    _saveTimer: null,
    _syncing: false,
    _pendingSave: false,

    getShopCode() {
      return localStorage.getItem(DB.SHOP_SYNC_KEY) || null;
    },

    setShopCode(code) {
      localStorage.setItem(DB.SHOP_SYNC_KEY, code);
      localStorage.setItem(DB.KEYS.syncCode, code);
    },

    exportAll() {
      return {
        stock:       localStorage.getItem(DB.KEYS.stock),
        sales:       localStorage.getItem(DB.KEYS.sales),
        parts:       localStorage.getItem(DB.KEYS.parts),
        expenses:    localStorage.getItem(DB.KEYS.expenses),
        cylinders:   localStorage.getItem(DB.KEYS.cylinders),
        stock_logs:  localStorage.getItem('fg_stock_logs'),
        prev_months: localStorage.getItem('fg_prev_months'),
        exportedAt:  new Date().toISOString()
      };
    },

    importAll(data) {
      if (data.stock)       localStorage.setItem(DB.KEYS.stock,     data.stock);
      if (data.sales)       localStorage.setItem(DB.KEYS.sales,     data.sales);
      if (data.parts)       localStorage.setItem(DB.KEYS.parts,     data.parts);
      if (data.expenses)    localStorage.setItem(DB.KEYS.expenses,  data.expenses);
      if (data.cylinders)   localStorage.setItem(DB.KEYS.cylinders, data.cylinders);
      if (data.stock_logs)  localStorage.setItem('fg_stock_logs',   data.stock_logs);
      if (data.prev_months) localStorage.setItem('fg_prev_months',  data.prev_months);
      DB._cache = {};
    },

    scheduleSave() {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.push(), 1500);
    },

    async push() {
      if (this._syncing) { this._pendingSave = true; return; }
      this._syncing = true;
      DB._updateSyncBadge('saving');

      try {
        const payload = this.exportAll();
        const code = this.getShopCode();

        if (code) {
          // Update existing bin
          const res = await fetch(`${this.API}/${code}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Master-Key': this.API_KEY
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Update failed: ' + res.status);
        } else {
          // Create new bin
          const res = await fetch(this.API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Master-Key': this.API_KEY,
              'X-Bin-Name': 'FojiGas',
              'X-Bin-Private': 'false'
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error('Create failed: ' + res.status);
          const json = await res.json();
          const newCode = json?.metadata?.id || json?.id || null;
          if (!newCode) throw new Error('No bin ID returned from server');
          this.setShopCode(newCode);
        }

        localStorage.setItem(DB.KEYS.lastSync, new Date().toISOString());
        DB._updateSyncBadge('saved');
      } catch (err) {
        console.warn('Sync push failed:', err.message);
        DB._updateSyncBadge('error');
      } finally {
        this._syncing = false;
        if (this._pendingSave) {
          this._pendingSave = false;
          this.push();
        }
      }
    },

    async pull(code) {
      const res = await fetch(`${this.API}/${code}/latest`, {
        headers: { 'X-Master-Key': this.API_KEY }
      });
      if (!res.ok) throw new Error('Bin not found: ' + res.status);
      const json = await res.json();
      const data = json.record || json;
      this.importAll(data);
      localStorage.setItem(DB.KEYS.lastSync, new Date().toISOString());
      return data;
    },

    async loadOnBoot() {
      const code = this.getShopCode();
      if (!code) return;
      DB._updateSyncBadge('loading');
      try {
        await this.pull(code);
        DB._updateSyncBadge('saved');
      } catch (err) {
        console.warn('Boot load failed:', err.message);
        DB._updateSyncBadge('error');
      }
    }
  },

  _updateSyncBadge(state) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;
    const states = {
      saved:   { text: '☁ Saved',    cls: 'sync-badge synced' },
      saving:  { text: '☁ Saving…',  cls: 'sync-badge syncing' },
      loading: { text: '☁ Loading…', cls: 'sync-badge syncing' },
      error:   { text: '☁ Offline',  cls: 'sync-badge error' },
    };
    const s = states[state] || states.saved;
    badge.textContent = s.text;
    badge.className = s.cls;
  },

  // ============================
  // STOCK
  // ============================
  Stock: {
    getAll() { return DB._get(DB.KEYS.stock); },

    getOrInit() {
      let s = DB._get(DB.KEYS.stock);
      if (!s || !s.length) {
        s = [{ id: DB._id(), cyl_12kg: 0, cyl_45kg: 0, gas_kg: 0, updatedAt: DB._today() }];
        DB._set(DB.KEYS.stock, s);
      }
      return s[0];
    },

    update(data) {
      const s = DB._get(DB.KEYS.stock);
      if (s && s.length) {
        Object.assign(s[0], data, { updatedAt: DB._today() });
        DB._set(DB.KEYS.stock, s);
        return s[0];
      } else {
        const rec = { id: DB._id(), ...data, updatedAt: DB._today() };
        DB._set(DB.KEYS.stock, [rec]);
        return rec;
      }
    },

    deductGas(kg) {
      const s = DB.Stock.getOrInit();
      DB.Stock.update({ gas_kg: Math.max(0, (parseFloat(s.gas_kg) || 0) - (parseFloat(kg) || 0)) });
    },

    restoreGas(kg) {
      const s = DB.Stock.getOrInit();
      DB.Stock.update({ gas_kg: (parseFloat(s.gas_kg) || 0) + (parseFloat(kg) || 0) });
    },

    getLogs() {
      try {
        let logs = JSON.parse(localStorage.getItem('fg_stock_logs')) || [];
        let changed = false;
        logs = logs.map(l => { if (!l.id) { l.id = DB._id(); changed = true; } return l; });
        if (changed) localStorage.setItem('fg_stock_logs', JSON.stringify(logs));
        return logs;
      } catch { return []; }
    },

    addLog(entry) {
      const logs = DB.Stock.getLogs();
      logs.unshift({ id: DB._id(), date: DB._today(), ...entry });
      localStorage.setItem('fg_stock_logs', JSON.stringify(logs.slice(0, 200)));
      DB.CloudSync.scheduleSave();
    }
  },

  // ============================
  // CYLINDER INVENTORY
  // ============================
  Cylinders: {
    getAll() { return DB._get(DB.KEYS.cylinders); },
    getByType(type) { return DB._get(DB.KEYS.cylinders).filter(c => c.type === type); },

    add(data) {
      const all = DB._get(DB.KEYS.cylinders);
      if (data.number && all.find(c => c.number === data.number && c.type === data.type)) return null;
      const rec = { id: DB._id(), addedAt: DB._today(), status: 'in_stock', ...data };
      all.unshift(rec);
      DB._set(DB.KEYS.cylinders, all);
      const stock = DB.Stock.getOrInit();
      if (data.type === '12kg') DB.Stock.update({ cyl_12kg: stock.cyl_12kg + 1 });
      else if (data.type === '45kg') DB.Stock.update({ cyl_45kg: stock.cyl_45kg + 1 });
      return rec;
    },

    sell(id) {
      const all = DB._get(DB.KEYS.cylinders);
      const idx = all.findIndex(c => c.id === id);
      if (idx === -1) return false;
      const cyl = all[idx];
      all.splice(idx, 1);
      DB._set(DB.KEYS.cylinders, all);
      const stock = DB.Stock.getOrInit();
      if (cyl.type === '12kg') DB.Stock.update({ cyl_12kg: Math.max(0, stock.cyl_12kg - 1) });
      else if (cyl.type === '45kg') DB.Stock.update({ cyl_45kg: Math.max(0, stock.cyl_45kg - 1) });
      return true;
    },

    delete(id) {
      const all = DB._get(DB.KEYS.cylinders);
      const cyl = all.find(c => c.id === id);
      if (!cyl) return;
      DB._set(DB.KEYS.cylinders, all.filter(c => c.id !== id));
      const stock = DB.Stock.getOrInit();
      if (cyl.type === '12kg') DB.Stock.update({ cyl_12kg: Math.max(0, stock.cyl_12kg - 1) });
      else if (cyl.type === '45kg') DB.Stock.update({ cyl_45kg: Math.max(0, stock.cyl_45kg - 1) });
    },

    count(type) { return DB._get(DB.KEYS.cylinders).filter(c => c.type === type).length; }
  },

  // ============================
  // LPG SALES
  // ============================
  Sales: {
    getAll() { return DB._get(DB.KEYS.sales); },

    add(data) {
      const all = DB._get(DB.KEYS.sales);
      const rec = { id: DB._id(), date: DB._today(), createdAt: new Date().toISOString(), ...data };
      all.unshift(rec);
      DB._set(DB.KEYS.sales, all);
      if (rec.qty_kg) DB.Stock.deductGas(rec.qty_kg);
      return rec;
    },

    update(id, data) {
      const all = DB._get(DB.KEYS.sales);
      const idx = all.findIndex(r => r.id === id);
      if (idx !== -1) {
        const diff = (parseFloat(data.qty_kg) || 0) - (parseFloat(all[idx].qty_kg) || 0);
        if (diff > 0) DB.Stock.deductGas(diff);
        else if (diff < 0) DB.Stock.restoreGas(-diff);
        all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
        DB._set(DB.KEYS.sales, all);
        return all[idx];
      }
      return null;
    },

    delete(id) {
      const all = DB._get(DB.KEYS.sales);
      const rec = all.find(r => r.id === id);
      if (rec && rec.qty_kg) DB.Stock.restoreGas(rec.qty_kg);
      DB._set(DB.KEYS.sales, all.filter(r => r.id !== id));
    },

    getByDate(date)         { return DB._get(DB.KEYS.sales).filter(r => r.date === date); },
    getByMonth(year, month) { return DB._get(DB.KEYS.sales).filter(r => { const d = new Date(r.date); return d.getFullYear() === year && d.getMonth() + 1 === month; }); },
    getByYear(year)         { return DB._get(DB.KEYS.sales).filter(r => new Date(r.date).getFullYear() === year); }
  },

  // ============================
  // PARTS SALES
  // ============================
  Parts: {
    getAll() { return DB._get(DB.KEYS.parts); },

    add(data) {
      const all = DB._get(DB.KEYS.parts);
      const rec = { id: DB._id(), date: DB._today(), createdAt: new Date().toISOString(), ...data };
      all.unshift(rec);
      DB._set(DB.KEYS.parts, all);
      return rec;
    },

    update(id, data) {
      const all = DB._get(DB.KEYS.parts);
      const idx = all.findIndex(r => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
        DB._set(DB.KEYS.parts, all);
        return all[idx];
      }
      return null;
    },

    delete(id) { DB._set(DB.KEYS.parts, DB._get(DB.KEYS.parts).filter(r => r.id !== id)); },

    getByDate(date)         { return DB._get(DB.KEYS.parts).filter(r => r.date === date); },
    getByMonth(year, month) { return DB._get(DB.KEYS.parts).filter(r => { const d = new Date(r.date); return d.getFullYear() === year && d.getMonth() + 1 === month; }); },
    getByYear(year)         { return DB._get(DB.KEYS.parts).filter(r => new Date(r.date).getFullYear() === year); }
  },

  // ============================
  // EXPENSES
  // ============================
  Expenses: {
    getAll() { return DB._get(DB.KEYS.expenses); },

    add(data) {
      const all = DB._get(DB.KEYS.expenses);
      const rec = { id: DB._id(), date: DB._today(), createdAt: new Date().toISOString(), ...data };
      all.unshift(rec);
      DB._set(DB.KEYS.expenses, all);
      return rec;
    },

    update(id, data) {
      const all = DB._get(DB.KEYS.expenses);
      const idx = all.findIndex(r => r.id === id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
        DB._set(DB.KEYS.expenses, all);
        return all[idx];
      }
      return null;
    },

    delete(id) { DB._set(DB.KEYS.expenses, DB._get(DB.KEYS.expenses).filter(r => r.id !== id)); },

    getByDate(date)         { return DB._get(DB.KEYS.expenses).filter(r => r.date === date); },
    getByMonth(year, month) { return DB._get(DB.KEYS.expenses).filter(r => { const d = new Date(r.date); return d.getFullYear() === year && d.getMonth() + 1 === month; }); }
  },

  // ============================
  // LEGACY SYNC (Cloud Sync page compatibility)
  // ============================
  Sync: {
    getSyncCode()  { return DB.CloudSync.getShopCode(); },
    getLastSync()  { return localStorage.getItem(DB.KEYS.lastSync) || null; },
    setSyncCode(c) { DB.CloudSync.setShopCode(c); },
    exportAll()    { return DB.CloudSync.exportAll(); },
    importAll(d)   { return DB.CloudSync.importAll(d); },

    async push() {
      await DB.CloudSync.push();
      return DB.CloudSync.getShopCode();
    },

    async pull(code) {
      await DB.CloudSync.pull(code);
      DB.CloudSync.setShopCode(code);
      return {};
    }
  },

  // ============================
  // UTILITIES
  // ============================
  sum(arr, field) {
    return arr.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0);
  },

  fmt(n) {
    return Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  today()  { return new Date().toISOString().split('T')[0]; },

  nowYM() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
};

// ============================
// PREVIOUS MONTH MANUAL
// ============================
DB.PrevMonth = {
  KEY: 'fg_prev_months',

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  },

  add(data) {
    const all = this.getAll();
    const rec = { id: DB._id(), createdAt: new Date().toISOString(), ...data };
    all.unshift(rec);
    localStorage.setItem(this.KEY, JSON.stringify(all));
    DB.CloudSync.scheduleSave();
    return rec;
  },

  update(id, data) {
    const all = this.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(this.KEY, JSON.stringify(all));
      DB.CloudSync.scheduleSave();
      return all[idx];
    }
    return null;
  },

  delete(id) {
    const all = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(all));
    DB.CloudSync.scheduleSave();
  }
};
