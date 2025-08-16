try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using environment variables directly');
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import MongoDB models
const {
  LoadingSlip,
  Memo,
  Bill,
  BankEntry,
  Party,
  Supplier,
  Counter
} = require('./models/schemas');

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

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://balankaswan14:<db_password>@brcmanagement.xyhobwb.mongodb.net/?retryWrites=true&w=majority&appName=BRCMANAGEMENT';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  initializeCounters();
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// Initialize MongoDB counters
async function initializeCounters() {
  try {
    const counters = [
      { _id: 'loadingSlip', value: 1001 },
      { _id: 'memo', value: 6030 },
      { _id: 'bill', value: 5900 }
    ];

    for (const counter of counters) {
      await Counter.findOneAndUpdate(
        { _id: counter._id },
        { value: counter.value },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Counters initialized');
  } catch (error) {
    console.error('❌ Error initializing counters:', error.message);
  }
}

// MongoDB CRUD operations
const modelMap = {
  'loading_slips': LoadingSlip,
  'memos': Memo,
  'bills': Bill,
  'bank_entries': BankEntry,
  'parties': Party,
  'suppliers': Supplier
};

function createMongoRoutes(routeName, Model) {
  // GET all records
  app.get(`/api/${routeName}`, async (req, res) => {
    try {
      const records = await Model.find().sort({ createdAt: -1 });
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET single record
  app.get(`/api/${routeName}/:id`, async (req, res) => {
    try {
      const record = await Model.findById(req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Record not found' });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST new record
  app.post(`/api/${routeName}`, async (req, res) => {
    try {
      const record = new Model(req.body);
      const savedRecord = await record.save();
      
      // Broadcast the new record to all connected clients
      io.emit(`${routeName}_created`, savedRecord);
      res.json(savedRecord);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT update record
  app.put(`/api/${routeName}/:id`, async (req, res) => {
    try {
      const updatedRecord = await Model.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!updatedRecord) {
        return res.status(404).json({ error: 'Record not found' });
      }
      
      // Broadcast the updated record to all connected clients
      io.emit(`${routeName}_updated`, updatedRecord);
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE record
  app.delete(`/api/${routeName}/:id`, async (req, res) => {
    try {
      const deletedRecord = await Model.findByIdAndDelete(req.params.id);
      
      if (!deletedRecord) {
        return res.status(404).json({ error: 'Record not found' });
      }
      
      // Broadcast the deletion to all connected clients
      io.emit(`${routeName}_deleted`, { id: req.params.id });
      res.json({ message: 'Record deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Create MongoDB routes for all collections
Object.keys(modelMap).forEach(routeName => {
  createMongoRoutes(routeName, modelMap[routeName]);
});

// Counter management with MongoDB
app.get('/api/counters', async (req, res) => {
  try {
    const counterDocs = await Counter.find();
    const counters = {};
    counterDocs.forEach(doc => {
      counters[doc._id] = doc.value;
    });
    res.json(counters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/counters/:id', async (req, res) => {
  try {
    const { value } = req.body;
    const updatedCounter = await Counter.findOneAndUpdate(
      { _id: req.params.id },
      { value },
      { new: true, upsert: true }
    );
    
    io.emit('counter_updated', { id: req.params.id, value });
    res.json({ id: req.params.id, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  socket.on('sync_request', async (tableName) => {
    try {
      const Model = modelMap[tableName];
      if (Model) {
        const data = await Model.find().sort({ createdAt: -1 });
        socket.emit('sync_response', { tableName, data });
      }
    } catch (error) {
      console.error('Sync error:', error.message);
    }
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
  console.log(`📊 Database: MongoDB Atlas (BRCMANAGEMENT)`);
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
  mongoose.connection.close()
    .then(() => {
      console.log('✅ MongoDB connection closed');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error('Error closing MongoDB connection:', err.message);
      process.exit(1);
    });
});
