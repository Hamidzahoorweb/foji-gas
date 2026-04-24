// ===== FOJI GAS — DATABASE v3 (localStorage + Cloud Sync) =====

const DB = {
  // ---- KEYS ----
  KEYS: {
    stock: 'fg_stock',
    sales: 'fg_sales',
    parts: 'fg_parts',
    expenses: 'fg_expenses',
    settings: 'fg_settings',
    cylinders: 'fg_cylinders',   // NEW: individual cylinder inventory
    syncCode: 'fg_sync_code',    // NEW: device sync code
    lastSync: 'fg_last_sync',    // NEW: last sync timestamp
  },

  // ---- HELPERS ----
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  _id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
  _today() {
    return new Date().toISOString().split('T')[0];
  },

  // ============================
  // STOCK
  // ============================
  Stock: {
    getAll() { return DB._get(DB.KEYS.stock); },

    getOrInit() {
      let s = DB._get(DB.KEYS.stock);
      if (!s.length) {
        s = [{
          id: DB._id(),
          cyl_12kg: 0,
          cyl_45kg: 0,
          gas_kg: 0,
          updatedAt: DB._today()
        }];
        DB._set(DB.KEYS.stock, s);
      }
      return s[0];
    },

    update(data) {
      const s = DB._get(DB.KEYS.stock);
      if (s.length) {
        Object.assign(s[0], data, { updatedAt: DB._today() });
        DB._set(DB.KEYS.stock, s);
        return s[0];
      } else {
        const rec = { id: DB._id(), ...data, updatedAt: DB._today() };
        DB._set(DB.KEYS.stock, [rec]);
        return rec;
      }
    },

    // Deduct gas_kg when a sale is recorded
    deductGas(kg) {
      const s = DB.Stock.getOrInit();
      const newKg = Math.max(0, (parseFloat(s.gas_kg) || 0) - (parseFloat(kg) || 0));
      DB.Stock.update({ gas_kg: newKg });
    },

    // Restore gas_kg when a sale is deleted
    restoreGas(kg) {
      const s = DB.Stock.getOrInit();
      const newKg = (parseFloat(s.gas_kg) || 0) + (parseFloat(kg) || 0);
      DB.Stock.update({ gas_kg: newKg });
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
    }
  },

  // ============================
  // CYLINDER INVENTORY (NEW)
  // ============================
  Cylinders: {
    getAll() { return DB._get(DB.KEYS.cylinders); },

    getByType(type) {
      return DB._get(DB.KEYS.cylinders).filter(c => c.type === type);
    },

    add(data) {
      const all = DB._get(DB.KEYS.cylinders);
      // Check for duplicate cylinder number
      if (data.number && all.find(c => c.number === data.number && c.type === data.type)) {
        return null; // duplicate
      }
      const rec = {
        id: DB._id(),
        addedAt: DB._today(),
        status: 'in_stock',
        ...data
      };
      all.unshift(rec);
      DB._set(DB.KEYS.cylinders, all);
      // Also update summary stock count
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
      all.splice(idx, 1); // remove from inventory
      DB._set(DB.KEYS.cylinders, all);
      // Update summary stock count
      const stock = DB.Stock.getOrInit();
      if (cyl.type === '12kg') DB.Stock.update({ cyl_12kg: Math.max(0, stock.cyl_12kg - 1) });
      else if (cyl.type === '45kg') DB.Stock.update({ cyl_45kg: Math.max(0, stock.cyl_45kg - 1) });
      return true;
    },

    delete(id) {
      const all = DB._get(DB.KEYS.cylinders);
      const cyl = all.find(c => c.id === id);
      if (!cyl) return;
      const filtered = all.filter(c => c.id !== id);
      DB._set(DB.KEYS.cylinders, filtered);
      // Update summary stock count
      const stock = DB.Stock.getOrInit();
      if (cyl.type === '12kg') DB.Stock.update({ cyl_12kg: Math.max(0, stock.cyl_12kg - 1) });
      else if (cyl.type === '45kg') DB.Stock.update({ cyl_45kg: Math.max(0, stock.cyl_45kg - 1) });
    },

    count(type) {
      return DB._get(DB.KEYS.cylinders).filter(c => c.type === type).length;
    }
  },

  // ============================
  // LPG SALES
  // ============================
  Sales: {
    getAll() { return DB._get(DB.KEYS.sales); },

    add(data) {
      const all = DB._get(DB.KEYS.sales);
      const rec = {
        id: DB._id(),
        date: DB._today(),
        createdAt: new Date().toISOString(),
        ...data
      };
      all.unshift(rec);
      DB._set(DB.KEYS.sales, all);
      // Auto-deduct gas stock
      if (rec.qty_kg) DB.Stock.deductGas(rec.qty_kg);
      return rec;
    },

    update(id, data) {
      const all = DB._get(DB.KEYS.sales);
      const idx = all.findIndex(r => r.id === id);
      if (idx !== -1) {
        // Restore old qty then deduct new qty
        const oldKg = parseFloat(all[idx].qty_kg) || 0;
        const newKg = parseFloat(data.qty_kg) || 0;
        const diff = newKg - oldKg;
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

    getByDate(date) {
      return DB._get(DB.KEYS.sales).filter(r => r.date === date);
    },

    getByMonth(year, month) {
      return DB._get(DB.KEYS.sales).filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    },

    getByYear(year) {
      return DB._get(DB.KEYS.sales).filter(r => {
        return new Date(r.date).getFullYear() === year;
      });
    }
  },

  // ============================
  // PARTS SALES
  // ============================
  Parts: {
    getAll() { return DB._get(DB.KEYS.parts); },

    add(data) {
      const all = DB._get(DB.KEYS.parts);
      const rec = {
        id: DB._id(),
        date: DB._today(),
        createdAt: new Date().toISOString(),
        ...data
      };
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

    delete(id) {
      const all = DB._get(DB.KEYS.parts).filter(r => r.id !== id);
      DB._set(DB.KEYS.parts, all);
    },

    getByDate(date) {
      return DB._get(DB.KEYS.parts).filter(r => r.date === date);
    },

    getByMonth(year, month) {
      return DB._get(DB.KEYS.parts).filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    },

    getByYear(year) {
      return DB._get(DB.KEYS.parts).filter(r => {
        return new Date(r.date).getFullYear() === year;
      });
    }
  },

  // ============================
  // EXPENSES
  // ============================
  Expenses: {
    getAll() { return DB._get(DB.KEYS.expenses); },

    add(data) {
      const all = DB._get(DB.KEYS.expenses);
      const rec = {
        id: DB._id(),
        date: DB._today(),
        createdAt: new Date().toISOString(),
        ...data
      };
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

    delete(id) {
      const all = DB._get(DB.KEYS.expenses).filter(r => r.id !== id);
      DB._set(DB.KEYS.expenses, all);
    },

    getByDate(date) {
      return DB._get(DB.KEYS.expenses).filter(r => r.date === date);
    },

    getByMonth(year, month) {
      return DB._get(DB.KEYS.expenses).filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }
  },

  // ============================
  // CLOUD SYNC (via JSONBlob API — free, no account needed)
  // ============================
  Sync: {
    JSONBLOB_API: 'https://jsonblob.com/api/jsonBlob',

    getSyncCode() {
      return localStorage.getItem(DB.KEYS.syncCode) || null;
    },

    setSyncCode(code) {
      localStorage.setItem(DB.KEYS.syncCode, code);
    },

    getLastSync() {
      return localStorage.getItem(DB.KEYS.lastSync) || null;
    },

    setLastSync() {
      localStorage.setItem(DB.KEYS.lastSync, new Date().toISOString());
    },

    // Export all local data
    exportAll() {
      return {
        stock: localStorage.getItem(DB.KEYS.stock),
        sales: localStorage.getItem(DB.KEYS.sales),
        parts: localStorage.getItem(DB.KEYS.parts),
        expenses: localStorage.getItem(DB.KEYS.expenses),
        cylinders: localStorage.getItem(DB.KEYS.cylinders),
        stock_logs: localStorage.getItem('fg_stock_logs'),
        prev_months: localStorage.getItem('fg_prev_months'),
        exportedAt: new Date().toISOString()
      };
    },

    // Import data from a cloud snapshot
    importAll(data) {
      if (data.stock) localStorage.setItem(DB.KEYS.stock, data.stock);
      if (data.sales) localStorage.setItem(DB.KEYS.sales, data.sales);
      if (data.parts) localStorage.setItem(DB.KEYS.parts, data.parts);
      if (data.expenses) localStorage.setItem(DB.KEYS.expenses, data.expenses);
      if (data.cylinders) localStorage.setItem(DB.KEYS.cylinders, data.cylinders);
      if (data.stock_logs) localStorage.setItem('fg_stock_logs', data.stock_logs);
      if (data.prev_months) localStorage.setItem('fg_prev_months', data.prev_months);
    },

    // Push local data to cloud (creates new blob or updates existing)
    async push() {
      const payload = JSON.stringify(DB.Sync.exportAll());
      const code = DB.Sync.getSyncCode();
      if (code) {
        // Update existing blob
        const res = await fetch(`${DB.Sync.JSONBLOB_API}/${code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: payload
        });
        if (!res.ok) throw new Error('Sync push failed');
        DB.Sync.setLastSync();
        return code;
      } else {
        // Create new blob
        const res = await fetch(DB.Sync.JSONBLOB_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: payload
        });
        if (!res.ok) throw new Error('Sync create failed');
        const location = res.headers.get('Location') || '';
        const newCode = location.split('/').pop();
        DB.Sync.setSyncCode(newCode);
        DB.Sync.setLastSync();
        return newCode;
      }
    },

    // Pull data from cloud using a sync code
    async pull(code) {
      const res = await fetch(`${DB.Sync.JSONBLOB_API}/${code}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Sync code not found');
      const data = await res.json();
      DB.Sync.importAll(data);
      DB.Sync.setSyncCode(code);
      DB.Sync.setLastSync();
      return data;
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

  today() { return new Date().toISOString().split('T')[0]; },

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
  getAll() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  add(data) {
    const all = this.getAll();
    const rec = { id: DB._id(), createdAt: new Date().toISOString(), ...data };
    all.unshift(rec);
    localStorage.setItem(this.KEY, JSON.stringify(all));
    return rec;
  },
  update(id, data) {
    const all = this.getAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(this.KEY, JSON.stringify(all));
      return all[idx];
    }
    return null;
  },
  delete(id) {
    const all = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(this.KEY, JSON.stringify(all));
  }
};
