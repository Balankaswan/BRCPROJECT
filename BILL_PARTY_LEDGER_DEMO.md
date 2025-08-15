# Bill ↔ Party Ledger Automatic Linking Demo

## How Bills are Automatically Linked to Party Ledgers

### 🔄 **When a Bill is Created**

**Example Bill Creation:**
```json
{
  "id": "bill_12345",
  "billNo": "BRC-5909",
  "billDate": "2024-08-12",
  "partyId": "party_001",
  "partyName": "ABC Transport Ltd",
  "trips": [
    {
      "from": "Mumbai",
      "to": "Delhi", 
      "vehicle": "MH-01-2345",
      "freight": 50000
    }
  ],
  "totalFreight": 50000,
  "mamul": 2000,
  "detention": 5000,
  "extraCharges": 1000,
  "balance": 54000
}
```

**↓ AUTOMATICALLY CREATES Party Ledger Entry:**
```json
{
  "id": "bill_12345_bill_entry",
  "type": "bill_created",
  "date": "2024-08-12",
  "billNo": "BRC-5909",
  "billDate": "2024-08-12",
  "tripDetails": "Mumbai to Delhi (MH-01-2345)",
  "billAmount": 54000,
  "pendingAmount": 54000,
  "runningBalance": 54000,
  "status": "pending",
  "remarks": "Bill created for 1 trip(s)",
  "relatedBillId": "bill_12345"
}
```

### 💰 **When Payment is Processed**

**Payment Input:**
```json
{
  "paymentAmount": 50000,
  "paymentDate": "2024-08-15",
  "paymentMode": "bank_transfer",
  "tdsDeduction": 2000,
  "mamoolDeduction": 1000,
  "paymentCharges": 500,
  "commissionDeduction": 500,
  "otherDeduction": 0
}
```

**↓ AUTOMATICALLY CREATES Payment Ledger Entry:**
```json
{
  "id": "bill_12345_payment_1723692000000",
  "type": "payment_received",
  "date": "2024-08-15",
  "billNo": "BRC-5909",
  "billDate": "2024-08-12",
  "tripDetails": "Mumbai to Delhi (MH-01-2345)",
  "billAmount": 54000,
  "pendingAmount": 8000,
  "paymentAmount": 50000,
  "paymentMode": "bank_transfer",
  "tdsDeduction": 2000,
  "mamoolDeduction": 1000,
  "paymentCharges": 500,
  "commissionDeduction": 500,
  "otherDeduction": 0,
  "totalDeductions": 4000,
  "netPayment": 46000,
  "runningBalance": 8000,
  "status": "partially_paid",
  "relatedBillId": "bill_12345"
}
```

### 📊 **Complete Party Ledger**

```json
{
  "id": "ledger_party_001",
  "partyId": "party_001", 
  "partyName": "ABC Transport Ltd",
  "entries": [
    {
      "id": "bill_12345_bill_entry",
      "type": "bill_created",
      "billAmount": 54000,
      "pendingAmount": 54000,
      "status": "pending"
    },
    {
      "id": "bill_12345_payment_1723692000000", 
      "type": "payment_received",
      "paymentAmount": 50000,
      "totalDeductions": 4000,
      "netPayment": 46000,
      "pendingAmount": 8000,
      "status": "partially_paid"
    }
  ],
  "outstandingBalance": 8000,
  "totalBillAmount": 54000,
  "totalPaid": 46000,
  "totalDeductions": 4000,
  "paidBills": 0,
  "pendingBills": 0,
  "partiallyPaidBills": 1
}
```

## 🎯 **Key Features Demonstrated**

### ✅ **Bill Creation → Automatic Ledger Entry**
- **Bill Details Captured**: Bill No, Date, Amount, Trip Details
- **Pending Amount Set**: Equal to bill amount initially
- **Status**: Set to 'pending'
- **Link Established**: `relatedBillId` connects to original bill

### ✅ **Payment Processing → Detailed Tracking**
- **All Deductions Captured**: TDS, Mamool, Charges, Commission, Other
- **Net Payment Calculated**: Payment Amount - Total Deductions
- **Running Balance Updated**: Previous Pending - Net Payment
- **Status Auto-Updated**: pending → partially_paid → fully_paid

### ✅ **Bill Edit → Ledger Sync**
- **Amount Changes Reflected**: Bill edits update ledger entry
- **Balance Recalculated**: Outstanding balance adjusted
- **Trip Details Updated**: Changes in routes/vehicles reflected

### ✅ **Complete Financial Picture**
- **Outstanding Balance**: Real-time calculation
- **Total Deductions**: Sum of all deduction types
- **Payment History**: Complete chronological record
- **Bill Status Counts**: Paid, Pending, Partially Paid

## 🔗 **Linking Details Captured**

### **Bill Information**
- ✓ Bill Number & Date
- ✓ Party Details
- ✓ Trip Information (Routes, Vehicles)
- ✓ Amount Breakdown (Freight, Detention, Mamul, Charges)

### **Payment Information** 
- ✓ Payment Date & Mode
- ✓ Received Amount
- ✓ Detailed Deduction Breakdown
- ✓ Net Payment Calculation
- ✓ Payment Reference & Remarks

### **Status Tracking**
- ✓ Bill Status (Pending → Partially Paid → Fully Paid)
- ✓ Running Balance Updates
- ✓ Payment History Timeline
- ✓ Outstanding Amount Tracking

## 🚀 **System Benefits**

1. **100% Automatic**: No manual ledger entry required
2. **Complete Traceability**: Every bill linked to full payment history
3. **Real-time Balances**: Outstanding amounts always current
4. **Detailed Breakdown**: All deductions and charges captured
5. **Edit Synchronization**: Bill changes reflect in ledger
6. **Comprehensive Reporting**: Filter by status, dates, amounts

## 💡 **Usage Flow**

1. **Create Bill** → System automatically creates party ledger entry
2. **Process Payment** → System adds payment entry with deductions
3. **Edit Bill** → System updates corresponding ledger entry  
4. **View Ledger** → Complete payment history with all details
5. **Generate Reports** → Filter and analyze by various criteria

This system ensures that **EVERY BILL IS AUTOMATICALLY LINKED TO PARTY LEDGER** with **COMPLETE BILL AMOUNT AND DETAIL TRACKING** as requested!
