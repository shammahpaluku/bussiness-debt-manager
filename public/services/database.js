const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto-js');
const { app } = require('electron');

class DatabaseService {
  constructor() {
    const userDataDir = path.join(app.getPath('userData'), 'VinLedger');
    const dbPath = path.join(userDataDir, 'data', 'vinledger.db');
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    
    // Initialize database with schema if it doesn't exist
    if (!this.isInitialized()) {
      this.initializeDatabase(schemaPath);
    }
    // Ensure migrations for new features (e.g., branches)
    this.ensureMigrations();
  }

  isInitialized() {
    try {
      const result = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
      return !!result;
    } catch (error) {
      return false;
    }
  }

  initializeDatabase(schemaPath) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  ensureMigrations() {
    try {
      // Create branches table if not exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS branches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add branch_id to customers if missing
      const customerCols = this.db.prepare("PRAGMA table_info(customers)").all().map(c => c.name);
      if (!customerCols.includes('branch_id')) {
        this.db.exec("ALTER TABLE customers ADD COLUMN branch_id INTEGER;");
        // Index
        this.db.exec("CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON customers(branch_id);");
      }

      // Add branch_id to debts if missing
      const debtCols = this.db.prepare("PRAGMA table_info(debts)").all().map(c => c.name);
      if (!debtCols.includes('branch_id')) {
        this.db.exec("ALTER TABLE debts ADD COLUMN branch_id INTEGER;");
        // Index
        this.db.exec("CREATE INDEX IF NOT EXISTS idx_debts_branch_id ON debts(branch_id);");
      }

      // Seed default branches if table is empty
      const count = this.db.prepare('SELECT COUNT(*) as cnt FROM branches').get();
      if (count.cnt === 0) {
        const seed = this.db.prepare('INSERT INTO branches (name, active) VALUES (?, 1)');
        const names = ['westlands','baba dogo','cbd','umoja','ngara','kitengela','nairobi-west'];
        const transaction = this.db.transaction((arr) => {
          arr.forEach(n => seed.run(n));
        });
        transaction(names);
      }
    } catch (error) {
      console.error('Error running migrations:', error);
      // Do not throw to avoid blocking app start; but log for visibility
    }
  }

  // Customer operations
  async getCustomers() {
    try {
      const stmt = this.db.prepare(`
        SELECT c.*, 
               b.name as branch_name,
               COALESCE(SUM(d.total_amount - d.amount_paid), 0) as outstanding_balance
        FROM customers c
        LEFT JOIN debts d ON c.id = d.customer_id AND d.status != 'Cleared'
        LEFT JOIN branches b ON c.branch_id = b.id
        GROUP BY c.id
        ORDER BY outstanding_balance DESC, c.name ASC
      `);
      return stmt.all();
    } catch (error) {
      console.error('Error getting customers:', error);
      throw error;
    }
  }

  async addCustomer(customer) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO customers (name, phone, email, notes, credit_limit, is_blacklisted, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const creditLimit = Number(customer.credit_limit || 0);
      const isBlacklisted = customer.is_blacklisted ? 1 : 0;
      const branchId = customer.branch_id ? Number(customer.branch_id) : null;
      const result = stmt.run(
        String(customer.name || ''),
        customer.phone ? String(customer.phone) : null,
        customer.email ? String(customer.email) : null,
        customer.notes ? String(customer.notes) : null,
        isNaN(creditLimit) ? 0 : creditLimit,
        isBlacklisted,
        branchId
      );
      return { id: result.lastInsertRowid, ...customer };
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }

  async updateCustomer(id, customer) {
    try {
      const stmt = this.db.prepare(`
        UPDATE customers 
        SET name = ?, phone = ?, email = ?, notes = ?, credit_limit = ?, is_blacklisted = ?, branch_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const creditLimit = Number(customer.credit_limit || 0);
      const isBlacklisted = customer.is_blacklisted ? 1 : 0;
      const branchId = customer.branch_id ? Number(customer.branch_id) : null;
      stmt.run(
        String(customer.name || ''),
        customer.phone ? String(customer.phone) : null,
        customer.email ? String(customer.email) : null,
        customer.notes ? String(customer.notes) : null,
        isNaN(creditLimit) ? 0 : creditLimit,
        isBlacklisted,
        branchId,
        Number(id)
      );
      return { id, ...customer };
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  async deleteCustomer(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM customers WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // Debt operations
  async getDebts(branchId) {
    try {
      let sql = `
        SELECT d.*, c.name as customer_name, c.phone, c.email,
               b.name as branch_name
        FROM debts d
        JOIN customers c ON d.customer_id = c.id
        LEFT JOIN branches b ON d.branch_id = b.id
      `;
      if (branchId) {
        sql += ` WHERE d.branch_id = ? `;
      }
      sql += ` ORDER BY d.due_date ASC, d.created_at DESC`;
      const stmt = this.db.prepare(sql);
      return branchId ? stmt.all(branchId) : stmt.all();
    } catch (error) {
      console.error('Error getting debts:', error);
      throw error;
    }
  }

  async addDebt(debt) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO debts (customer_id, date_of_purchase, items, total_amount, due_date, reference, notes, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        debt.customer_id,
        debt.date_of_purchase,
        debt.items,
        debt.total_amount,
        debt.due_date,
        debt.reference || null,
        debt.notes || null,
        debt.branch_id || null
      );
      return { id: result.lastInsertRowid, ...debt };
    } catch (error) {
      console.error('Error adding debt:', error);
      throw error;
    }
  }

  async updateDebt(id, debt) {
    try {
      const stmt = this.db.prepare(`
        UPDATE debts 
        SET customer_id = ?, date_of_purchase = ?, items = ?, total_amount = ?, 
            due_date = ?, reference = ?, notes = ?, branch_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run(
        debt.customer_id,
        debt.date_of_purchase,
        debt.items,
        debt.total_amount,
        debt.due_date,
        debt.reference || null,
        debt.notes || null,
        debt.branch_id || null,
        id
      );
      return { id, ...debt };
    } catch (error) {
      console.error('Error updating debt:', error);
      throw error;
    }
  }

  // Branch operations
  async getBranches() {
    try {
      const stmt = this.db.prepare('SELECT * FROM branches WHERE active = 1 ORDER BY name ASC');
      return stmt.all();
    } catch (error) {
      console.error('Error getting branches:', error);
      throw error;
    }
  }

  async getAllBranches() {
    try {
      const stmt = this.db.prepare('SELECT * FROM branches ORDER BY active DESC, name ASC');
      return stmt.all();
    } catch (error) {
      console.error('Error getting all branches:', error);
      throw error;
    }
  }

  async addBranch(name) {
    try {
      const stmt = this.db.prepare('INSERT INTO branches (name, active) VALUES (?, 1)');
      const res = stmt.run(name);
      return { id: res.lastInsertRowid, name, active: 1 };
    } catch (error) {
      console.error('Error adding branch:', error);
      throw error;
    }
  }

  async updateBranch(id, updates) {
    try {
      const current = this.db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
      if (!current) throw new Error('Branch not found');
      const name = updates.name !== undefined ? updates.name : current.name;
      const active = updates.active !== undefined ? updates.active : current.active;
      const stmt = this.db.prepare('UPDATE branches SET name = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      stmt.run(name, active ? 1 : 0, id);
      return { id, name, active };
    } catch (error) {
      console.error('Error updating branch:', error);
      throw error;
    }
  }

  async deleteDebt(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM debts WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error) {
      console.error('Error deleting debt:', error);
      throw error;
    }
  }

  // Payment operations
  async getPayments(branchId) {
    try {
      let sql = `
        SELECT p.*, c.name as customer_name, d.items, d.total_amount,
               b.name as branch_name
        FROM payments p
        JOIN customers c ON p.customer_id = c.id
        JOIN debts d ON p.debt_id = d.id
        LEFT JOIN branches b ON d.branch_id = b.id
      `;
      if (branchId) {
        sql += ` WHERE d.branch_id = ? `;
      }
      sql += ` ORDER BY p.date DESC, p.created_at DESC`;
      const stmt = this.db.prepare(sql);
      return branchId ? stmt.all(branchId) : stmt.all();
    } catch (error) {
      console.error('Error getting payments:', error);
      throw error;
    }
  }

  async addPayment(payment) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO payments (debt_id, customer_id, date, amount, method, reference, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        payment.debt_id,
        payment.customer_id,
        payment.date,
        payment.amount,
        payment.method,
        payment.reference || null,
        payment.notes || null
      );
      return { id: result.lastInsertRowid, ...payment };
    } catch (error) {
      console.error('Error adding payment:', error);
      throw error;
    }
  }

  // Dashboard data
  async getDashboardData(branchId) {
    try {
      let whereActive = `status != 'Cleared'`;
      let whereOverdue = `status = 'Overdue'`;
      let wherePayments = `date >= date('now', 'start of month')`;
      if (branchId) {
        whereActive += ` AND branch_id = @branchId`;
        whereOverdue += ` AND branch_id = @branchId`;
      }
      const totalOutstanding = this.db.prepare(`
        SELECT COALESCE(SUM(total_amount - amount_paid), 0) as total
        FROM debts WHERE ${whereActive}
      `).get({ branchId });

      const totalOverdue = this.db.prepare(`
        SELECT COALESCE(SUM(total_amount - amount_paid), 0) as total
        FROM debts WHERE ${whereOverdue}
      `).get({ branchId });

      let paymentsSql = `
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN debts d ON p.debt_id = d.id
        WHERE ${wherePayments}
      `;
      if (branchId) paymentsSql += ` AND d.branch_id = @branchId`;
      const thisMonthCollected = this.db.prepare(paymentsSql).get({ branchId });

      let topDebtorsSql = `
        SELECT c.name, c.phone, COALESCE(SUM(d.total_amount - d.amount_paid), 0) as outstanding
        FROM customers c
        LEFT JOIN debts d ON c.id = d.customer_id AND d.status != 'Cleared'
      `;
      if (branchId) topDebtorsSql += ` AND d.branch_id = @branchId`;
      topDebtorsSql += ` GROUP BY c.id HAVING outstanding > 0 ORDER BY outstanding DESC LIMIT 5`;
      const topDebtors = this.db.prepare(topDebtorsSql).all({ branchId });

      let overdueSql = `
        SELECT d.*, c.name as customer_name, c.phone, c.email, b.name as branch_name
        FROM debts d
        JOIN customers c ON d.customer_id = c.id
        LEFT JOIN branches b ON d.branch_id = b.id
        WHERE d.status = 'Overdue'
      `;
      if (branchId) overdueSql += ` AND d.branch_id = @branchId`;
      overdueSql += ` ORDER BY d.due_date ASC LIMIT 10`;
      const overdueDebts = this.db.prepare(overdueSql).all({ branchId });

      return {
        totalOutstanding: totalOutstanding.total,
        totalOverdue: totalOverdue.total,
        thisMonthCollected: thisMonthCollected.total,
        topDebtors,
        overdueDebts
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // Settings operations
  async getSettings() {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM settings');
      const rows = stmt.all();
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      return settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  async updateSettings(settings) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(key, value);
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Backup and restore
  async createBackup() {
    try {
      const backupDir = path.join(app.getPath('userData'), 'VinLedger', 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `vinledger-backup-${timestamp}.vinledgerbak`);
      
      // Export database to SQL
      const backup = this.db.export();
      
      // Encrypt the backup
      const encrypted = crypto.AES.encrypt(backup, 'vinledger-backup-key').toString();
      fs.writeFileSync(backupPath, encrypted);
      
      return backupPath;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  async restoreBackup(backupPath) {
    try {
      const encrypted = fs.readFileSync(backupPath, 'utf8');
      const decrypted = crypto.AES.decrypt(encrypted, 'vinledger-backup-key').toString(crypto.enc.Utf8);
      
      // Close current database
      this.db.close();
      
      // Restore from backup
      this.db = new Database(':memory:');
      this.db.exec(decrypted);
      
      // Save to file
      const dbPath = path.join(app.getPath('userData'), 'VinLedger', 'data', 'vinledger.db');
      const data = this.db.export();
      fs.writeFileSync(dbPath, data);
      
      // Reopen database
      this.db = new Database(dbPath);
      
      return { success: true };
    } catch (error) {
      console.error('Error restoring backup:', error);
      throw error;
    }
  }

  // CSV Export
  async exportCSV(type) {
    try {
      let data, filename;
      
      switch (type) {
        case 'customers':
          data = await this.getCustomers();
          filename = 'customers.csv';
          break;
        case 'debts':
          data = await this.getDebts();
          filename = 'debts.csv';
          break;
        case 'payments':
          data = await this.getPayments();
          filename = 'payments.csv';
          break;
        default:
          throw new Error('Invalid export type');
      }
      
      if (data.length === 0) {
        throw new Error('No data to export');
      }
      
      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
      ].join('\n');
      
      const exportPath = path.join(app.getPath('userData'), 'VinLedger', 'exports', filename);
      const exportDir = path.dirname(exportPath);
      
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      fs.writeFileSync(exportPath, csvContent);
      return exportPath;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;
