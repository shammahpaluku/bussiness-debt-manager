# VinLedger - Wine Debtors Manager

A lightweight, secure desktop application for managing wine and liquor customer credit (debts), recording payments, and sending email reminders. Built with Electron, React, and SQLite.

## Features

### Core Functionality
- **Customer Management**: Add, edit, and manage customer information with credit limits and blacklist status
- **Debt Tracking**: Record customer purchases on credit with due dates and automatic balance calculations
- **Payment Recording**: Track partial and full payments with multiple payment methods
- **Dashboard**: Real-time overview of outstanding balances, overdue debts, and key metrics
- **Email Integration**: Send payment receipts, overdue reminders, and customer statements
- **Backup & Restore**: Encrypted local backups and CSV export/import functionality

### Key Features
- **Offline-First**: Works without internet connection, stores data locally
- **Single-User**: No complex multi-user setup, perfect for small business owners
- **Automatic Calculations**: Real-time balance updates and overdue status detection
- **Responsive Design**: Works on desktop and tablet devices
- **Data Security**: Local encryption for backups and secure data storage

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone or download the project**
   ```bash
   cd wine_debtors
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the application**
   ```bash
   npm start
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Usage

### First Time Setup
1. Launch the application
2. Go to Settings and configure your business information
3. Set up your currency preferences
4. Configure SMTP settings for email functionality (optional)
5. Add your first customer

### Managing Customers
- Navigate to the Customers page
- Click "Add Customer" to create new customer records
- Include contact information, credit limits, and notes
- Edit or delete customers as needed

### Recording Debts
- Go to the Debts page
- Click "Add New Debt" to record a credit purchase
- Select customer, enter items description, amount, and due date
- The system automatically calculates outstanding balances

### Recording Payments
- Navigate to the Payments page
- Click "Record Payment" to log a payment
- Select the debt being paid and enter payment details
- Balances update automatically

### Dashboard Overview
- View key metrics: total outstanding, overdue amounts, monthly collections
- See top debtors and overdue debts at a glance
- Quick access to common actions

### Settings & Configuration
- **General**: Business information and currency settings
- **Email**: SMTP configuration for sending receipts and reminders
- **Backup**: Create encrypted backups and export data to CSV

## Database Schema

The application uses SQLite with the following main tables:
- `customers`: Customer information and credit limits
- `debts`: Credit purchases with amounts and due dates
- `payments`: Payment records linked to debts
- `email_log`: Email sending history
- `settings`: Application configuration

## Security Features

- **Local Data Storage**: All data stored locally in encrypted SQLite database
- **Encrypted Backups**: Backup files are encrypted with AES-256
- **No Cloud Dependencies**: Complete offline operation
- **Secure SMTP**: Passwords stored securely for email functionality

## Email Templates

The application includes built-in email templates for:
- Payment receipts
- Overdue reminders
- Customer statements
- Bulk reminder campaigns

## Backup & Export

- **Automatic Backups**: Create encrypted backups of all data
- **CSV Export**: Export customers, debts, and payments to CSV
- **Data Portability**: Easy migration and data sharing

## Technical Details

### Built With
- **Frontend**: React 18, HTML5, CSS3
- **Backend**: Electron, Node.js
- **Database**: SQLite with better-sqlite3
- **Email**: Nodemailer with SMTP support
- **Encryption**: Crypto-js for backup encryption

### File Structure
```
wine_debtors/
├── database/
│   └── schema.sql          # Database schema
├── public/
│   ├── electron.js         # Main Electron process
│   ├── services/
│   │   └── database.js     # Database service layer
│   └── data/               # SQLite database files
├── src/
│   ├── components/         # React components
│   ├── pages/             # Page components
│   ├── styles/            # CSS styles
│   └── App.js             # Main React app
└── package.json
```

## Development

### Running in Development Mode
```bash
npm start
```

### Building for Production
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:win    # Windows
npm run build:linux  # Linux
npm run build:mac    # macOS
```

### Project Scripts
- `npm start`: Start development server with hot reload
- `npm run webpack:build`: Build React app for production
- `npm run electron:dev`: Run Electron in development mode
- `npm run build`: Build complete application
- `npm run dist`: Create distribution packages

## Troubleshooting

### Common Issues

1. **Database not initializing**
   - Check that the database directory exists and is writable
   - Verify SQLite installation

2. **Email not sending**
   - Verify SMTP settings in Settings > Email
   - Check internet connection
   - Ensure app passwords are used for Gmail

3. **Build errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility

### Support
For issues and feature requests, please check the application logs in the developer console.

## License

MIT License - see LICENSE file for details.

## Version History

### v1.0.0
- Initial release
- Core debt management functionality
- Customer management
- Payment tracking
- Dashboard with key metrics
- Email integration
- Backup and restore
- CSV export/import
