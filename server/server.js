const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware - Enhanced CORS for LAN access
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configuration for file uploads (POD documents)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Initialize SQLite database
const db = new sqlite3.Database('./transport_management.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const tables = [
    // Loading Slips
    `CREATE TABLE IF NOT EXISTS loading_slips (
      id TEXT PRIMARY KEY,
      slipNumber TEXT UNIQUE,
      loadingDate TEXT,
      vehicleNumber TEXT,
      from_location TEXT,
      to_location TEXT,
      partyName TEXT,
      partyPersonName TEXT,
      supplierDetail TEXT,
      materialType TEXT,
      weight REAL,
      freight REAL,
      advance REAL,
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Memos
    `CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      memoNumber TEXT UNIQUE,
      loadingDate TEXT,
      from_location TEXT,
      to_location TEXT,
      supplierName TEXT,
      partyName TEXT,
      vehicleNumber TEXT,
      weight REAL,
      materialType TEXT,
      freight REAL,
      mamul REAL,
      detention REAL,
      extraCharge REAL,
      commissionPercentage REAL DEFAULT 6,
      commission REAL,
      balance REAL,
      status TEXT DEFAULT 'pending',
      paidDate TEXT,
      paidAmount REAL DEFAULT 0,
      advances TEXT, -- JSON string
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Bills
    `CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      billNumber TEXT UNIQUE,
      billDate TEXT,
      partyName TEXT,
      totalAmount REAL,
      receivedAmount REAL DEFAULT 0,
      balance REAL,
      status TEXT DEFAULT 'pending',
      receivedDate TEXT,
      trips TEXT, -- JSON string
      advances TEXT, -- JSON string
      podFile TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Banking/Cashbook
    `CREATE TABLE IF NOT EXISTS bank_entries (
      id TEXT PRIMARY KEY,
      date TEXT,
      particulars TEXT,
      category TEXT,
      amount REAL,
      type TEXT, -- 'credit' or 'debit'
      relatedId TEXT, -- Bill ID or Memo ID
      relatedType TEXT, -- 'bill' or 'memo'
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Parties
    `CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      contact TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Suppliers
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      contact TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )`,
    
    // Counters
    `CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      value INTEGER
    )`
  ];

  tables.forEach(table => {
    db.run(table, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      }
    });
  });

  // Initialize counters
  const counters = [
    { id: 'loadingSlip', value: 1001 },
    { id: 'memo', value: 2001 },
    { id: 'bill', value: 6030 }
  ];

  counters.forEach(counter => {
    db.run(
      'INSERT OR IGNORE INTO counters (id, value) VALUES (?, ?)',
      [counter.id, counter.value]
    );
  });
}

// Generic CRUD operations
function createCRUDRoutes(tableName, primaryKey = 'id') {
  // GET all records
  app.get(`/api/${tableName}`, (req, res) => {
    db.all(`SELECT * FROM ${tableName} ORDER BY createdAt DESC`, (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    });
  });

  // GET single record
  app.get(`/api/${tableName}/:id`, (req, res) => {
    db.get(`SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`, [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else if (!row) {
        res.status(404).json({ error: 'Record not found' });
      } else {
        res.json(row);
      }
    });
  });

  // POST new record
  app.post(`/api/${tableName}`, (req, res) => {
    const data = req.body;
    data.createdAt = new Date().toISOString();
    data.updatedAt = new Date().toISOString();

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    db.run(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
      values,
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          // Broadcast the new record to all connected clients
          io.emit(`${tableName}_created`, { id: data[primaryKey], ...data });
          res.json({ id: data[primaryKey], ...data });
        }
      }
    );
  });

  // PUT update record
  app.put(`/api/${tableName}/:id`, (req, res) => {
    const data = req.body;
    data.updatedAt = new Date().toISOString();

    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), req.params.id];

    db.run(
      `UPDATE ${tableName} SET ${updates} WHERE ${primaryKey} = ?`,
      values,
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          // Broadcast the updated record to all connected clients
          io.emit(`${tableName}_updated`, { id: req.params.id, ...data });
          res.json({ id: req.params.id, ...data });
        }
      }
    );
  });

  // DELETE record
  app.delete(`/api/${tableName}/:id`, (req, res) => {
    db.run(`DELETE FROM ${tableName} WHERE ${primaryKey} = ?`, [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        // Broadcast the deletion to all connected clients
        io.emit(`${tableName}_deleted`, { id: req.params.id });
        res.json({ message: 'Record deleted successfully' });
      }
    });
  });
}

// Create CRUD routes for all tables
createCRUDRoutes('loading_slips');
createCRUDRoutes('memos');
createCRUDRoutes('bills');
createCRUDRoutes('bank_entries');
createCRUDRoutes('parties');
createCRUDRoutes('suppliers');

// Counter management
app.get('/api/counters', (req, res) => {
  db.all('SELECT * FROM counters', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      const counters = {};
      rows.forEach(row => {
        counters[row.id] = row.value;
      });
      res.json(counters);
    }
  });
});

app.put('/api/counters/:id', (req, res) => {
  const { value } = req.body;
  db.run(
    'UPDATE counters SET value = ? WHERE id = ?',
    [value, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        io.emit('counter_updated', { id: req.params.id, value });
        res.json({ id: req.params.id, value });
      }
    }
  );
});

// File upload endpoint for POD documents
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    message: 'File uploaded successfully',
    filename: req.file.filename,
    url: fileUrl,
    originalName: req.file.originalname
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle real-time data sync requests
  socket.on('sync_request', (tableName) => {
    db.all(`SELECT * FROM ${tableName} ORDER BY createdAt DESC`, (err, rows) => {
      if (!err) {
        socket.emit('sync_response', { tableName, data: rows });
      }
    });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

// Start server on 0.0.0.0 to accept connections from any IP
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Transport Management Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Database: SQLite (transport_management.db)`);
  console.log(`🌐 LAN Access URLs:`);
  console.log(`   Local:  http://localhost:${PORT}/api/`);
  console.log(`   LAN:    http://192.168.1.3:${PORT}/api/`);
  console.log(`📱 Health Check: http://192.168.1.3:${PORT}/api/health`);
  console.log(`📁 File uploads: ${uploadsDir}`);
  console.log(`🔄 Real-time sync: Socket.io enabled for multi-device access`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed');
    }
  });
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
