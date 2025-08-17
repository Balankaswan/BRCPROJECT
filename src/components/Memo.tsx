import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, DollarSign, CheckCircle, Search, Eye } from 'lucide-react';
import PDFPreviewModal, { usePDFPreviewModal } from './PDFPreviewModal';
import { Memo as MemoType, Supplier, Advance } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { formatCurrency, formatDate, calculateCommission, calculateMemoBalance } from '../utils/calculations';
import { generateMemoPDF } from '../utils/pdfGenerator';
import { useCounters } from '../hooks/useCounters';
import { validateMemoForm } from '../utils/validation';
import { initializeLocationSuggestionsFromExistingData } from '../utils/locationSuggestions';
import DateInput from './DateInput';
import AutoCompleteLocationInput from './AutoCompleteLocationInput';
import DragDropInput from './DragDropInput';
import { apiService, useRealTimeSync } from '../services/apiService';

const Memo: React.FC = () => {
  const [memos, setMemos] = useState<MemoType[]>([]);

  // Load data from API and set up real-time sync
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiService.getMemos();
        setMemos(data);
      } catch (error) {
        console.error('Error loading memos:', error);
      }
    };
    loadData();
  }, []);

  // Set up real-time sync with cleanup to avoid duplicate listeners
  useEffect(() => {
    const unsubscribe = useRealTimeSync('memos', setMemos);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [setMemos]);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const [paidMemos, setPaidMemos] = useLocalStorage<MemoType[]>(STORAGE_KEYS.PAID_MEMOS, []);
  const { getNextNumber, getNextNumberPreview, updateCounterIfHigher } = useCounters();
  const [showForm, setShowForm] = useState(false);
  const [editingMemo, setEditingMemo] = useState<MemoType | null>(null);
  const [viewingMemo, setViewingMemo] = useState<MemoType | null>(null);
  const [showAdvanceForm, setShowAdvanceForm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMemo, setPreviewMemo] = useState<MemoType | null>(null);
  const { isOpen: isPreviewOpen, openModal: openPreview, closeModal: closePreview } = usePDFPreviewModal();

  // Initialize location suggestions from existing data on component mount
  useEffect(() => {
    initializeLocationSuggestionsFromExistingData();
  }, []);

  const [formData, setFormData] = useState({
    memoNo: getNextNumberPreview('memo'),
    loadingDate: new Date().toISOString().split('T')[0],
    from: '',
    to: '',
    supplierId: '',
    supplierName: '',
    partyName: '',
    material: '',
    weight: '',
    vehicle: '',
    freight: '',
    mamul: '',
    detention: '0',
    rtoAmount: '0',
    extraCharge: '0',
    commissionPercentage: '6',
    notes: ''
  });

  const [advanceData, setAdvanceData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    narration: ''
  });

  // Filter memos based on search term (including vehicle number)
  const filteredMemos = useMemo(() => {
    if (!searchTerm.trim()) return memos;
    
    return memos.filter(memo => 
      memo.memoNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (memo.partyName && memo.partyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (memo.material && memo.material.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [memos, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form including unique memo number
    const validation = validateMemoForm(formData, editingMemo?.id);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    const freight = parseFloat(formData.freight);
    const commissionPercentage = parseFloat(formData.commissionPercentage) || 6;
    const commission = calculateCommission(freight, commissionPercentage);
    const mamul = parseFloat(formData.mamul) || 0;
    const detention = parseFloat(formData.detention) || 0;

    // Handle memo number - use manual entry or auto-generate
    const memoNo = formData.memoNo || editingMemo?.memoNo || getNextNumber('memo');
    
    // If manual memo number was entered, update counter for next auto-increment
    if (formData.memoNo && !editingMemo) {
      updateCounterIfHigher('memo', formData.memoNo);
    }

    const rtoAmount = parseFloat(formData.rtoAmount) || 0;
    const extraCharge = parseFloat(formData.extraCharge) || 0;

    const memo = {
      id: editingMemo?.id || Date.now().toString(),
      memoNumber: memoNo,
      loadingDate: formData.loadingDate,
      from_location: formData.from,
      to_location: formData.to,
      supplierName: formData.supplierName,
      partyName: formData.partyName,
      vehicleNumber: formData.vehicle,
      weight: parseFloat(formData.weight) || 0,
      materialType: formData.material,
      freight,
      mamul,
      detention,
      extraCharge: rtoAmount + extraCharge,
      commissionPercentage,
      commission,
      balance: calculateMemoBalance(freight, editingMemo?.advances || [], commission, mamul, detention, rtoAmount, extraCharge),
      status: 'pending',
      paidDate: null,
      paidAmount: 0,
      advances: JSON.stringify(editingMemo?.advances || []),
      notes: formData.notes,
      createdAt: editingMemo?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      console.log('🚀 Saving memo to backend API for real-time sync...', memo);
      
      if (editingMemo) {
        // Update existing memo via backend API
        await apiService.update('memos', editingMemo.id, memo);
        console.log('✅ Memo updated successfully via backend API');
      } else {
        // Create new memo via backend API
        await apiService.create('memos', memo);
        console.log('✅ Memo created successfully via backend API');
      }
      
      // The Socket.io listeners will automatically update the UI
      resetForm();
      setShowForm(false);
      
    } catch (error) {
      console.error('❌ Failed to save memo to backend:', error);
      alert('Failed to save memo. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      memoNo: getNextNumberPreview('memo'),
      loadingDate: new Date().toISOString().split('T')[0],
      from: '',
      to: '',
      supplierId: '',
      supplierName: '',
      partyName: '',
      material: '',
      weight: '',
      vehicle: '',
      freight: '',
      mamul: '',
      detention: '0',
      rtoAmount: '0',
      extraCharge: '0',
      commissionPercentage: '6',
      notes: ''
    });
    setShowForm(false);
    setEditingMemo(null);
  };

  const handleView = (memo: MemoType) => {
    setViewingMemo(memo);
  };

  const handlePreviewPDF = (memo: MemoType) => {
    setPreviewMemo(memo);
    openPreview();
  };

  const handleEdit = (memo: MemoType) => {
    setEditingMemo(memo);
    setFormData({
      memoNo: memo.memoNo,
      loadingDate: memo.loadingDate,
      from: memo.from,
      to: memo.to,
      supplierId: memo.supplierId,
      supplierName: memo.supplierName,
      partyName: memo.partyName || '',
      material: memo.material || '',
      weight: memo.weight?.toString() || '',
      vehicle: memo.vehicle,
      freight: memo.freight.toString(),
      mamul: memo.mamul.toString(),
      detention: memo.detention.toString(),
      rtoAmount: (memo.rtoAmount || 0).toString(),
      extraCharge: (memo.extraCharge || 0).toString(),
      commissionPercentage: memo.commission ? ((memo.commission / memo.freight) * 100).toFixed(1) : '6',
      notes: memo.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this memo?')) {
      try {
        const memo = memos.find(m => m.id === id);
        if (memo) {
          // Delete from backend first
          try {
            await apiService.deleteMemo(id);
            console.log('✅ Memo deleted from backend');
          } catch (error) {
            console.warn('⚠️ Failed to delete memo from backend:', error);
          }
          
          // Update local state
          setMemos(prev => prev.filter(m => m.id !== id));
          
          // Update supplier balance
          setSuppliers(prev => prev.map(supplier => 
            supplier.id === memo.supplierId 
              ? { ...supplier, balance: supplier.balance - memo.balance, activeTrips: supplier.activeTrips - 1 }
              : supplier
          ));
          
          // Update localStorage
          const updatedMemos = memos.filter(m => m.id !== id);
          localStorage.setItem(STORAGE_KEYS.MEMOS, JSON.stringify(updatedMemos));
          
          alert('Memo deleted successfully!');
        }
      } catch (error) {
        console.error('❌ Failed to delete memo:', error);
        alert('Failed to delete memo. Please try again.');
      }
    }
  };

  const handleAddAdvance = (memoId: string) => {
    const amount = parseFloat(advanceData.amount);
    const advance: Advance = {
      id: Date.now().toString(),
      amount,
      date: advanceData.date,
      narration: advanceData.narration
    };

    setMemos(prev => prev.map(memo => {
      if (memo.id === memoId) {
        const newAdvances = [...memo.advances, advance];
        const newBalance = calculateMemoBalance(memo.freight, newAdvances, memo.commission, memo.mamul, memo.detention, memo.rtoAmount, memo.extraCharge);
        
        // Update supplier balance
        setSuppliers(prevSuppliers => prevSuppliers.map(supplier => 
          supplier.id === memo.supplierId 
            ? { ...supplier, balance: supplier.balance - amount }
            : supplier
        ));

        return { ...memo, advances: newAdvances, balance: newBalance };
      }
      return memo;
    }));

    setAdvanceData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      narration: ''
    });
    setShowAdvanceForm(null);
  };

  const handleMarkAsPaid = (memo: MemoType) => {
    const paidDate = prompt('Enter paid date (YYYY-MM-DD):');
    if (paidDate) {
      const paidMemo = { ...memo, status: 'paid' as const, paidDate };
      setPaidMemos(prev => [...prev, paidMemo]);
      setMemos(prev => prev.filter(m => m.id !== memo.id));
      
      // Update supplier balance
      setSuppliers(prev => prev.map(supplier => 
        supplier.id === memo.supplierId 
          ? { ...supplier, balance: supplier.balance - memo.balance, activeTrips: supplier.activeTrips - 1 }
          : supplier
      ));
    }
  };

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setFormData(prev => ({ ...prev, supplierId, supplierName: supplier.name }));
    }
  };

  const handleAddNewSupplier = () => {
    const name = prompt('Enter supplier name:');
    const mobile = prompt('Enter mobile number (optional):') || '';
    const address = prompt('Enter address (optional):') || '';
    
    if (name) {
      const newSupplier: Supplier = {
        id: Date.now().toString(),
        name,
        mobile,
        address,
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      
      setSuppliers(prev => [...prev, newSupplier]);
      setFormData(prev => ({ ...prev, supplierId: newSupplier.id, supplierName: newSupplier.name }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Broker Memos</h1>
                <p className="text-sm text-gray-600 mt-1">Manage supplier transportation memos and advance payments</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Memos</p>
                <p className="text-2xl font-bold text-blue-600">{memos.length}</p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150"
              >
                <Plus className="-ml-1 mr-2 h-4 w-4" />
                Create New Memo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by memo number, supplier name, or route..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">
                {filteredMemos.length} of {memos.length} memos
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingMemo ? 'Edit Memo' : 'Create Memo'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Memo Number</label>
                  <input
                    type="text"
                    value={formData.memoNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, memoNo: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto: 6021 (or enter custom)"
                  />
                </div>

                <DateInput
                  label="Loading Date"
                  value={formData.loadingDate}
                  onChange={(value) => setFormData(prev => ({ ...prev, loadingDate: value }))}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Vehicle Number</label>
                  <input
                    type="text"
                    value={formData.vehicle}
                    onChange={(e) => setFormData(prev => ({ ...prev, vehicle: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <AutoCompleteLocationInput
                  label="From (Loading Point)"
                  value={formData.from}
                  onChange={(value) => setFormData(prev => ({ ...prev, from: value }))}
                  placeholder="Enter loading point"
                  required
                />

                <AutoCompleteLocationInput
                  label="To (Unloading Point)"
                  value={formData.to}
                  onChange={(value) => setFormData(prev => ({ ...prev, to: value }))}
                  placeholder="Enter unloading point"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier</label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.supplierId}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddNewSupplier}
                      className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Add New
                    </button>
                  </div>
                </div>

                <DragDropInput
                  label="Party Name"
                  value={formData.partyName}
                  onChange={(value) => setFormData(prev => ({ ...prev, partyName: value }))}
                  placeholder="Enter or drag party name"
                  type="party"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Material</label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter material type"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter weight in MT"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Freight Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.freight}
                    onChange={(e) => setFormData(prev => ({ ...prev, freight: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Mamul</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mamul}
                    onChange={(e) => setFormData(prev => ({ ...prev, mamul: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Commission (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.commissionPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, commissionPercentage: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Default: 6%"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Commission will be calculated as {formData.commissionPercentage || '6'}% of freight amount
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Detention</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.detention}
                    onChange={(e) => setFormData(prev => ({ ...prev, detention: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">RTO Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rtoAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, rtoAmount: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter RTO amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Extra Charge</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.extraCharge}
                    onChange={(e) => setFormData(prev => ({ ...prev, extraCharge: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter extra charge"
                  />
                </div>
              </div>

              {/* Notes Section */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter any additional notes or remarks for this memo..."
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingMemo ? 'Update' : 'Create'} Memo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Form Modal */}
      {showAdvanceForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Advance</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={advanceData.amount}
                  onChange={(e) => setAdvanceData(prev => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={advanceData.date}
                  onChange={(e) => setAdvanceData(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Narration</label>
                <input
                  type="text"
                  value={advanceData.narration}
                  onChange={(e) => setAdvanceData(prev => ({ ...prev, narration: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAdvanceForm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddAdvance(showAdvanceForm)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Advance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professional Memos Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800">
          <h3 className="text-lg font-semibold text-white">Broker Memos</h3>
          <p className="text-blue-100 text-sm mt-1">Manage supplier transportation memos</p>
        </div>
        
        {filteredMemos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memo Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route & Vehicle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Financial Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMemos
                  .sort((a, b) => new Date(b.loadingDate).getTime() - new Date(a.loadingDate).getTime())
                  .map((memo, index) => (
                  <tr key={memo.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-semibold text-blue-600">#{memo.memoNo}</div>
                        <div className="text-sm text-gray-600">{formatDate(memo.loadingDate)}</div>
                        {memo.material && (
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {memo.material}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{memo.from} → {memo.to}</div>
                        <div className="text-sm text-gray-600">{memo.vehicle}</div>
                        {memo.weight && (
                          <div className="text-xs text-gray-500 mt-1">{memo.weight} MT</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{memo.supplierName}</div>
                        {memo.partyName && (
                          <div className="text-sm text-gray-600">Party: {memo.partyName}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600">Freight:</span>
                          <span className="font-semibold text-gray-900 ml-2">{formatCurrency(memo.freight)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Commission:</span>
                          <span className="font-medium text-blue-600 ml-2">{formatCurrency(memo.commission)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Balance:</span>
                          <span className={`font-semibold ml-2 ${
                            memo.balance >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>{formatCurrency(memo.balance)}</span>
                        </div>
                        {memo.mamul > 0 && (
                          <div className="text-xs text-gray-500">
                            Mamul: {formatCurrency(memo.mamul)}
                          </div>
                        )}
                        {memo.detention > 0 && (
                          <div className="text-xs text-gray-500">
                            Detention: {formatCurrency(memo.detention)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          memo.balance > 0 ? 'bg-green-100 text-green-800' : 
                          memo.balance < 0 ? 'bg-red-100 text-red-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {memo.balance > 0 ? 'Due' : memo.balance < 0 ? 'Overpaid' : 'Settled'}
                        </span>
                        {memo.advances.length > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {memo.advances.length} Advance{memo.advances.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setShowAdvanceForm(memo.id)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors duration-150"
                            title="Add Advance"
                          >
                            <DollarSign className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePreviewPDF(memo)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors duration-150"
                            title="View PDF"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => generateMemoPDF(memo)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleView(memo)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors duration-150"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(memo)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 transition-colors duration-150"
                            title="Edit Memo"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(memo.id)}
                            className="inline-flex items-center p-2 border border-transparent rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors duration-150"
                            title="Delete Memo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleMarkAsPaid(memo)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-150 shadow-sm"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No memos</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first broker memo.</p>
            <div className="mt-6">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="-ml-1 mr-2 h-4 w-4" />
                Add Memo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Memo Modal */}
      {viewingMemo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">View Memo - {viewingMemo.memoNo}</h2>
                <button
                  onClick={() => setViewingMemo(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Memo Number</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.memoNo}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loading Date</label>
                  <div className="p-2 bg-gray-50 rounded border">{formatDate(viewingMemo.loadingDate)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.from}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.to}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.supplierName}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.partyName || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.vehicle}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.weight} MT</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingMemo.material || '-'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Freight</label>
                  <div className="p-2 bg-gray-50 rounded border font-semibold">{formatCurrency(viewingMemo.freight)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mamul</label>
                  <div className="p-2 bg-gray-50 rounded border">{formatCurrency(viewingMemo.mamul)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detention</label>
                  <div className="p-2 bg-gray-50 rounded border">{formatCurrency(viewingMemo.detention)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="p-2 bg-gray-50 rounded border">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      viewingMemo.status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {viewingMemo.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Tracking Section */}
              <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-purple-900 mb-4">Payment Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(viewingMemo.freight + viewingMemo.commission + viewingMemo.detention - viewingMemo.mamul)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency((viewingMemo.freight + viewingMemo.commission + viewingMemo.detention - viewingMemo.mamul) - viewingMemo.balance)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Balance</label>
                    <div className={`text-lg font-semibold ${
                      viewingMemo.balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(viewingMemo.balance)}
                    </div>
                  </div>
                </div>
                {viewingMemo.paidDate && (
                  <div className="mt-3 text-sm text-gray-600">
                    <strong>Paid Date:</strong> {formatDate(viewingMemo.paidDate)}
                  </div>
                )}
              </div>

              {/* Advances */}
              {viewingMemo.advances.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Advances</h3>
                  <div className="space-y-2">
                    {viewingMemo.advances.map((advance) => (
                      <div key={advance.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <span className="text-sm font-medium">{formatCurrency(advance.amount)}</span>
                          <span className="text-sm text-gray-500 ml-2">on {formatDate(advance.date)}</span>
                          {advance.narration && (
                            <span className="text-sm text-gray-600 ml-2">- {advance.narration}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => generateMemoPDF(viewingMemo)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setViewingMemo(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {previewMemo && (
        <PDFPreviewModal
          isOpen={isPreviewOpen}
          onClose={closePreview}
          title={`Memo #${previewMemo.memoNo} - PDF Preview`}
          generatePDF={async () => {
            // Create a modified version of generateMemoPDF that returns the PDF object
            const { generateMemoPDFForPreview } = await import('../utils/pdfGenerator');
            return generateMemoPDFForPreview(previewMemo);
          }}
        />
      )}
    </div>
  );
};

export default Memo;