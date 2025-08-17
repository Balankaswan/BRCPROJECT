import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Edit, Trash2, Search, Eye, FileText, Receipt } from 'lucide-react';
import PDFPreviewModal, { usePDFPreviewModal } from './PDFPreviewModal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { formatCurrency, formatDate } from '../utils/formatters';
import { calculateCommission, calculateMemoBalance } from '../utils/calculations';
import { generateLoadingSlipPDF } from '../utils/pdfGenerator';
import { useCounters } from '../hooks/useCounters';
import { initializeLocationSuggestionsFromExistingData } from '../utils/locationSuggestions';
import { initializeVehicleSupplierMappingsFromExistingData } from '../utils/vehicleSupplierMemory';
import DateInput from './DateInput';
import AutoCompleteLocationInput from './AutoCompleteLocationInput';
import DragDropInput from './DragDropInput';
import VehicleAutocomplete from './VehicleAutocomplete';
import { apiService } from '../services/apiService';
import { LoadingSlip as LoadingSlipType, Memo, Bill, Party, Supplier } from '../types';

const LoadingSlip: React.FC = () => {
  const [loadingSlips, setLoadingSlips] = useLocalStorage<LoadingSlipType[]>(STORAGE_KEYS.LOADING_SLIPS, []);
  const [, setMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [, setBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const [parties, setParties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const { getNextNumber, getNextNumberPreview, updateCounterIfHigher } = useCounters();
  
  // Helper function to increment counter
  const incrementCounter = (type: 'loadingSlip' | 'memo' | 'bill') => {
    // This will increment the counter by getting next number and discarding it
    getNextNumber(type);
  };

  const [showForm, setShowForm] = useState(false);
  const [editingSlip, setEditingSlip] = useState<LoadingSlipType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewSlip, setPreviewSlip] = useState<LoadingSlipType | null>(null);
  const { isOpen: isPreviewOpen, openModal: openPreview, closeModal: closePreview } = usePDFPreviewModal();

  // Initialize location suggestions and vehicle mappings
  useEffect(() => {
    initializeLocationSuggestionsFromExistingData();
    initializeVehicleSupplierMappingsFromExistingData();
  }, []);

  // REAL-TIME DATABASE SYNC - This ensures data consistency across devices
  useEffect(() => {
    console.log('🚀 Initializing real-time database sync...');
    
    // Initial data load
    const loadInitialData = async () => {
      try {
        const [loadingSlipsData, memosData, billsData] = await Promise.all([
          apiService.getLoadingSlips(),
          apiService.getMemos(),
          apiService.getBills()
        ]);
        
        // Transform loading slips data with proper field mapping
        const transformedLoadingSlips = loadingSlipsData.map((slip: any) => {
          const transformed = {
            ...slip,
            id: slip._id || slip.id,
            slipNo: slip.slipNumber || slip.slipNo,
            date: slip.loadingDate || slip.date,
            vehicleNo: slip.vehicleNumber || slip.vehicleNo,
            from: slip.from_location || slip.from,
            to: slip.to_location || slip.to,
            material: slip.materialType || slip.material,
            weight: slip.weight || 0,
            freight: slip.freight || 0,
            partyName: slip.partyName || '',
            supplierDetail: slip.supplierDetail || '',
            linkedMemoNo: slip.linkedMemoNo || null,
            linkedBillNo: slip.linkedBillNo || null,
            // Ensure we have the raw backend fields for proper mapping
            _vehicleNumber: slip.vehicleNumber,
            _from_location: slip.from_location,
            _to_location: slip.to_location,
            _materialType: slip.materialType,
            _loadingDate: slip.loadingDate
          };
          
          console.log('🔄 Transformed slip:', {
            original: { 
              _id: slip._id, 
              slipNumber: slip.slipNumber, 
              vehicleNumber: slip.vehicleNumber,
              from_location: slip.from_location,
              to_location: slip.to_location,
              materialType: slip.materialType,
              loadingDate: slip.loadingDate
            },
            transformed: { 
              id: transformed.id, 
              slipNo: transformed.slipNo, 
              vehicleNo: transformed.vehicleNo,
              from: transformed.from,
              to: transformed.to,
              material: transformed.material,
              date: transformed.date
            }
          });
          
          return transformed;
        });
        
        // Update state with new data
        setLoadingSlips(transformedLoadingSlips);
        setMemos(memosData);
        setBills(billsData);
        
        console.log('✅ Initial data loaded:', {
          loadingSlips: transformedLoadingSlips.length,
          memos: memosData.length,
          bills: billsData.length
        });
        
      } catch (error) {
        console.error('❌ Initial data load failed:', error);
      }
    };
    
    // Load initial data
    loadInitialData();
    
    // Set up real-time sync for cross-device updates
    const syncInterval = setInterval(async () => {
      try {
        if (document.hasFocus()) { // Only sync when user is active
          console.log('🔄 Performing background sync...');
          await loadInitialData();
        }
      } catch (error) {
        console.warn('⚠️ Background sync failed:', error);
      }
    }, 30000); // Sync every 30 seconds
    
    return () => clearInterval(syncInterval);
  }, []);

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
    
    // Basic form validation
    if (!formData.slipNo || !formData.date || !formData.vehicleNo || !formData.from || !formData.to || !formData.partyName || !formData.material || !formData.weight || !formData.freight) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Check for duplicate slip number
    const existingSlip = loadingSlips.find(s => s.slipNo === formData.slipNo && s.id !== editingSlip?.id);
    if (existingSlip) {
      alert('A loading slip with this number already exists');
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
      advance: slip.advanceAmount, // Backend expects 'advance' not 'advanceAmount'
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

  const createMemoFromSlip = async (slip: LoadingSlipType) => {
    console.log('🚀 Creating memo from loading slip:', slip);
    // Prevent duplicate memo creation if already linked
    if ((slip as any).linkedMemoId || slip.linkedMemoNo) {
      alert(`This loading slip is already linked to Memo ${slip.linkedMemoNo || (slip as any).linkedMemoId}.`);
      return;
    }
    console.log('📋 Loading slip data:', {
      id: slip.id,
      slipNo: slip.slipNo,
      date: slip.date,
      from: slip.from,
      to: slip.to,
      vehicleNo: slip.vehicleNo,
      material: slip.material,
      weight: slip.weight,
      freight: slip.freight,
      supplierDetail: slip.supplierDetail,
      partyName: slip.partyName
    });
    
    // Debug: Check if data transformation is working
    console.log('🔍 Raw slip data check:', {
      _id: (slip as any)._id,
      slipNumber: (slip as any).slipNumber,
      loadingDate: (slip as any).loadingDate,
      vehicleNumber: (slip as any).vehicleNumber,
      from_location: (slip as any).from_location,
      to_location: (slip as any).to_location,
      materialType: (slip as any).materialType
    });
    
    // CRITICAL FIX: Proper field mapping from backend to frontend
    const actualVehicleNo = (slip as any).vehicleNumber || slip.vehicleNo || 'UNKNOWN';
    const actualFrom = (slip as any).from_location || slip.from || 'UNKNOWN';
    const actualTo = (slip as any).to_location || slip.to || 'UNKNOWN';
    const actualMaterial = (slip as any).materialType || slip.material || 'UNKNOWN';
    const actualDate = (slip as any).loadingDate || slip.date || 'UNKNOWN';
    
    console.log('🔧 Actual data being used:', {
      vehicleNo: actualVehicleNo,
      from: actualFrom,
      to: actualTo,
      material: actualMaterial,
      date: actualDate
    });
    
    // Find or create supplier using supplierDetail, not partyName
    let supplier = suppliers.find(s => s.name.toLowerCase() === slip.supplierDetail.toLowerCase());
    if (!supplier) {
      supplier = {
        id: Date.now().toString(),
        name: slip.supplierDetail,
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      // Create supplier via API first - check for duplicates
      try {
        // Check if supplier already exists in backend
        const existingSuppliers = await apiService.getSuppliers();
        const existingSupplier = existingSuppliers.find((s: any) => s.name.toLowerCase() === supplier!.name.toLowerCase());
        
        if (!existingSupplier) {
          const backendSupplier = {
            name: supplier.name,
            balance: supplier.balance,
            activeTrips: supplier.activeTrips,
            createdAt: supplier.createdAt
          };
          await apiService.createSupplier(backendSupplier);
          console.log('✅ Supplier created via backend API');
        } else {
          console.log('✅ Using existing supplier from backend:', existingSupplier.name);
          supplier = existingSupplier;
        }
      } catch (error) {
        console.warn('⚠️ Failed to create supplier via API, using localStorage:', error);
        setSuppliers(prev => [...prev, supplier!]);
      }
    }

    const freight = parseFloat(slip.freight.toString());
    const commission = calculateCommission(freight);
    const mamul = 0; // Default mamul
    const detention = 0; // Default detention
    const advances: { id: string; date: string; amount: number; narration: string }[] = []; // No advance amount from loading slip
    const balance = calculateMemoBalance(freight, advances, commission, mamul, detention, 0, 0);

    // Validate required fields before creating memo
    if (!actualDate || !actualFrom || !actualTo || !actualVehicleNo || !actualMaterial || !slip.weight) {
      console.error('Missing required fields:', { 
        date: actualDate, 
        from: actualFrom, 
        to: actualTo, 
        vehicleNo: actualVehicleNo, 
        material: actualMaterial, 
        weight: slip.weight 
      });
      alert('Cannot create memo: Missing required fields (date, from, to, vehicle, material, or weight)');
      return;
    }

    // Generate memo number with proper format - check for duplicates
    let memoNumber = getNextNumber('memo');
    
    // Check if memo number already exists in backend
    try {
      const existingMemos = await apiService.getMemos();
      while (existingMemos.some(m => m.memoNumber === memoNumber || (m as any).memoNo === memoNumber)) {
        incrementCounter('memo');
        memoNumber = getNextNumber('memo');
      }
    } catch (error) {
      console.warn('Could not check for duplicate memo numbers:', error);
    }
    
    console.log('🔢 Generated unique memo number:', memoNumber);
    
    const memo: Memo = {
      id: Date.now().toString(),
      memoNo: memoNumber,
      loadingDate: actualDate,
      from: actualFrom,
      to: actualTo,
      supplierId: supplier!.id,
      supplierName: supplier!.name,
      partyName: slip.partyName, // This should remain as partyName from Loading Slip
      vehicle: actualVehicleNo,
      material: actualMaterial,
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

    try {
      console.log('🚀 Creating memo via backend API...', memo);
      
      // Create memo via API with proper backend schema mapping
      const backendMemo = {
        memoNumber: memo.memoNo,
        loadingDate: memo.loadingDate,
        from_location: memo.from,
        to_location: memo.to,
        supplierName: memo.supplierName,
        partyName: memo.partyName,
        vehicleNumber: memo.vehicle,
        weight: memo.weight,
        materialType: memo.material,
        freight: memo.freight,
        mamul: memo.mamul || 0,
        detention: memo.detention || 0,
        extraCharge: memo.extraCharge || 0,
        commissionPercentage: 6, // Default commission percentage
        commission: memo.commission,
        balance: memo.balance,
        status: memo.status,
        linkedLoadingSlipId: slip.id, // Link to the loading slip
        advances: memo.advances || [],
        notes: memo.notes || '',
        paidDate: undefined,
        paidAmount: 0
      };

      console.log('🔍 Backend memo data being sent:', JSON.stringify(backendMemo, null, 2));
      
      const createdMemo = await apiService.createMemo(backendMemo);
      console.log('✅ Memo created via backend API:', createdMemo);
      const backendMemoId = createdMemo._id || createdMemo.id || memo.id;
      
      // Refresh memos from API to ensure consistent shape and IDs
      try {
        const memosData = await apiService.getMemos();
        setMemos(memosData);
      } catch (e) {
        // Fallback: push local memo with backend ID
        setMemos(prev => [...prev.filter(m => m.memoNo !== memo.memoNo), { ...memo, id: backendMemoId }]);
      }
      
      // Update local loading slip link immediately for better UX
      setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo, linkedMemoId: backendMemoId } : s));
      
      // CRITICAL FIX: Force localStorage update to prevent data loss
      const updatedLoadingSlips = loadingSlips.map(s => s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo, linkedMemoId: backendMemoId } : s);
      localStorage.setItem(STORAGE_KEYS.LOADING_SLIPS, JSON.stringify(updatedLoadingSlips));
      
      console.log('✅ Memo created and linked to loading slip');
      console.log('🔄 Data saved to localStorage for stability');
      
      // CRITICAL FIX: Update loading slip in database to show the link
      try {
        const updatedSlip = { ...slip, linkedMemoNo: memo.memoNo, linkedMemoId: backendMemoId };
        const backendSlip = {
          slipNumber: updatedSlip.slipNo,
          loadingDate: updatedSlip.date,
          vehicleNumber: updatedSlip.vehicleNo,
          from_location: updatedSlip.from,
          to_location: updatedSlip.to,
          partyName: updatedSlip.partyName,
          partyPersonName: updatedSlip.partyPersonName,
          supplierDetail: updatedSlip.supplierDetail,
          materialType: updatedSlip.material,
          weight: updatedSlip.weight,
          dimensions: updatedSlip.dimensions,
          freight: updatedSlip.freight,
          advance: updatedSlip.advanceAmount,
          linkedMemoNo: memo.memoNo,
          linkedMemoId: backendMemoId, // Use backend memo ID
          createdAt: updatedSlip.createdAt
        };
        
        console.log('🔧 Updating loading slip with memo link:', backendSlip);
        await apiService.updateLoadingSlip(slip.id, backendSlip);
        console.log('✅ Loading slip updated with memo link in database');
        
        // Also update the local state to reflect the change immediately
        setLoadingSlips(prev => prev.map(s => 
          s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo, linkedMemoId: backendMemoId } : s
        ));
        
        // CRITICAL FIX: Update localStorage to ensure persistence
        const updatedLoadingSlips = loadingSlips.map(s => 
          s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo, linkedMemoId: backendMemoId } : s
        );
        localStorage.setItem(STORAGE_KEYS.LOADING_SLIPS, JSON.stringify(updatedLoadingSlips));
        
      } catch (error) {
        console.warn(' Failed to update loading slip in database:', error);
        // Even if database update fails, ensure local state is updated
        console.log(' Falling back to local state update only');
      }
      
      alert(`Memo ${memo.memoNo} created successfully and linked to loading slip!`);
    } catch (error) {
      console.error('❌ Failed to create memo via API:', error);
      
      // Fallback to localStorage with enhanced error handling
      try {
        setMemos(prev => [...prev, memo]);
        setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedMemoNo: memo.memoNo } : s));
        console.log('✅ Memo created in localStorage as fallback');
        alert(`Memo ${memo.memoNo} created successfully (offline mode)!`);
      } catch (localError) {
        console.error('❌ Failed to create memo even in localStorage:', localError);
        alert('Failed to create memo. Please try again.');
      }
    }
  };

  const createBillFromSlip = async (slip: LoadingSlipType) => {
    // Prevent duplicate bill creation if already linked
    if ((slip as any).linkedBillId || slip.linkedBillNo) {
      alert(`This loading slip is already linked to Bill ${slip.linkedBillNo || (slip as any).linkedBillId}.`);
      return;
    }
    // Find or create party
    let party = parties.find(p => p.name.toLowerCase() === slip.partyName.toLowerCase());
    if (!party) {
      party = {
        id: Date.now().toString(),
        name: slip.partyName,
        mobile: '',
        address: '',
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      
      // CRITICAL FIX: Create party via backend API first - check for duplicates
      try {
        // Check if party already exists in backend
        const existingParties = await apiService.getParties();
        const existingParty = existingParties.find(p => p.name.toLowerCase() === party!.name.toLowerCase());
        
        if (!existingParty) {
          const backendParty = {
            name: party.name,
            mobile: party.mobile,
            address: party.address,
            balance: party.balance,
            activeTrips: party.activeTrips,
            createdAt: party.createdAt
          };
          await apiService.createParty(backendParty);
          console.log('✅ Party created via backend API');
        } else {
          console.log('✅ Using existing party from backend:', existingParty.name);
          party = existingParty;
        }
      } catch (error) {
        console.warn('⚠️ Failed to create party via API, using localStorage:', error);
      }
      
      setParties(prev => [...prev, party!]);
    }

    // CRITICAL FIX: Use actual values for bill creation
    const actualVehicleNo = slip.vehicleNo || (slip as any).vehicleNumber || 'UNKNOWN';
    const actualFrom = slip.from || (slip as any).from_location || 'UNKNOWN';
    const actualTo = slip.to || (slip as any).to_location || 'UNKNOWN';
    const actualDate = slip.date || (slip as any).loadingDate || 'UNKNOWN';
    
    if (!party) {
      console.error('❌ Party not found or created');
      alert('Failed to create party for bill');
      return;
    }
    
    // Generate bill number with proper format - check for duplicates
    let billNumber = getNextNumber('bill');
    
    // Check if bill number already exists in backend
    try {
      const existingBills = await apiService.getBills();
      while (existingBills.some(b => b.billNumber === billNumber || (b as any).billNo === billNumber)) {
        incrementCounter('bill');
        billNumber = getNextNumber('bill');
      }
    } catch (error) {
      console.warn('Could not check for duplicate bill numbers:', error);
    }
    
    console.log('🔢 Generated unique bill number:', billNumber);
    
    const bill: Bill = {
      id: Date.now().toString(),
      billNo: billNumber,
      billDate: new Date().toISOString().split('T')[0],
      partyId: party.id,
      partyName: party.name,
      trips: [{
        id: Date.now().toString(),
        cnNo: slip.id,
        loadingDate: actualDate,
        from: actualFrom,
        to: actualTo,
        vehicle: actualVehicleNo,
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

    try {
      console.log('🚀 Creating bill via backend API...', bill);
      
      // Create bill via API with proper backend schema mapping
      const backendBill = {
        billNumber: bill.billNo,
        billDate: bill.billDate,
        partyName: bill.partyName,
        totalAmount: bill.totalFreight,
        totalFreight: bill.totalFreight,
        status: bill.status,
        linkedLoadingSlipId: slip.id,
        trips: bill.trips.map(t => ({
          cnNo: t.cnNo,
          loadingDate: t.loadingDate,
          from: t.from,
          to: t.to,
          vehicleNumber: t.vehicle, // backend expects vehicleNumber
          weight: t.weight,
          freight: t.freight,
          rtoChallan: t.rtoChallan,
          detention: t.detention || 0,
          extraWeight: 0,
          advance: 0,
          balance: t.freight
        })),
        advances: bill.advances,
        balance: bill.balance,
        createdAt: bill.createdAt
      };

      console.log('🔍 Backend bill data being sent:', JSON.stringify(backendBill, null, 2));
      
      const createdBill = await apiService.createBill(backendBill);
      console.log('✅ Bill created via backend API:', createdBill);
      const backendBillId = createdBill._id || createdBill.id || bill.id;
      
      // Refresh bills from API to ensure consistent shape and IDs
      try {
        const billsData = await apiService.getBills();
        setBills(billsData);
      } catch (e) {
        // Fallback: push local bill with backend ID
        setBills(prev => [...prev.filter(b => b.billNo !== bill.billNo), { ...bill, id: backendBillId }]);
      }
      
      // Update local loading slip link immediately for better UX
      setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedBillNo: bill.billNo, linkedBillId: backendBillId } : s));
      
      // CRITICAL FIX: Force localStorage update to prevent data loss
      const updatedLoadingSlips2 = loadingSlips.map(s => s.id === slip.id ? { ...s, linkedBillNo: bill.billNo, linkedBillId: backendBillId } : s);
      localStorage.setItem(STORAGE_KEYS.LOADING_SLIPS, JSON.stringify(updatedLoadingSlips2));

      // CRITICAL FIX: Update loading slip in database to show the bill link
      try {
        const updatedSlip = { ...slip, linkedBillNo: bill.billNo, linkedBillId: backendBillId };
        const backendSlip = {
          slipNumber: updatedSlip.slipNo,
          loadingDate: updatedSlip.date,
          vehicleNumber: updatedSlip.vehicleNo,
          from_location: updatedSlip.from,
          to_location: updatedSlip.to,
          partyName: updatedSlip.partyName,
          partyPersonName: updatedSlip.partyPersonName,
          supplierDetail: updatedSlip.supplierDetail,
          materialType: updatedSlip.material,
          weight: updatedSlip.weight,
          dimensions: updatedSlip.dimensions,
          freight: updatedSlip.freight,
          advance: updatedSlip.advanceAmount,
          linkedBillNo: bill.billNo,
          linkedBillId: backendBillId,
          createdAt: updatedSlip.createdAt
        };
        
        console.log('🔧 Updating loading slip with bill link:', backendSlip);
        await apiService.updateLoadingSlip(slip.id, backendSlip);
        console.log('✅ Loading slip updated with bill link in database');
        
        // Also update the local state to reflect the change immediately
        setLoadingSlips(prev => prev.map(s => 
          s.id === slip.id ? { ...s, linkedBillNo: bill.billNo, linkedBillId: backendBillId } : s
        ));
        
        // Update party balance and activeTrips
        const partyBills = (await apiService.getBills()).filter((b: any) => b.partyName === party!.name);
        const partyBalance = partyBills.reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
        const tripsCount = partyBills.reduce((sum: number, b: any) => sum + (b.trips?.length || 0), 0);
        setParties(prev => prev.map(p => p.id === party!.id ? { ...p, balance: partyBalance, activeTrips: tripsCount } : p));
      } catch (error) {
        console.warn('⚠️ Failed to update loading slip in database:', error);
      }

      console.log('✅ Bill created and linked to loading slip');
      alert(`Bill ${bill.billNo} created successfully!`);
      
    } catch (error) {
      console.error('❌ Failed to create bill via API:', error);
      
      // Fallback to localStorage
      setBills(prev => [...prev, bill]);
      setLoadingSlips(prev => prev.map(s => s.id === slip.id ? { ...s, linkedBillNo: bill.billNo } : s));
      
      console.log('✅ Bill created in localStorage as fallback');
      alert(`Bill ${bill.billNo} created successfully (offline mode)!`);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Loading Slip</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={async () => {
              try {
                const [loadingSlipsData, memosData, billsData] = await Promise.all([
                  apiService.getLoadingSlips(),
                  apiService.getMemos(),
                  apiService.getBills()
                ]);
                
                const transformedLoadingSlips = loadingSlipsData.map((slip: any) => ({
                  ...slip,
                  id: slip._id || slip.id,
                  slipNo: slip.slipNumber || slip.slipNo,
                  date: slip.loadingDate || slip.date,
                  vehicleNo: slip.vehicleNumber || slip.vehicleNo,
                  from: slip.from_location || slip.from,
                  to: slip.to_location || slip.to,
                  material: slip.materialType || slip.material,
                  linkedMemoNo: slip.linkedMemoNo || null,
                  linkedBillNo: slip.linkedBillNo || null
                }));
                
                setLoadingSlips(transformedLoadingSlips);
                setMemos(memosData);
                setBills(billsData);
                console.log('✅ Manual refresh completed');
              } catch (error) {
                console.error('❌ Manual refresh failed:', error);
                alert('Refresh failed. Please try again.');
              }
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Loading Slip
          </button>
        </div>
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

