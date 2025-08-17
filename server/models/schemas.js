const mongoose = require('mongoose');

// Loading Slip Schema
const loadingSlipSchema = new mongoose.Schema({
  slipNumber: { type: String, unique: true, required: true },
  loadingDate: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  from_location: { type: String, required: true },
  to_location: { type: String, required: true },
  partyName: { type: String, required: true },
  partyPersonName: { type: String },
  supplierDetail: { type: String, required: true },
  materialType: { type: String, required: true },
  weight: { type: Number, required: true },
  freight: { type: Number, required: true },
  advance: { type: Number, default: 0 },
  linkedMemoNo: { type: String, ref: 'Memo' }, // Reference to memo
  linkedBillNo: { type: String, ref: 'Bill' }, // Reference to bill
  linkedMemoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memo' }, // Direct ID reference
  linkedBillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' }   // Direct ID reference
}, {
  timestamps: true
});

// Memo Schema
const memoSchema = new mongoose.Schema({
  memoNumber: { type: String, unique: true, required: true },
  loadingDate: { type: String, required: true },
  from_location: { type: String, required: true },
  to_location: { type: String, required: true },
  supplierName: { type: String, required: true },
  partyName: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  weight: { type: Number, required: true },
  materialType: { type: String, required: true },
  freight: { type: Number, required: true },
  mamul: { type: Number, default: 0 },
  detention: { type: Number, default: 0 },
  extraCharge: { type: Number, default: 0 },
  commissionPercentage: { type: Number, default: 6 },
  commission: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  paidDate: { type: String },
  paidAmount: { type: Number, default: 0 },
  linkedLoadingSlipId: { type: String, ref: 'LoadingSlip' }, // Reference to loading slip
  linkedLoadingSlipNumber: { type: String, ref: 'LoadingSlip' }, // Reference by slip number
  advances: [{ 
    date: String, 
    amount: Number, 
    narration: String 
  }],
  notes: { type: String }
}, {
  timestamps: true
});

// Bill Schema
const billSchema = new mongoose.Schema({
  billNumber: { type: String, unique: true, required: true },
  billDate: { type: String, required: true },
  partyName: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  receivedAmount: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, default: 'pending' },
  receivedDate: { type: String },
  linkedLoadingSlipId: { type: String, ref: 'LoadingSlip' }, // Reference to loading slip
  linkedLoadingSlipNumber: { type: String, ref: 'LoadingSlip' }, // Reference by slip number
  trips: [{
    cnNo: String,
    loadingDate: String,
    from: String,
    to: String,
    vehicleNumber: String,
    weight: Number,
    freight: Number,
    rtoChallan: Number,
    detention: Number,
    extraWeight: Number,
    advance: Number,
    balance: Number
  }],
  advances: [{ 
    date: String, 
    amount: Number, 
    narration: String 
  }],
  podFile: { type: String },
  notes: { type: String }
}, {
  timestamps: true
});

// Bank Entry Schema
const bankEntrySchema = new mongoose.Schema({
  date: { type: String, required: true },
  particulars: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  relatedId: { type: String },
  relatedType: { type: String, enum: ['bill', 'memo'] }
}, {
  timestamps: true
});

// Party Schema
const partySchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  contact: { type: String },
  address: { type: String },
  balance: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Supplier Schema
const supplierSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  contact: { type: String },
  address: { type: String },
  balance: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Counter Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true }
}, {
  _id: false
});

// Create Models
const LoadingSlip = mongoose.model('LoadingSlip', loadingSlipSchema);
const Memo = mongoose.model('Memo', memoSchema);
const Bill = mongoose.model('Bill', billSchema);
const BankEntry = mongoose.model('BankEntry', bankEntrySchema);
const Party = mongoose.model('Party', partySchema);
const Supplier = mongoose.model('Supplier', supplierSchema);
const Counter = mongoose.model('Counter', counterSchema);

module.exports = {
  LoadingSlip,
  Memo,
  Bill,
  BankEntry,
  Party,
  Supplier,
  Counter
};
