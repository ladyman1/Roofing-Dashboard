# Roofing Department Reporting Dashboard

A modern, high-performance Node.js reporting dashboard built for the Roofing Department. Architected for straightforward deployment on any Linux or Windows VM, supporting **SQLite** out-of-the-box (single file, zero database installation) and instant compatibility with **PostgreSQL** via environment variables.

---

## Key Features

- **Dual Light / Dark View (Light View Default)**:
  - Clean, high-contrast white executive theme enabled by default.
  - Interactive Theme Toggle (Sun/Moon button) with persistent `localStorage` preference and adaptive chart color palettes.
- **Incremental Monthly Uploads & MoM Trend Tracking**:
  - Ingest new monthly datasets (or as-and-when) without overwriting historical periods.
  - Dedicated **Monthly Incremental Performance (MoM Trend)** chart comparing Revenue, Margin £, and Margin % progression across time.
  - Upload mode options: *Incremental Append* (default) or *Replace/Update existing period*.
  - Upload Batch Management with one-click **Batch Deletion** for rolling back accidental uploads.
- **Executive KPI Scorecards**:
  - Period Revenue (£203,496.89 baseline)
  - Gross Profit Margin (£54,391.66) & Overall Margin % (26.73%)
  - Total Invoiced Volume Sold (44,356.62 units)
  - Invoice vs Credit Transactions (2,499 invoices vs 82 credit notes, 3.18% return rate)
  - Channel Breakdown (Credit Stock Sales 93.6% vs Cash Stock Sales 6.4%)
  - Cumulative Year-to-Date (YTD) Revenue (£1.72m) and Margins (£421k)
- **Visual Analytics (Chart.js)**:
  - Monthly MoM Trend Line & Bar chart
  - Subgroup Revenue vs Gross Margin (£) grouped bar chart
  - Profitability Spectrum (% Margin ranking across all 17 categories)
  - Sales Channel Distribution Donut (Cash vs Credit)
  - Credit / Return Risk Analysis
- **Interactive Performance Matrix**:
  - Granular table covering all 17 roofing sub-groups (Slates, Battens, Felts, Lead, Windows, etc.)
  - Real-time search, multi-column sorting, and margin health badges
  - CSV Export of filtered views
- **Data Ingestion Engine**:
  - Drag-and-drop CSV / TSV uploader
  - Direct paste tab for copy-pasting from ERP/Excel exports
  - Delimiter auto-detection (tabs, commas, semicolons)
  - Data validation and margin recalculation
- **Dual Database Architecture (Knex.js)**:
  - **SQLite** (Default): Stores data in `./data/roofing.db` — runs anywhere without installing a database server.
  - **PostgreSQL**: Production-ready. Set `DATABASE_URL` in `.env` to connect to PostgreSQL; tables and indexes auto-migrate on boot.

---

## Quick Start (Local / VM)

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22.12.0)
- **npm**: v9+

### 2. Installation
```bash
# Navigate to project folder
cd "Roofing Dashboard"

# Install dependencies
npm install
```

### 3. Run the Dashboard
```bash
# Start server (auto-initializes database & seeds initial August 2026 data)
npm start
```
Open your browser and navigate to:
```
http://localhost:3999
```

---

## Database Configuration (SQLite vs PostgreSQL)

The app automatically configures itself based on `DATABASE_URL` in `.env`:

### Option A: SQLite (Default)
No setup required. The database file is created at `./data/roofing.db`.
```env
PORT=3999
DATABASE_URL=sqlite:./data/roofing.db
```

### Option B: PostgreSQL
If your VM runs PostgreSQL (or you have an AWS RDS / Azure Postgres instance):
```env
PORT=3999
DATABASE_URL=postgresql://username:your_password@localhost:5432/roofing_db
```
When the app starts up, it connects to PostgreSQL, creates the `upload_batches` and `sales_records` tables, builds the required indexes, and seeds the baseline dataset automatically.

---

## Hosting on a Linux VM (Ubuntu / Debian / RHEL)

### Method 1: Systemd Service (Recommended for dedicated VMs)

1. Copy the project to your VM:
   ```bash
   sudo mkdir -p /var/www/roofing-dashboard
   sudo cp -r . /var/www/roofing-dashboard
   cd /var/www/roofing-dashboard
   npm install --production
   ```

2. Copy the systemd service unit file:
   ```bash
   sudo cp deploy/roofing-dashboard.service /etc/systemd/system/
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable roofing-dashboard
   sudo systemctl start roofing-dashboard
   ```

4. Check status and logs:
   ```bash
   sudo systemctl status roofing-dashboard
   sudo journalctl -u roofing-dashboard -f
   ```

---

### Method 2: PM2 Process Manager

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start using the included ecosystem config:
   ```bash
   # Running with SQLite
   pm2 start ecosystem.config.js

   # Or running with PostgreSQL
   pm2 start ecosystem.config.js --env production_postgres
   ```

3. Save process list to auto-start on VM reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

---

### Method 3: Docker & Docker Compose (with PostgreSQL)

If your VM has Docker installed, you can spin up the Node app and PostgreSQL in one command:
```bash
docker compose up -d
```
This starts:
- `roofing-dashboard-db`: PostgreSQL 16 on port 5432
- `roofing-dashboard-app`: Node.js Dashboard on port 3999

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health probe & reports active database engine (`sqlite` or `postgresql`) |
| `GET` | `/api/dates` | List of all reporting periods currently in the database |
| `GET` | `/api/kpis` | Aggregated executive KPIs (Revenue, Margins, Volumes, Invoices, Channel split) |
| `GET` | `/api/subgroups` | Performance metrics grouped by roofing category with sorting & filtering |
| `GET` | `/api/tosm` | Breakdown by sales channel (Credit stock vs Cash stock sales) |
| `GET` | `/api/records` | Paginated raw record log with search and column ordering |
| `POST` | `/api/upload` | Ingest CSV or TSV file (multipart form or JSON payload) |
| `POST` | `/api/seed` | Reset or re-seed baseline August 2026 data (`{"force": true}`) |
| `GET` | `/api/export` | Download filtered records as a CSV file |
| `GET` | `/api/batches` | Audit log of all ingested file batches |

---

## File Structure

```
Roofing Dashboard/
├── data/
│   ├── sample_data.csv          # Baseline CSV dataset (August 2026)
│   └── sample_data.tsv          # Baseline TSV dataset (tab-separated)
├── deploy/
│   └── roofing-dashboard.service# Systemd service unit template for Linux VM
├── public/
│   ├── index.html               # Main dashboard UI
│   ├── styles.css               # Styling, custom theme, badge classes
│   └── app.js                   # Reactive UI controller & Chart.js logic
├── src/
│   ├── db/
│   │   ├── knex.js              # Knex database connection (SQLite & PG driver)
│   │   └── schema.js            # Auto-migration runner & index creation
│   ├── routes/
│   │   └── api.js               # REST API endpoints
│   ├── scripts/
│   │   └── seed.js              # Standalone seed CLI script
│   ├── services/
│   │   ├── csvParser.js         # Delimiter auto-detection & data normalization
│   │   └── seeder.js            # Initial dataset loader
│   └── server.js                # Express server entrypoint
├── test/
│   └── api.test.js              # Automated validation tests
├── .env.example                 # Environment variable template
├── docker-compose.yml           # PostgreSQL + Node container stack
├── Dockerfile                   # Node production image
├── ecosystem.config.js          # PM2 process manager config
└── package.json                 # Project dependencies & scripts
```
