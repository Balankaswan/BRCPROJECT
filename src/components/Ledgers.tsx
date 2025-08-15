import React, { useState, useMemo } from 'react';
import { Download, Eye, Search, Users, Truck, FileText, Calendar } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { 
  Ledger, 
  Party, 
  Supplier, 
  Bill, 
  Memo, 
  BankEntry,
  PartyLedger,
  SupplierLedger 
} from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { 
  generatePartyLedgerPDF,
  generateSupplierLedgerPDF
} from '../utils/ledgerUtils';
import { generateAllPartyLedgers } from '../utils/autoLedgerManager';
import { generateAllSupplierLedgers } from '../utils/autoSupplierLedgerManager';
import jsPDF from 'jspdf';

const Ledgers: React.FC = () => {
  // State for different ledger types
  const [activeTab, setActiveTab] = useState<'party' | 'supplier' | 'general'>('party');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPartyLedger, setSelectedPartyLedger] = useState<PartyLedger | null>(null);
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState<SupplierLedger | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);

  // Data from localStorage
  const [parties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [suppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const [bills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [memos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [bankEntries] = useLocalStorage<BankEntry[]>(STORAGE_KEYS.BANK_ENTRIES, []);
  const [ledgers] = useLocalStorage<Ledger[]>(STORAGE_KEYS.LEDGERS, []);

  
  // Generate party ledgers automatically from existing data
  const partyLedgers = useMemo(() => {
    return generateAllPartyLedgers(parties, bills, bankEntries);
  }, [parties, bills, bankEntries]);

  // Generate supplier ledgers automatically from existing data
  const supplierLedgers = useMemo(() => {
    return generateAllSupplierLedgers(suppliers, memos, bankEntries);
  }, [suppliers, memos, bankEntries]);

  // Filter functions
  const filteredPartyLedgers = useMemo(() => {
    return partyLedgers.filter(ledger => {
      const matchesSearch = !searchTerm || 
        ledger.partyName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDateRange = !dateRange.start || !dateRange.end || 
        ledger.entries.some(entry => {
          const entryDate = new Date(entry.date);
          return entryDate >= new Date(dateRange.start) && entryDate <= new Date(dateRange.end);
        });
      
      return matchesSearch && matchesDateRange;
    });
  }, [partyLedgers, searchTerm, dateRange]);

  const filteredSupplierLedgers = useMemo(() => {
    return supplierLedgers.filter(ledger => {
      const matchesSearch = !searchTerm || 
        ledger.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Simplified date range check since entries array is empty for now
      const matchesDateRange = !dateRange.start || !dateRange.end || true;
      
      return matchesSearch && matchesDateRange;
    });
  }, [supplierLedgers, searchTerm, dateRange]);

  const filteredLedgers = useMemo(() => {
    return ledgers.filter(ledger => {
      const matchesSearch = !searchTerm || 
        ledger.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [ledgers, searchTerm]);

  // Summary calculations
  const partyTotalOutstanding = partyLedgers.reduce((sum, ledger) => sum + ledger.outstandingBalance, 0);
  const supplierTotalOutstanding = supplierLedgers.reduce((sum, ledger) => sum + ledger.outstandingBalance, 0);
  const generalTotalCredit = ledgers.filter(l => l.balance > 0).reduce((sum, l) => sum + l.balance, 0);
  const generalTotalDebit = ledgers.filter(l => l.balance < 0).reduce((sum, l) => sum + Math.abs(l.balance), 0);

  const generateLedgerPDF = (ledger: Ledger) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Header
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('BHAVISHYA ROAD CARRIERS', 105, 20, { align: 'center' });
    
    pdf.setFontSize(16);
    pdf.text('LEDGER ACCOUNT', 105, 35, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.text(`Account: ${ledger.name}`, 20, 55);
    pdf.text(`Balance: ${formatCurrency(ledger.balance)}`, 150, 55);
    
    // Table Header
    const startY = 75;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    const colWidths = [30, 80, 30, 30, 30];
    let currentX = 20;
    
    headers.forEach((header, index) => {
      pdf.rect(currentX, startY, colWidths[index], 8);
      pdf.text(header, currentX + 2, startY + 5);
      currentX += colWidths[index];
    });
    
    // Table Data
    pdf.setFont('helvetica', 'normal');
    let currentY = startY + 8;
    
    ledger.entries.forEach((entry) => {
      currentX = 20;
      const rowData = [
        formatDate(entry.date),
        entry.description,
        entry.debit > 0 ? formatCurrency(entry.debit) : '',
        entry.credit > 0 ? formatCurrency(entry.credit) : '',
        formatCurrency(entry.balance)
      ];
      
      rowData.forEach((data, colIndex) => {
        pdf.rect(currentX, currentY, colWidths[colIndex], 8);
        pdf.text(data, currentX + 2, currentY + 5);
        currentX += colWidths[colIndex];
      });
      currentY += 8;
      
      // Add new page if needed
      if (currentY > 270) {
        pdf.addPage();
        currentY = 20;
      }
    });
    
    pdf.save(`Ledger_${ledger.name}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ledger Management</h1>
        <div className="text-sm text-gray-500">
          {activeTab === 'party' && `Party Ledgers: ${partyLedgers.length}`}
          {activeTab === 'supplier' && `Supplier Ledgers: ${supplierLedgers.length}`}
          {activeTab === 'general' && `General Ledgers: ${ledgers.length}`}
        </div>
      </div>



      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('party')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'party'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Party Ledgers ({partyLedgers.length})
          </button>
          <button
            onClick={() => setActiveTab('supplier')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'supplier'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Truck className="h-4 w-4 inline mr-2" />
            Supplier Ledgers ({supplierLedgers.length})
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            General Ledgers ({ledgers.length})
          </button>
        </nav>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTab === 'party' && (
          <>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-blue-100">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Party Outstanding
                      </dt>
                      <dd className={`text-lg font-medium ${
                        partyTotalOutstanding >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(partyTotalOutstanding)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-green-100">
                      <div className="h-6 w-6 text-green-600 font-bold">{partyLedgers.length}</div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Party Ledgers
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {partyLedgers.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'supplier' && (
          <>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-orange-100">
                      <Truck className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Supplier Outstanding
                      </dt>
                      <dd className={`text-lg font-medium ${
                        supplierTotalOutstanding >= 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(supplierTotalOutstanding)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-red-100">
                      <div className="h-6 w-6 text-red-600 font-bold">{supplierLedgers.length}</div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Supplier Ledgers
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {supplierLedgers.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {activeTab === 'general' && (
          <>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-green-100">
                      <div className="h-6 w-6 text-green-600 font-bold">₹</div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Credit Balance
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(generalTotalCredit)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-red-100">
                      <div className="h-6 w-6 text-red-600 font-bold">₹</div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Debit Balance
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(generalTotalDebit)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 rounded-md bg-blue-100">
                      <div className="h-6 w-6 text-blue-600 font-bold">{ledgers.length}</div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total General Ledgers
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {ledgers.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={`Search ${activeTab} ledgers...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        {/* Date Range Filter */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Start Date"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="End Date"
          />
          {(dateRange.start || dateRange.end) && (
            <button
              onClick={() => setDateRange({ start: '', end: '' })}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Party Ledger Details Modal */}
      {selectedPartyLedger && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Party Ledger: {selectedPartyLedger.partyName}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => generatePartyLedgerPDF(selectedPartyLedger)}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedPartyLedger(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Party Ledger Summary */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Party Name:</span>
                  <span className="ml-2 font-medium">{selectedPartyLedger.partyName}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Entries:</span>
                  <span className="ml-2 font-medium">{selectedPartyLedger.entries.length}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Outstanding Balance:</span>
                  <span className={`ml-2 font-medium ${
                    selectedPartyLedger.outstandingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(selectedPartyLedger.outstandingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Party Entries Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill No</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Details</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Amount (₹)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received (₹)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions (₹)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Received (₹)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (₹)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPartyLedger.entries
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-blue-600 font-medium">
                        {entry.billNo || '-'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-900 max-w-xs">
                        {entry.tripDetails || entry.particulars || '-'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 font-medium">
                        {formatCurrency(entry.billAmount || entry.creditAmount || 0)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-green-600 font-medium">
                        {formatCurrency(entry.paymentAmount || entry.debitAmount || 0)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-red-600">
                        {formatCurrency(entry.deductionAmount || 0)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-blue-600 font-medium">
                        {formatCurrency((entry.paymentAmount || entry.debitAmount || 0) - (entry.deductionAmount || 0))}
                      </td>
                      <td className={`px-3 py-2 whitespace-nowrap text-xs font-bold ${
                        entry.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(entry.runningBalance || 0)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === 'fully_paid' ? 'bg-green-100 text-green-800' :
                          entry.status === 'partially_paid' ? 'bg-orange-100 text-orange-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status === 'fully_paid' ? 'Fully Paid' :
                           entry.status === 'partially_paid' ? 'Partial' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Ledger Details Modal */}
      {selectedSupplierLedger && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Supplier Ledger: {selectedSupplierLedger.supplierName}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => generateSupplierLedgerPDF(selectedSupplierLedger)}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedSupplierLedger(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Supplier Ledger Summary */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Supplier Name:</span>
                  <span className="ml-2 font-medium">{selectedSupplierLedger.supplierName}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Entries:</span>
                  <span className="ml-2 font-medium">{selectedSupplierLedger.entries.length}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Outstanding Balance:</span>
                  <span className={`ml-2 font-medium ${
                    selectedSupplierLedger.outstandingBalance >= 0 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {formatCurrency(selectedSupplierLedger.outstandingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Supplier Entries Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo No</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip Details</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detention (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Extra Wt (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advance (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (₹)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedSupplierLedger.entries
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600 font-medium">
                        {entry.memoNo || '-'}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-900 max-w-xs">
                        {entry.tripDetails || '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-yellow-600">
                        {entry.detentionCharges > 0 ? formatCurrency(entry.detentionCharges) : '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-red-600">
                        {entry.extraWeightCharges > 0 ? formatCurrency(entry.extraWeightCharges) : '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-green-600 font-medium">
                        {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-blue-600">
                        {entry.debitPayment > 0 ? formatCurrency(entry.debitPayment) : '-'}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-purple-600">
                        {entry.debitAdvance > 0 ? formatCurrency(entry.debitAdvance) : '-'}
                      </td>
                      <td className={`px-2 py-2 whitespace-nowrap text-xs font-bold ${
                        entry.runningBalance >= 0 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(entry.runningBalance)}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500 max-w-xs">
                        {entry.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* General Ledger Details Modal */}
      {selectedLedger && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Ledger: {selectedLedger.name}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => generateLedgerPDF(selectedLedger)}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedLedger(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Ledger Summary */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Ledger Type:</span>
                  <span className="ml-2 font-medium capitalize">{selectedLedger.type}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Entries:</span>
                  <span className="ml-2 font-medium">{selectedLedger.entries.length}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Current Balance:</span>
                  <span className={`ml-2 font-medium ${
                    selectedLedger.balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(selectedLedger.balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Entries Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedLedger.entries
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        entry.balance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ledgers List - Party Tab */}
      {activeTab === 'party' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-500">
              <div>Party Name</div>
              <div>Total Bills</div>
              <div>Entries</div>
              <div>Outstanding Balance</div>
              <div>Actions</div>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredPartyLedgers.map((ledger) => (
              <li key={ledger.id}>
                <div className="px-4 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ledger.partyName}</p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(ledger.createdAt)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-900">
                      {bills.filter(bill => bill.partyId === ledger.partyId).length}
                    </div>
                    <div className="text-sm text-gray-900">
                      {ledger.entries.length}
                    </div>
                    <div className={`text-sm font-medium ${
                      ledger.outstandingBalance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(ledger.outstandingBalance)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedPartyLedger(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => generatePartyLedgerPDF(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {filteredPartyLedgers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                {searchTerm ? 'No party ledgers found matching your search.' : 'No party ledgers available. Ledgers are created automatically when bills are created.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ledgers List - Supplier Tab */}
      {activeTab === 'supplier' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-500">
              <div>Supplier Name</div>
              <div>Total Memos</div>
              <div>Entries</div>
              <div>Outstanding Balance</div>
              <div>Actions</div>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredSupplierLedgers.map((ledger) => (
              <li key={ledger.id}>
                <div className="px-4 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ledger.supplierName}</p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(ledger.createdAt)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-900">
                      {memos.filter(memo => memo.supplierId === ledger.supplierId).length}
                    </div>
                    <div className="text-sm text-gray-900">
                      {ledger.entries.length}
                    </div>
                    <div className={`text-sm font-medium ${
                      ledger.outstandingBalance >= 0 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(ledger.outstandingBalance)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedSupplierLedger(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => generateSupplierLedgerPDF(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {filteredSupplierLedgers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                {searchTerm ? 'No supplier ledgers found matching your search.' : 'No supplier ledgers available. Ledgers are created automatically when memos are created.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Ledgers List - General Tab */}
      {activeTab === 'general' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-500">
              <div>Ledger Name</div>
              <div>Type</div>
              <div>Entries</div>
              <div>Balance</div>
              <div>Actions</div>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredLedgers.map((ledger) => (
              <li key={ledger.id}>
                <div className="px-4 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-5 gap-4 items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ledger.name}</p>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(ledger.createdAt)}
                      </p>
                    </div>
                    <div className="text-sm text-gray-900 capitalize">
                      {ledger.type}
                    </div>
                    <div className="text-sm text-gray-900">
                      {ledger.entries.length}
                    </div>
                    <div className={`text-sm font-medium ${
                      ledger.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(ledger.balance)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedLedger(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => generateLedgerPDF(ledger)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {filteredLedgers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">
                {searchTerm ? 'No general ledgers found matching your search.' : 'No general ledgers created yet. These are created from expense entries in Banking.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Ledgers;