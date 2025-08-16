import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Edit, Trash2, Search, Eye, FileText, Receipt } from 'lucide-react';
import PDFPreviewModal, { usePDFPreviewModal } from './PDFPreviewModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCounters } from '../hooks/useCounters';
import { STORAGE_KEYS } from '../utils/storage';
import { LoadingSlip as LoadingSlipType, Memo, Bill, Party, Supplier, Advance } from '../types';
import { formatCurrency, formatDate, calculateCommission, calculateMemoBalance } from '../utils/calculations';
import { generateLoadingSlipPDF } from '../utils/pdfGenerator';
import { validateLoadingSlipForm } from '../utils/validation';
import { initializeLocationSuggestionsFromExistingData } from '../utils/locationSuggestions';
import { initializeVehicleSupplierMappingsFromExistingData } from '../utils/vehicleSupplierMemory';
import DateInput from './DateInput';
import AutoCompleteLocationInput from './AutoCompleteLocationInput';
import DragDropInput from './DragDropInput';
import VehicleAutocomplete from './VehicleAutocomplete';
import { apiService, useRealTimeSync } from '../services/apiService';

const LoadingSlip: React.FC = () => {
  const [loadingSlips, setLoadingSlips] = useState<LoadingSlipType[]>([]);
  const [memos, setMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [bills, setBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const [parties, setParties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const { getNextNumber, getNextNumberPreview, updateCounterIfHigher } = useCounters();
  const [showForm, setShowForm] = useState(false);
  const [editingSlip, setEditingSlip] = useState<LoadingSlipType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewSlip, setPreviewSlip] = useState<LoadingSlipType | null>(null);
  const { isOpen: isPreviewOpen, openModal: openPreview, closeModal: closePreview } = usePDFPreviewModal();

  // Load data from API and set up real-time sync
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiService.getLoadingSlips();
        setLoadingSlips(data);
      } catch (error) {
        console.error('Error loading loading slips:', error);
      }
    };
    loadData();
    initializeLocationSuggestionsFromExistingData();
    initializeVehicleSupplierMappingsFromExistingData();
  }, []);

  // Set up real-time sync
  useRealTimeSync('loading_slips', setLoadingSlips);

  const [formData, setFormData] = useState({
    slipNo: getNextNumberPreview('loadingSlip'),
    date: new Date().toISOString().split('T')[0],
    vehicleNo: '',
    from: '',
    to: '',
    partyName: '',
    partyPersonName: '',
    supplierDetail: '',
    material: '',
    weight: '',
    dimensions: '',
    freight: '',
    rtoAmount: '',
    advanceAmount: ''
  });

  // Filter loading slips based on search term
  const filteredLoadingSlips = useMemo(() => {
    if (!searchTerm.trim()) return loadingSlips;
    
    return loadingSlips.filter(slip => 
      slip.slipNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (slip.supplierDetail && slip.supplierDetail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      slip.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slip.material.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatDate(slip.date).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [loadingSlips, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form including unique slip number
    const validation = validateLoadingSlipForm(formData, editingSlip?.id);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }
    
    const slip: LoadingSlipType = {
      id: editingSlip?.id || Date.now().toString(),
      slipNo: formData.slipNo || editingSlip?.slipNo || getNextNumber('loadingSlip'),
      date: formData.date,
      vehicleNo: formData.vehicleNo,
      from: formData.from,
      to: formData.to,
      partyName: formData.partyName,
      partyPersonName: formData.partyPersonName,
      supplierDetail: formData.supplierDetail,
      material: formData.material,
      weight: parseFloat(formData.weight),
      dimensions: formData.dimensions,
      freight: parseFloat(formData.freight),
      rtoAmount: parseFloat(formData.rtoAmount) || 0,
      advanceAmount: parseFloat(formData.advanceAmount) || 0,
      createdAt: editingSlip?.createdAt || new Date().toISOString()
    };

    // Map frontend fields to backend schema fields
    const backendSlip = {
      slipNumber: slip.slipNo,
      loadingDate: slip.date,
      vehicleNumber: slip.vehicleNo,
      from_location: slip.from,
      to_location: slip.to,
      partyName: slip.partyName,
      partyPersonName: slip.partyPersonName,
      supplierDetail: slip.supplierDetail,
      materialType: slip.material,
      weight: slip.weight,
      dimensions: slip.dimensions,
      freight: slip.freight,
      rtoAmount: slip.rtoAmount,
      advanceAmount: slip.advanceAmount,
      createdAt: slip.createdAt
    };

    try {
      console.log('🚀 Saving loading slip...', slip);
      
      // Try backend API first, fallback to localStorage
      try {
        if (editingSlip) {
          await apiService.updateLoadingSlip(editingSlip.id, backendSlip);
          console.log('✅ Loading slip updated via backend API');
        } else {
          await apiService.createLoadingSlip(backendSlip);
          console.log('✅ Loading slip created via backend API');
        }
        
        // Refresh data from API after successful save
        try {
          const updatedData = await apiService.getLoadingSlips();
          setLoadingSlips(updatedData);
          console.log('✅ Loading slips refreshed from API');
        } catch (refreshError) {
          console.warn('⚠️ Failed to refresh data from API:', refreshError);
        }
        
      } catch (apiError) {
        console.warn('⚠️ Backend API failed, saving to localStorage:', apiError);
        
        // Fallback to localStorage
        if (editingSlip) {
          setLoadingSlips(prev => prev.map(s => s.id === editingSlip.id ? slip : s));
        } else {
          setLoadingSlips(prev => [...prev, slip]);
        }
        console.log('✅ Loading slip saved to localStorage');
      }
      
      // Update counter if manual number was entered
      if (formData.slipNo) {
        updateCounterIfHigher('loadingSlip', formData.slipNo);
      }
      
      resetForm();
      setShowForm(false);
      
    } catch (error) {
      console.error('❌ Failed to save loading slip:', error);
      alert('Failed to save loading slip. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      slipNo: getNextNumberPreview('loadingSlip'),
      date: new Date().toISOString().split('T')[0],
      vehicleNo: '',
      from: '',
      to: '',
      partyName: '',
      partyPersonName: '',
      supplierDetail: '',
      material: '',
      weight: '',
      dimensions: '',
      freight: '',
      rtoAmount: '',
      advanceAmount: ''
    });
    setShowForm(false);
    setEditingSlip(null);
  };

  // Handle adding new supplier or party
  const handleAddNew = (name: string, type: 'party' | 'supplier') => {
    console.log(`Added new ${type}: ${name}`);
    // The DragDropInput component handles the actual addition to localStorage
    // This callback can be used for additional actions like showing notifications
  };

  // Handle PDF preview
  const handlePreview = (slip: LoadingSlipType) => {
    setPreviewSlip(slip);
    openPreview();
  };

  // Generate PDF for preview
  const generatePreviewPDF = async () => {
    if (!previewSlip) throw new Error('No slip selected for preview');
    
    // Import jsPDF dynamically to avoid issues
    const jsPDF = (await import('jspdf')).default;
    const { generateLoadingSlipPDF } = await import('../utils/pdfGenerator');
    
    // Create a temporary PDF instance
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Generate the PDF content (we need to modify the generator to return PDF instead of saving)
    await generateLoadingSlipPDF(previewSlip);
    
    return pdf;
  };

  const handleEdit = (slip: LoadingSlipType) => {
    setEditingSlip(slip);
    setFormData({
      slipNo: slip.slipNo,
      date: slip.date,
      vehicleNo: slip.vehicleNo,
      from: slip.from,
      to: slip.to,
      partyName: slip.partyName,
      partyPersonName: slip.partyPersonName || '',
      supplierDetail: slip.supplierDetail || '',
      material: slip.material,
      weight: slip.weight.toString(),
      dimensions: slip.dimensions,
      freight: slip.freight.toString(),
      rtoAmount: (slip.rtoAmount || 0).toString(),
      advanceAmount: slip.advanceAmount.toString()
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this loading slip?')) {
      try {
        // Try backend API first, fallback to localStorage
        try {
          await apiService.delete('loading_slips', id);
          console.log('✅ Loading slip deleted via backend API');
        } catch (apiError) {
          console.warn('⚠️ Backend API failed, deleting from localStorage:', apiError);
          setLoadingSlips(prev => prev.filter(s => s.id !== id));
          console.log('✅ Loading slip deleted from localStorage');
        }
      } catch (error) {
        console.error('❌ Failed to delete loading slip:', error);
        alert('Failed to delete loading slip. Please try again.');
      }
    }
  };

  const createMemoFromSlip = (slip: LoadingSlipType) => {
    // Find or create supplier using supplierDetail, not partyName
    let supplier = suppliers.find(s => s.name.toLowerCase() === slip.supplierDetail.toLowerCase());
    if (!supplier && slip.supplierDetail.trim()) {
      const newSupplier = {
        id: Date.now().toString(),
        name: slip.supplierDetail,
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      supplier = newSupplier;
      setSuppliers(prev => [...prev, newSupplier]);
    }

    // If no supplier found and no supplierDetail provided, show error
    if (!supplier) {
      alert('Cannot create memo: No supplier detail provided in Loading Slip');
      return;
    }

    const freight = slip.freight;
    const commission = calculateCommission(freight);
    const mamul = 0; // Default mamul
    const detention = 0; // Default detention
    // Do not pre-fill advance amount - keep it empty for manual entry
    const advances: Advance[] = [];
    const balance = calculateMemoBalance(freight, advances, commission, mamul, detention, 0, 0); // RTO and Extra Charge default to 0

    const memo: Memo = {
      id: Date.now().toString(),
      memoNo: getNextNumber('memo'),
      loadingDate: slip.date,
      from: slip.from,
      to: slip.to,
      supplierId: supplier.id,
      supplierName: supplier.name,
      partyName: slip.partyName, // This should remain as partyName from Loading Slip
      vehicle: slip.vehicleNo,
      material: slip.material,
      weight: slip.weight,
      freight,
      commission,
      mamul,
      detention,
      rtoAmount: 0, // Default RTO amount
      extraCharge: 0, // Default extra charge
      advances,
      balance,
      status: 'pending',
      notes: '',
      createdAt: new Date().toISOString()
    };

    setMemos(prev => [...prev, memo]);

    // Update loading slip with linked memo number
    setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo } : s));

    alert(`Memo ${memo.memoNo} created successfully!`);
  };

  const createBillFromSlip = (slip: LoadingSlipType) => {
    // Find or create party
    let party = parties.find(p => p.name.toLowerCase() === slip.partyName.toLowerCase());
    if (!party) {
      party = {
        id: Date.now().toString(),
        name: slip.partyName,
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      setParties(prev => [...prev, party!]);
    }

    const bill: Bill = {
      id: Date.now().toString(),
      billNo: getNextNumber('bill'),
      billDate: new Date().toISOString().split('T')[0],
      partyId: party.id,
      partyName: party.name,
      trips: [{
        id: Date.now().toString(),
        cnNo: slip.id,
        loadingDate: slip.date,
        from: slip.from,
        to: slip.to,
        vehicle: slip.vehicleNo,
        weight: slip.weight,
        freight: slip.freight,
        rtoChallan: '',
        detention: 0,
        mamul: 0
      }],
      totalFreight: slip.freight,
      mamul: 0,
      detention: 0,
      rtoAmount: 0,
      extraCharges: 0,
      advances: [],
      balance: slip.freight,
      status: 'pending',
      payments: [],
      totalDeductions: 0,
      netAmountReceived: 0,
      createdAt: new Date().toISOString()
    };

    setBills(prev => [...prev, bill]);

    // Update loading slip with linked bill number
    setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedBillNo: bill.billNo } : s));

    alert(`Bill ${bill.billNo} created successfully!`);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Loading Slip</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Loading Slip
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by slip number, vehicle, party, location, material, or date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingSlip ? 'Edit Loading Slip' : 'Create Loading Slip'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Loading Slip No</label>
                  <input
                    type="text"
                    value={formData.slipNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, slipNo: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto: 5805 (or enter custom)"
                  />
                </div>

                <DateInput
                  label="Date"
                  value={formData.date}
                  onChange={(value) => setFormData(prev => ({ ...prev, date: value }))}
                  required
                />

                <VehicleAutocomplete
                  label="Vehicle Number"
                  value={formData.vehicleNo}
                  onChange={(value) => setFormData(prev => ({ ...prev, vehicleNo: value }))}
                  placeholder="Enter vehicle number"
                  supplierName={formData.supplierDetail}
                  required
                />

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

                <DragDropInput
                  label="M/S (Party Name)"
                  value={formData.partyName}
                  onChange={(value) => setFormData(prev => ({ ...prev, partyName: value }))}
                  placeholder="Enter or drag customer name"
                  type="party"
                  onAddNew={handleAddNew}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Party Person Name</label>
                  <input
                    type="text"
                    value={formData.partyPersonName}
                    onChange={(e) => setFormData(prev => ({ ...prev, partyPersonName: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter contact person name"
                  />
                </div>

                <DragDropInput
                  label="Supplier Detail"
                  value={formData.supplierDetail}
                  onChange={(value) => setFormData(prev => ({ ...prev, supplierDetail: value }))}
                  placeholder="Enter or drag supplier name/details"
                  type="supplier"
                  onAddNew={handleAddNew}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Material</label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Type of goods"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight/Quantity</label>
                  <input
                    type="text"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 20MT"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Dimensions</label>
                  <input
                    type="text"
                    value={formData.dimensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 42 x 8.5 x 8 = 20MT"
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
                    placeholder="Enter freight amount"
                    required
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
                    placeholder="Enter RTO amount (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Advance Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.advanceAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, advanceAmount: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter advance amount"
                  />
                </div>
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
                  {editingSlip ? 'Update' : 'Create'} Loading Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Slips List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredLoadingSlips.map((slip) => (
            <li key={slip.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-sm font-medium text-blue-600 truncate">
                        Loading Slip #{slip.slipNo}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(slip.date)} • {slip.from} → {slip.to}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        Vehicle: {slip.vehicleNo}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        M/S: {slip.partyName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Material: {slip.material}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(slip.freight)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Weight: {slip.weight}
                      </p>
                    </div>
                    
                    {/* Linked Numbers Display */}
                    <div className="text-right">
                      {slip.linkedMemoNo && (
                        <p className="text-xs text-green-600 font-medium">
                          Memo: {slip.linkedMemoNo}
                        </p>
                      )}
                      {slip.linkedBillNo && (
                        <p className="text-xs text-blue-600 font-medium">
                          Bill: {slip.linkedBillNo}
                        </p>
                      )}
                      {!slip.linkedMemoNo && !slip.linkedBillNo && (
                        <p className="text-xs text-gray-400">
                          No links created
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Create Memo Button */}
                  {!slip.linkedMemoNo ? (
                    <button
                      onClick={() => createMemoFromSlip(slip)}
                      className="p-2 text-gray-400 hover:text-green-500"
                      title="Create Memo"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="p-2 text-green-500" title="Memo Created">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  
                  {/* Create Bill Button */}
                  {!slip.linkedBillNo ? (
                    <button
                      onClick={() => createBillFromSlip(slip)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Create Bill"
                    >
                      <Receipt className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="p-2 text-blue-500" title="Bill Created">
                      <Receipt className="h-4 w-4" />
                    </div>
                  )}
                  
                  <button
                    onClick={() => handlePreview(slip)}
                    className="p-2 text-gray-400 hover:text-green-500"
                    title="View PDF"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => generateLoadingSlipPDF(slip)}
                    className="p-2 text-gray-400 hover:text-blue-500"
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(slip)}
                    className="p-2 text-gray-400 hover:text-blue-500"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(slip.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {loadingSlips.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No loading slips created yet.</p>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        title={previewSlip ? `Loading Slip ${previewSlip.slipNo}` : 'Loading Slip'}
        generatePDF={generatePreviewPDF}
        onDownload={() => previewSlip && generateLoadingSlipPDF(previewSlip)}
      />
    </div>
  );
};

export default LoadingSlip;