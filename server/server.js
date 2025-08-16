try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv not available, using environment variables directly');
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
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
const io = new Server(server, {
  cors: {
    origin: [
      'https://brcmanagement.netlify.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://192.168.1.3:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3001;

// CORS configuration for production deployment
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

// MongoDB Connection - comprehensive authentication testing
const connectionAttempts = [
  {
    name: 'Standard with transport_management DB',
    uri: 'mongodb+srv://balankaswan14:Balan30@brcmanagement.xyhobwb.mongodb.net/transport_management?retryWrites=true&w=majority'
  },
  {
    name: 'With admin auth source',
    uri: 'mongodb+srv://balankaswan14:Balan30@brcmanagement.xyhobwb.mongodb.net/transport_management?retryWrites=true&w=majority&authSource=admin'
  },
  {
    name: 'Default database (no specific DB)',
    uri: 'mongodb+srv://balankaswan14:Balan30@brcmanagement.xyhobwb.mongodb.net/?retryWrites=true&w=majority'
  },
  {
    name: 'Test database',
    uri: 'mongodb+srv://balankaswan14:Balan30@brcmanagement.xyhobwb.mongodb.net/test?retryWrites=true&w=majority'
  }
];

async function connectToMongoDB() {
  console.log('🔗 Starting MongoDB Atlas connection attempts...');
  
  for (let i = 0; i < connectionAttempts.length; i++) {
    const attempt = connectionAttempts[i];
    const uri = process.env.MONGODB_URI || attempt.uri;
    
    console.log(`\n� Attempt ${i + 1}: ${attempt.name}`);
    
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      
      console.log('✅ Successfully connected to MongoDB Atlas!');
      console.log('📊 Database:', mongoose.connection.name || 'default');
      console.log('📊 Host:', mongoose.connection.host);
      console.log('📊 Connection state:', mongoose.connection.readyState);
      
      await initializeCounters();
      return true;
      
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
      if (err.code) console.error(`   Code: ${err.code}`);
      if (err.codeName) console.error(`   CodeName: ${err.codeName}`);
      
      // Ensure clean disconnect before next attempt
      try {
        await mongoose.disconnect();
      } catch (disconnectErr) {
        // Ignore disconnect errors
      }
    }
  }
  
  console.error('\n❌ All MongoDB connection attempts failed');
  console.log('⚠️  Server will start without database connection');
  console.log('\n� MongoDB Atlas Checklist:');
  console.log('   ✓ Username: balankaswan14');
  console.log('   ✓ Password: Balan30');
  console.log('   ✓ Cluster: brcmanagement.xyhobwb.mongodb.net');
  console.log('   ? Network Access: Ensure 0.0.0.0/0 is whitelisted');
  console.log('   ? User Permissions: "Database User" with "Read and write to any database"');
  console.log('   ? Cluster Status: Ensure cluster is not paused');
  
  return false;
}

// Initialize sample data for testing
async function initializeSampleData() {
  try {
    // Check if data already exists
    const existingParties = await Party.countDocuments();
    if (existingParties > 0) {
      console.log('📊 Sample data already exists, skipping initialization');
      return;
    }

    console.log('🔄 Initializing sample data...');

    // Sample parties
    const sampleParties = [
      {
        name: 'ABC Transport Co.',
        address: 'Mumbai, Maharashtra',
        phone: '9876543210',
        gst: '27ABCDE1234F1Z5',
        type: 'customer'
      },
      {
        name: 'XYZ Logistics',
        address: 'Delhi, India',
        phone: '9876543211',
        gst: '07XYZAB1234G1Z8',
        type: 'customer'
      }
    ];

    // Sample suppliers
    const sampleSuppliers = [
      {
        name: 'Fuel Station ABC',
        address: 'Highway 1, Gujarat',
        phone: '9876543212',
        gst: '24FUELX1234H1Z9',
        type: 'fuel'
      }
    ];

    // Insert sample data
    await Party.insertMany(sampleParties);
    await Supplier.insertMany(sampleSuppliers);

    console.log('✅ Sample data initialized successfully');
    console.log(`   - ${sampleParties.length} parties added`);
    console.log(`   - ${sampleSuppliers.length} suppliers added`);

  } catch (error) {
    console.error('❌ Error initializing sample data:', error.message);
  }
}

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
        { $setOnInsert: counter },
        { upsert: true, new: true }
      );
    }
    
    console.log('✅ Counters initialized');
    
    // Initialize sample data after counters
    await initializeSampleData();
    
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
    console.log(`📝 POST /${routeName} - Request body:`, req.body);
    console.log(`📝 Content-Type:`, req.headers['content-type']);
    
    try {
      const record = new Model(req.body);
      console.log(`💾 Creating new ${routeName} record:`, record);
      
      const savedRecord = await record.save();
      console.log(`✅ ${routeName} saved successfully:`, savedRecord._id);
      
      // Broadcast the new record to all connected clients with enhanced logging
      const clientCount = io.engine.clientsCount;
      console.log(`📡 Broadcasting ${routeName}_created to ${clientCount} connected clients`);
      console.log(`📊 Broadcast data:`, JSON.stringify(savedRecord, null, 2));
      
      // Emit to all clients with error handling
      try {
        io.emit(`${routeName}_created`, savedRecord);
        console.log(`✅ Broadcast successful for ${routeName}_created`);
      } catch (broadcastError) {
        console.error(`❌ Broadcast failed for ${routeName}_created:`, broadcastError);
      }

      
      
      res.json(savedRecord);
    } catch (error) {
      console.error(`❌ Error saving ${routeName}:`, error.message);
      console.error(`🔍 Validation errors:`, error.errors);
      res.status(500).json({ error: error.message, details: error.errors });
    }
  });

  // PUT update record
  app.put(`/api/${routeName}/:id`, async (req, res) => {
    console.log(`📝 PUT /${routeName}/${req.params.id} - Request body:`, req.body);
    
    try {
      const updatedRecord = await Model.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!updatedRecord) {
        return res.status(404).json({ error: 'Record not found' });
      }
      
      console.log(`✅ ${routeName} updated successfully:`, updatedRecord._id);
      
      // Broadcast the updated record to all connected clients with enhanced logging
      const clientCount = io.engine.clientsCount;
      console.log(`📡 Broadcasting ${routeName}_updated to ${clientCount} connected clients`);
      console.log(`📊 Broadcast data:`, JSON.stringify(updatedRecord, null, 2));
      
      // Emit to all clients with error handling
      try {
        io.emit(`${routeName}_updated`, updatedRecord);
        console.log(`✅ Broadcast successful for ${routeName}_updated`);
      } catch (broadcastError) {
        console.error(`❌ Broadcast failed for ${routeName}_updated:`, broadcastError);
      }
      
      res.json(updatedRecord);
    } catch (error) {
      console.error(`❌ Error updating ${routeName}:`, error.message);
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

// Test endpoint to verify API functionality
app.post('/api/test-party', async (req, res) => {
  console.log('🧪 Test endpoint called - creating test party');
  try {
    const testParty = new Party({
      name: 'Test Party ' + Date.now(),
      address: 'Test Address',
      phone: '1234567890',
      gst: 'TEST123456789',
      type: 'customer'
    });
    
    const saved = await testParty.save();
    console.log('✅ Test party created:', saved._id);
    
    // Also return count of all parties
    const count = await Party.countDocuments();
    
    res.json({
      success: true,
      testParty: saved,
      totalParties: count,
      message: 'Test party created successfully'
    });
  } catch (error) {
    console.error('❌ Test endpoint failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors
    });
  }
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Transport Management API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      parties: '/api/parties',
      suppliers: '/api/suppliers',
      loading_slips: '/api/loading_slips',
      memos: '/api/memos',
      bills: '/api/bills',
      bank_entries: '/api/bank_entries',
      upload: '/api/upload',
      test: '/api/test-party'
    },
    status: 'API is running'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    collections: {
      parties: 'Party',
      suppliers: 'Supplier',
      loadingSlips: 'LoadingSlip',
      memos: 'Memo',
      bills: 'Bill',
      bankEntries: 'BankEntry'
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  console.log('📊 Total clients:', io.engine.clientsCount);
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    console.log('📊 Total clients:', io.engine.clientsCount);
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

// Start MongoDB connection
connectToMongoDB().then((connected) => {
  if (!connected) {
    console.log('🚀 Server starting without database...');
  }
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

// Catch-all route for unknown API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Unknown API endpoint' });
});
