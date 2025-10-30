const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Database = require('./services/database');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'VinLedger - Wine Debtors Manager'
  });

// Email: Queue overdue reminders with simple rate limiting
ipcMain.handle('mail:queueReminders', async (event, payload) => {
  try {
    const { branchId, ratePerMinute } = payload || {};
    const rpm = Number(ratePerMinute || 30);
    const spacingMs = Math.max(0, Math.floor(60000 / (rpm > 0 ? rpm : 30)));
    const settings = await db.getSettings();

    const overdue = await db.getOverdueDebts(branchId || null);
    const list = overdue.filter(d => d.email);
    let success = 0, failed = 0;

    for (const d of list) {
      try {
        // Reuse the sendReminder handler logic by inlining minimal call
        const res = await ipcMain._invokeHandler
          ? await ipcMain._invokeHandler('mail:sendReminder', { debtId: d.id, to: d.email })
          : await (async () => {
              // fallback: directly call transporter logic by sending event to our own handler via ipcMain.handle path
              return await (await ipcMain._events['mail:sendReminder'])(null, { debtId: d.id, to: d.email });
            })();
        if (res && res.success) success++; else failed++;
      } catch (e) {
        failed++;
      }
      if (spacingMs) {
        await new Promise(r => setTimeout(r, spacingMs));
      }
    }
    return { success: true, message: `Queued ${list.length} reminders. Sent: ${success}, Failed: ${failed}.` };
  } catch (error) {
    return { success: false, message: `Queue failed: ${error.message || String(error)}` };
  }
});

// Email: Probe SMTP connection/auth without sending
ipcMain.handle('mail:probe', async () => {
  try {
    const settings = await db.getSettings();
    const host = settings.smtp_host || '';
    const port = Number(settings.smtp_port || 0);
    const user = settings.smtp_username || '';
    const pass = settings.smtp_password || '';
    if (!host || !port || !user || !pass) {
      return { success: false, message: 'Missing SMTP settings (host, port, username, password).' };
    }

// Helper: simple mustache-like replacer for {{placeholders}}
function renderTemplate(str, vars) {
  if (!str) return '';
  return String(str).replace(/{{\s*(\w+)\s*}}/g, (_m, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

// Helper: generate a simple PDF statement for a debt
async function generateDebtPdf(debt, settings) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const currency = settings.currency_symbol || 'KSh';
      const business = settings.business_name || 'VinLedger Store';

      doc.fontSize(18).text(`${business} - Statement`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Customer: ${debt.customer_name || ''}`);
      doc.text(`Email: ${debt.email || ''}`);
      doc.text(`Phone: ${debt.phone || ''}`);
      doc.moveDown();
      doc.text(`Debt ID: ${debt.id}`);
      doc.text(`Date of Purchase: ${new Date(debt.date_of_purchase).toLocaleDateString()}`);
      doc.text(`Due Date: ${new Date(debt.due_date).toLocaleDateString()}`);
      if (debt.reference) doc.text(`Reference: ${debt.reference}`);
      doc.moveDown();
      doc.text(`Items: ${debt.items}`);
      doc.moveDown();
      const total = Number(debt.total_amount);
      const paid = Number(debt.amount_paid || 0);
      const balance = total - paid;
      doc.text(`Total: ${currency} ${total.toLocaleString()}`);
      doc.text(`Paid: ${currency} ${paid.toLocaleString()}`);
      doc.text(`Balance: ${currency} ${balance.toLocaleString()}`);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
    const secure = String(settings.smtp_secure || '0') === '1' || port === 465;
    const requireTLS = String(settings.smtp_require_tls || '1') === '1';
    const rejectUnauthorized = String(settings.smtp_allow_invalid_tls || '0') !== '1';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user, pass },
      tls: { rejectUnauthorized }
    });
    const ok = await transporter.verify();
    return { success: ok === true, message: ok ? 'SMTP connection and auth OK.' : 'SMTP verification failed.' };
  } catch (error) {
    return { success: false, message: `Probe failed: ${error.message || String(error)}` };
  }
});

  const devUrl = 'http://localhost:3001';
  if (!app.isPackaged) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }
  // Diagnostics
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Renderer] did-fail-load:', errorCode, errorDescription, validatedURL);
    // Fallback to local file if dev URL fails
    if (!app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Renderer] did-finish-load');
    mainWindow.webContents.executeJavaScript('console.log("HAS_WINDOW_REQUIRE", typeof window.require)');
  });

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize database
  db = new Database();
  
  createWindow();

  // Auto-update in production
  if (app.isPackaged) {
    try {
      autoUpdater.on('error', (err) => console.error('[Updater] error', err));
      autoUpdater.on('update-available', (info) => console.log('[Updater] update-available', info.version));
      autoUpdater.on('update-not-available', () => console.log('[Updater] update-not-available'));
      autoUpdater.on('download-progress', (p) => {
        if (mainWindow) {
          mainWindow.webContents.send('update:progress', Math.round(p.percent));
        }
      });
      autoUpdater.on('update-available', (info) => {
        if (mainWindow) {
          mainWindow.webContents.send('update:available', info.version);
        }
      });
      autoUpdater.on('update-downloaded', async () => {
        if (mainWindow) {
          mainWindow.webContents.send('update:downloaded');
        }
        const res = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          buttons: ['Restart now', 'Later'],
          defaultId: 0,
          cancelId: 1,
          title: 'Update ready',
          message: 'An update was downloaded. Restart to install now?'
        });
        if (res.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.error('[Updater] failed to start updater', e);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Email: Send a reminder email for a specific debt
ipcMain.handle('mail:sendReminder', async (event, payload) => {
  try {
    const { debtId, to } = payload || {};
    if (!debtId) return { success: false, message: 'Missing debtId.' };

    const settings = await db.getSettings();
    const debt = await db.getDebtById(debtId);
    if (!debt) return { success: false, message: 'Debt not found.' };

    const host = settings.smtp_host || '';
    const port = Number(settings.smtp_port || 0);
    const user = settings.smtp_username || '';
    const pass = settings.smtp_password || '';
    const fromName = settings.smtp_from_name || settings.business_name || '';
    const fromEmail = settings.smtp_from_email || settings.business_email || '';
    const signature = settings.email_signature || '';

    const recipient = to || debt.email;
    if (!recipient) return { success: false, message: 'The customer has no email address on file.' };
    if (!host || !port || !user || !pass || !fromEmail) {
      return { success: false, message: 'Missing SMTP settings. Please fill host, port, username, password and from email.' };
    }

    const secure = String(settings.smtp_secure || '0') === '1' || port === 465;
    const requireTLS = String(settings.smtp_require_tls || '1') === '1';
    const rejectUnauthorized = String(settings.smtp_allow_invalid_tls || '0') !== '1';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user, pass },
      tls: { rejectUnauthorized }
    });

    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const currencySymbol = settings.currency_symbol || 'KSh';
    const balance = Number(debt.total_amount) - Number(debt.amount_paid || 0);
    const businessName = settings.business_name || 'VinLedger Store';

    const templateVars = {
      customer_name: debt.customer_name || 'Customer',
      items: debt.items,
      total: Number(debt.total_amount).toLocaleString(),
      paid: Number(debt.amount_paid || 0).toLocaleString(),
      balance: balance.toLocaleString(),
      due_date: new Date(debt.due_date).toLocaleDateString(),
      purchase_date: new Date(debt.date_of_purchase).toLocaleDateString(),
      currency_symbol: currencySymbol,
      business_name: businessName,
      branch_name: debt.branch_name || '',
      reference: debt.reference || ''
    };

    const subjectTemplate = settings.email_subject_template || `Payment Reminder: Balance {{currency_symbol}} {{balance}} due on {{due_date}}`;
    const htmlTemplate = settings.email_template_html || `
      <p>Dear {{customer_name}},</p>
      <p>This is a friendly reminder regarding your outstanding balance for purchases on {{purchase_date}}.</p>
      <p><strong>Items:</strong> {{items}}</p>
      <p><strong>Total:</strong> {{currency_symbol}} {{total}}</p>
      <p><strong>Paid:</strong> {{currency_symbol}} {{paid}}</p>
      <p><strong>Balance:</strong> {{currency_symbol}} {{balance}}</p>
      <p><strong>Due Date:</strong> {{due_date}}</p>
    `;
    let html = renderTemplate(htmlTemplate, templateVars);
    if (signature) {
      html += `<pre style="white-space:pre-wrap;margin-top:16px;">${signature}</pre>`;
    } else {
      html += `<p>Regards,<br/>${businessName}</p>`;
    }
    const subject = renderTemplate(subjectTemplate, templateVars);

    const replyTo = settings.smtp_reply_to && String(settings.smtp_reply_to).trim() ? String(settings.smtp_reply_to).trim() : undefined;
    let attachments = [];
    if (String(settings.email_attach_pdf || '0') === '1') {
      try {
        const pdfBuffer = await generateDebtPdf(debt, settings);
        attachments.push({ filename: `statement-debt-${debt.id}.pdf`, content: pdfBuffer });
      } catch (e) {
        console.warn('Failed to generate PDF attachment:', e);
      }
    }
    const info = await transporter.sendMail({ from, to: recipient, subject, html, ...(replyTo ? { replyTo } : {}), attachments });

    try {
      await db.logEmail({
        customer_id: debt.customer_id,
        debt_id: debt.id,
        to_email: recipient,
        subject,
        body_snippet: `Balance ${currencySymbol} ${balance.toLocaleString()} due ${new Date(debt.due_date).toLocaleDateString()}`,
        status: 'Sent',
        provider_response: info && info.response ? info.response : JSON.stringify(info)
      });
    } catch (e) {
      console.warn('Failed to log email:', e);
    }

    return { success: true, message: `Reminder sent to ${recipient}. Response: ${info.response || 'OK'}` };
  } catch (error) {
    try {
      const { debtId, to } = payload || {};
      const debt = debtId ? await db.getDebtById(debtId) : null;
      await db.logEmail({
        customer_id: debt ? debt.customer_id : null,
        debt_id: debt ? debt.id : null,
        to_email: to || (debt ? debt.email : ''),
        subject: 'Debt reminder - FAILED',
        body_snippet: 'Reminder send failed',
        status: 'Failed',
        provider_response: String(error)
      });
    } catch (_) {}
    return { success: false, message: `Failed to send reminder: ${error.message || String(error)}` };
  }
});

// IPC handlers for database operations
ipcMain.handle('db:getCustomers', async () => {
  return await db.getCustomers();
});

ipcMain.handle('db:addCustomer', async (event, customer) => {
  return await db.addCustomer(customer);
});

ipcMain.handle('db:updateCustomer', async (event, id, customer) => {
  return await db.updateCustomer(id, customer);
});

ipcMain.handle('db:deleteCustomer', async (event, id) => {
  return await db.deleteCustomer(id);
});

ipcMain.handle('db:getDebts', async (event, branchId) => {
  return await db.getDebts(branchId);
});

ipcMain.handle('db:addDebt', async (event, debt) => {
  return await db.addDebt(debt);
});

ipcMain.handle('db:updateDebt', async (event, id, debt) => {
  return await db.updateDebt(id, debt);
});

ipcMain.handle('db:deleteDebt', async (event, id) => {
  return await db.deleteDebt(id);
});

ipcMain.handle('db:getPayments', async (event, branchId) => {
  return await db.getPayments(branchId);
});

ipcMain.handle('db:addPayment', async (event, payment) => {
  return await db.addPayment(payment);
});

ipcMain.handle('db:getDashboardData', async (event, branchId) => {
  return await db.getDashboardData(branchId);
});

ipcMain.handle('db:getSettings', async () => {
  return await db.getSettings();
});

ipcMain.handle('db:getEmailLog', async () => {
  return await db.getEmailLog();
});

ipcMain.handle('db:updateSettings', async (event, settings) => {
  return await db.updateSettings(settings);
});

// Branches
ipcMain.handle('db:getBranches', async () => {
  return await db.getBranches();
});

ipcMain.handle('db:getAllBranches', async () => {
  return await db.getAllBranches();
});

ipcMain.handle('db:addBranch', async (event, name) => {
  return await db.addBranch(name);
});

ipcMain.handle('db:updateBranch', async (event, id, updates) => {
  return await db.updateBranch(id, updates);
});

ipcMain.handle('db:backup', async () => {
  return await db.createBackup();
});

ipcMain.handle('db:restore', async (event, backupPath) => {
  return await db.restoreBackup(backupPath);
});

ipcMain.handle('db:exportCSV', async (event, type) => {
  return await db.exportCSV(type);
});

// Email: Test configuration and send a test email to the configured from address
ipcMain.handle('mail:test', async (event, payload) => {
  try {
    const settings = await db.getSettings();
    const host = settings.smtp_host || '';
    const port = Number(settings.smtp_port || 0);
    const user = settings.smtp_username || '';
    const pass = settings.smtp_password || '';
    const fromName = settings.smtp_from_name || '';
    const fromEmail = settings.smtp_from_email || '';

    if (!host || !port || !user || !pass || !fromEmail) {
      return { success: false, message: 'Missing SMTP settings. Please fill host, port, username, password and from email.' };
    }

    const secure = String(settings.smtp_secure || '0') === '1' || port === 465; // prefer setting, fallback to port
    const requireTLS = String(settings.smtp_require_tls || '1') === '1';
    const rejectUnauthorized = String(settings.smtp_allow_invalid_tls || '0') !== '1';
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user, pass },
      tls: { rejectUnauthorized }
    });

    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    const to = (payload && payload.to) ? String(payload.to) : fromEmail;
    const replyTo = settings.smtp_reply_to && String(settings.smtp_reply_to).trim() ? String(settings.smtp_reply_to).trim() : undefined;
    const info = await transporter.sendMail({
      from,
      to,
      subject: 'VinLedger SMTP test',
      text: 'This is a test email from VinLedger to confirm your SMTP settings are working.',
      ...(replyTo ? { replyTo } : {})
    });

    // Log email
    try {
      await db.logEmail({
        to_email: to,
        subject: 'VinLedger SMTP test',
        body_snippet: 'This is a test email from VinLedger...',
        status: 'Sent',
        provider_response: info && info.response ? info.response : JSON.stringify(info)
      });
    } catch (e) {
      // Non-fatal
      console.warn('Failed to log email:', e);
    }

    return { success: true, message: `Test email sent to ${to}. Response: ${info.response || 'OK'}` };
  } catch (error) {
    try {
      await db.logEmail({
        to_email: 'self-test',
        subject: 'VinLedger SMTP test',
        body_snippet: 'Failed to send test email',
        status: 'Failed',
        provider_response: String(error)
      });
    } catch (_) {}
    return { success: false, message: `Failed to send test email: ${error.message || String(error)}` };
  }
});

// Manual update check
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { started: false };
  try {
    await autoUpdater.checkForUpdates();
    return { started: true };
  } catch (e) {
    return { started: false, error: String(e) };
  }
});

// File dialog handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'VinLedger Backup', extensions: ['vinledgerbak'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'VinLedger Backup', extensions: ['vinledgerbak'] },
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  });
  return result;
});
