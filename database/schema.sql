-- VinLedger Database Schema
-- Wine & Liquor Debtors Manager

-- Customers table
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    credit_limit REAL DEFAULT 0.0,
    is_blacklisted BOOLEAN DEFAULT 0,
    branch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Debts table
CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    date_of_purchase DATE NOT NULL,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL,
    amount_paid REAL DEFAULT 0.0,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Overdue', 'Cleared')),
    reference TEXT,
    notes TEXT,
    branch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Branches table
CREATE TABLE branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    date DATE NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('Cash', 'Bank', 'M-Pesa', 'Other')),
    reference TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Email log table
CREATE TABLE email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    debt_id INTEGER,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_snippet TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Sent' CHECK (status IN ('Sent', 'Failed')),
    provider_response TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
);

-- Settings table (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_branch_id ON customers(branch_id);
CREATE INDEX idx_debts_customer_id ON debts(customer_id);
CREATE INDEX idx_debts_due_date ON debts(due_date);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_branch_id ON debts(branch_id);
CREATE INDEX idx_payments_debt_id ON payments(debt_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_email_log_customer_id ON email_log(customer_id);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);

-- Triggers to update timestamps
CREATE TRIGGER update_customers_timestamp 
    AFTER UPDATE ON customers
    BEGIN
        UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_debts_timestamp 
    AFTER UPDATE ON debts
    BEGIN
        UPDATE debts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger to update debt status when payments are made
CREATE TRIGGER update_debt_status_after_payment
    AFTER INSERT ON payments
    BEGIN
        UPDATE debts 
        SET amount_paid = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM payments 
            WHERE debt_id = NEW.debt_id
        ),
        status = CASE 
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = NEW.debt_id) >= total_amount 
            THEN 'Cleared'
            WHEN due_date < date('now') AND (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = NEW.debt_id) < total_amount
            THEN 'Overdue'
            ELSE 'Active'
        END
        WHERE id = NEW.debt_id;
    END;

-- Trigger to update debt status when payments are updated
CREATE TRIGGER update_debt_status_after_payment_update
    AFTER UPDATE ON payments
    BEGIN
        UPDATE debts 
        SET amount_paid = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM payments 
            WHERE debt_id = NEW.debt_id
        ),
        status = CASE 
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = NEW.debt_id) >= total_amount 
            THEN 'Cleared'
            WHEN due_date < date('now') AND (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = NEW.debt_id) < total_amount
            THEN 'Overdue'
            ELSE 'Active'
        END
        WHERE id = NEW.debt_id;
    END;

-- Trigger to update debt status when payments are deleted
CREATE TRIGGER update_debt_status_after_payment_delete
    AFTER DELETE ON payments
    BEGIN
        UPDATE debts 
        SET amount_paid = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM payments 
            WHERE debt_id = OLD.debt_id
        ),
        status = CASE 
            WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = OLD.debt_id) >= total_amount 
            THEN 'Cleared'
            WHEN due_date < date('now') AND (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE debt_id = OLD.debt_id) < total_amount
            THEN 'Overdue'
            ELSE 'Active'
        END
        WHERE id = OLD.debt_id;
    END;

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
    ('business_name', 'VinLedger Store'),
    ('business_address', ''),
    ('business_phone', ''),
    ('business_email', ''),
    ('currency', 'KES'),
    ('currency_symbol', 'KSh'),
    ('reminder_schedule', '{"before_due": 3, "on_due": true, "after_due": 3}'),
    ('smtp_host', ''),
    ('smtp_port', '587'),
    ('smtp_username', ''),
    ('smtp_password', ''),
    ('smtp_from_name', ''),
    ('smtp_from_email', ''),
    ('backup_location', ''),
    ('app_pin', ''),
    ('email_signature', 'Best regards,\nVinLedger Store');

-- Seed default branches
INSERT INTO branches (name, active) VALUES 
    ('westlands', 1),
    ('baba dogo', 1),
    ('cbd', 1),
    ('umoja', 1),
    ('ngara', 1),
    ('kitengela', 1),
    ('nairobi-west', 1);
