import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Download, DollarSign, Search, Eye, Paperclip, CreditCard } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Bill, BillTrip, Party, BankEntry, BillPayment, PartyLedger, POD, Advance } from '../types';
import { formatCurrency, formatDate, calculateBillBalance, recalculateBillBalance } from '../utils/calculations';
import { generateBillPDF } from '../utils/pdfGenerator';
import { validateBillForm } from '../utils/validation';
import { updatePartyLedgerForBill } from '../utils/autoLedgerManager';
import { initializeLocationSuggestionsFromExistingData } from '../utils/locationSuggestions';
import { updatePartyLedger } from '../utils/ledgerUtils';
import { usePDFPreviewModal } from '../hooks/usePDFPreviewModal';
import { useCounters } from '../hooks/useCounters';
import DateInput from './DateInput';
import AutoCompleteLocationInput from './AutoCompleteLocationInput';
import DragDropInput from './DragDropInput';
import BillPaymentModal from './BillPaymentModal';
import PDFPreviewModal from './PDFPreviewModal';
import { apiService, useRealTimeSync } from '../services/apiService';

const Bills: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);

  // Load data from API and set up real-time sync
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiService.getBills();
        setBills(data);
      } catch (error) {
        console.error('Error loading bills:', error);
      }
    };
    loadData();
  }, []);

  // Set up real-time sync (attach once with cleanup)
  useEffect(() => {
    const cleanup = useRealTimeSync('bills', setBills);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);
  const [parties, setParties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [partyLedgers, setPartyLedgers] = useLocalStorage<PartyLedger[]>(STORAGE_KEYS.PARTY_LEDGERS, []);
  const [bankEntries] = useLocalStorage<BankEntry[]>(STORAGE_KEYS.BANK_ENTRIES, []);
  const [, setPods] = useLocalStorage<POD[]>(STORAGE_KEYS.PODS, []);
  const { getNextNumber, getNextNumberPreview, updateCounterIfHigher } = useCounters();
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);
  const [showAdvanceForm, setShowAdvanceForm] = useState<string | null>(null);
  const [showPODForm, setShowPODForm] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<Bill | null>(null);
  const [, setBillPayments] = useLocalStorage<BillPayment[]>(STORAGE_KEYS.BILL_PAYMENTS, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);
  const { isOpen: isPreviewOpen, openModal: openPreview, closeModal: closePreview } = usePDFPreviewModal();

  // Initialize location suggestions from existing data on component mount
  useEffect(() => {
    initializeLocationSuggestionsFromExistingData();
  }, []);

  // Filter bills based on search term
  const filteredBills = useMemo(() => {
    if (!searchTerm.trim()) return bills;
    
    return bills.filter(bill => 
      bill.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.trips.some(trip => 
        trip.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [bills, searchTerm]);

  const [formData, setFormData] = useState<{
    billNo: string;
    billDate: string;
    partyId: string;
    partyName: string;
    mamul: string;
    detention: string;
    rtoAmount: string;
    extraCharges: string;
    notes: string;
    trips: BillTrip[];
  }>({
    billNo: getNextNumberPreview('bill'),
    billDate: new Date().toISOString().split('T')[0],
    partyId: '',
    partyName: '',
    mamul: '',
    detention: '0',
    rtoAmount: '0',
    extraCharges: '0',
    notes: '',
    trips: []
  });

  const [tripData, setTripData] = useState({
    cnNo: '',
    loadingDate: new Date().toISOString().split('T')[0],
    from: '',
    to: '',
    vehicle: '',
    weight: '',
    freight: '',
    rtoChallan: ''
  });

  const [advanceData, setAdvanceData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    narration: ''
  });

  const [podFile, setPodFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form including unique bill number
    const validation = validateBillForm(formData, editingBill?.id);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }

    const totalFreight = formData.trips.reduce((sum, trip) => sum + trip.freight, 0);
    const mamul = parseFloat(formData.mamul) || 0;
    const detention = parseFloat(formData.detention) || 0;
    const rtoAmount = parseFloat(formData.rtoAmount) || 0;
    const extraCharges = parseFloat(formData.extraCharges) || 0;
    
    // Calculate total RTO Challan from all trips (for backward compatibility)
    const totalRtoChallan = formData.trips.reduce((sum, trip) => {
      const rtoChallanAmount = parseFloat(trip.rtoChallan) || 0;
      return sum + rtoChallanAmount;
    }, 0);
    
    // Use bill-level RTO Amount if provided, otherwise use trip-level total
    const finalRtoAmount = rtoAmount > 0 ? rtoAmount : totalRtoChallan;

    // Handle bill number - use manual entry or auto-generate
    const billNo = formData.billNo || editingBill?.billNo || getNextNumber('bill');
    
    // If manual bill number was entered, update counter for next auto-increment
    if (formData.billNo && !editingBill) {
      updateCounterIfHigher('bill', formData.billNo);
    }

    const bill = {
      id: editingBill?.id || Date.now().toString(),
      billNo,
      billDate: formData.billDate,
      partyId: formData.partyId,
      partyName: formData.partyName,
      trips: formData.trips,
      totalFreight,
      mamul,
      detention,
      rtoAmount: finalRtoAmount,
      extraCharges,
      balance: calculateBillBalance(
        totalFreight,
        editingBill?.advances || [],
        detention,
        finalRtoAmount,
        extraCharges
      ),
      status: 'pending' as const,
      receivedDate: undefined,
      receivedAmount: 0,
      advances: editingBill?.advances || [],
      payments: editingBill?.payments || [],
      totalDeductions: editingBill?.totalDeductions || 0,
      netAmountReceived: editingBill?.netAmountReceived || 0,
      notes: formData.notes,
      createdAt: editingBill?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      console.log('🚀 Saving bill to backend API for real-time sync...', bill);

      if (editingBill) {
        await apiService.updateBill(editingBill.id, bill);
        console.log('✅ Bill updated successfully via backend API');
      } else {
        await apiService.createBill(bill);
        console.log('✅ Bill created successfully via backend API');
        
        // Update party ledger for new bill
        const party = parties.find(p => p.id === formData.partyId);
        if (party) {
          const updatedLedgers = updatePartyLedger(
            partyLedgers,
            party,
            [bill],
            bankEntries
          );
          setPartyLedgers(updatedLedgers);
          
          // Update party balance: credit total bill amount, debit advances
          const totalBillAmount = totalFreight + detention + finalRtoAmount + extraCharges;
          const totalAdvances = bill.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0;
          const newBalance = totalBillAmount - totalAdvances;
          
          setParties(prev => prev.map(p => 
            p.id === party.id 
              ? { ...p, balance: p.balance + newBalance, activeTrips: p.activeTrips + 1 }
              : p
          ));
          
          console.log('✅ Party ledger updated for bill creation');
        }
      }

      // The Socket.io listeners will automatically refresh the list
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('❌ Failed to save bill to backend:', error);
      alert('Failed to save bill. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      billNo: getNextNumberPreview('bill'),
      billDate: new Date().toISOString().split('T')[0],
      partyId: '',
      partyName: '',
      mamul: '',
      detention: '0',
      rtoAmount: '0',
      extraCharges: '0',
      notes: '',
      trips: []
    });

    setTripData({
      cnNo: '',
      loadingDate: new Date().toISOString().split('T')[0],
      from: '',
      to: '',
      vehicle: '',
      weight: '',
      freight: '',
      rtoChallan: ''
    });
    setShowForm(false);
    setEditingBill(null);
  };

  const handleAddTrip = () => {
    // Validate required fields
    if (!tripData.from || !tripData.to || !tripData.vehicle || !tripData.weight || !tripData.freight) {
      alert('Please fill in all required trip fields: From, To, Vehicle, Weight, and Freight');
      return;
    }

    const trip: BillTrip = {
      id: Date.now().toString(),
      cnNo: tripData.cnNo || '',
      loadingDate: tripData.loadingDate,
      from: tripData.from,
      to: tripData.to,
      vehicle: tripData.vehicle,
      weight: parseFloat(tripData.weight) || 0,
      freight: parseFloat(tripData.freight) || 0,
      rtoChallan: tripData.rtoChallan || ''
    };

    setFormData(prev => ({
      ...prev,
      trips: [...prev.trips, trip]
    }));
    setTripData({
      cnNo: '',
      loadingDate: new Date().toISOString().split('T')[0],
      from: '',
      to: '',
      vehicle: '',
      weight: '',
      freight: '',
      rtoChallan: ''
    });
  };

  const handleRemoveTrip = (tripId: string) => {
    setFormData(prev => ({ ...prev, trips: prev.trips.filter(t => t.id !== tripId) }));
  };

  const handleView = (bill: Bill) => {
    setViewingBill(bill);
  };

  const handlePreviewPDF = (bill: Bill) => {
    setPreviewBill(bill);
    openPreview();
  };

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      billNo: bill.billNo,
      billDate: bill.billDate,
      partyId: bill.partyId,
      partyName: bill.partyName,
      mamul: bill.mamul.toString(),
      detention: bill.detention.toString(),
      rtoAmount: (bill.rtoAmount || 0).toString(),
      extraCharges: (bill.extraCharges || 0).toString(),
      notes: bill.notes || '',
      trips: bill.trips
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;

    const bill = bills.find(b => b.id === id);
    if (!bill) return;

    (async () => {
      try {
        // Delete from backend first
        await apiService.deleteBill(id);
        console.log('✅ Bill deleted from backend');
      } catch (error) {
        console.warn('⚠️ Failed to delete bill from backend:', error);
      }

      // Optimistic local updates
      setBills(prev => prev.filter(b => b.id !== id));
      setParties(prev => prev.map(party => 
        party.id === bill.partyId 
          ? { ...party, balance: party.balance - bill.balance, activeTrips: party.activeTrips - bill.trips.length }
          : party
      ));
    })();
  };

const handleAddAdvance = (billId: string) => {
    const amount = parseFloat(advanceData.amount);
    const advance: Advance = {
      id: Date.now().toString(),
      amount,
      date: advanceData.date,
      narration: advanceData.narration
    };

    setBills(prev =>
      prev.map(bill => {
        if (bill.id === billId) {
          const newAdvances = [...bill.advances, advance];
          const updatedBill = { ...bill, advances: newAdvances };
          const newBalance = recalculateBillBalance(updatedBill);

          // Update party balance
          setParties(prevParties =>
            prevParties.map(party =>
              party.id === bill.partyId
                ? { ...party, balance: party.balance - amount }
                : party
            )
          );

          return { ...updatedBill, balance: newBalance };
        }
        return bill;
      })
    );

    setAdvanceData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      narration: ''
    });
    setShowAdvanceForm(null);
  };

  const handleMarkAsReceived = (bill: Bill) => {
    const receivedDate = prompt('Enter received date (YYYY-MM-DD):');
    const narration = prompt('Enter narration:') || '';
    if (!receivedDate) return;

    (async () => {
      try {
        // Persist to backend; socket will refresh list
        await apiService.updateBill(bill.id, {
          status: 'received',
          receivedDate,
          receivedNarration: narration,
          updatedAt: new Date().toISOString(),
        });

        // Optimistic local updates - update bill status in place
        setBills(prev => prev.map(b => 
          b.id === bill.id 
            ? { ...b, status: 'received' as const, receivedDate, receivedNarration: narration }
            : b
        ));

        // Update party balance
        setParties(prev => prev.map(party => 
          party.id === bill.partyId 
            ? { ...party, balance: party.balance - bill.balance, activeTrips: party.activeTrips - bill.trips.length }
            : party
        ));
      } catch (error) {
        console.error('Failed to mark bill as received:', error);
        alert('Failed to mark bill as received. Please try again.');
      }
    })();
  };

  const handlePartySelect = (partyId: string) => {
    const party = parties.find(p => p.id === partyId);
    if (party) {
      setFormData(prev => ({ ...prev, partyId, partyName: party.name }));
    }
  };

  const handleAddNewParty = () => {
    const name = prompt('Enter party name:');
    const mobile = prompt('Enter mobile number (optional):') || '';
    const address = prompt('Enter address (optional):') || '';
    const gst = prompt('Enter GST number (optional):') || '';
    
    if (name) {
      const newParty: Party = {
        id: Date.now().toString(),
        name,
        mobile,
        address,
        gst,
        balance: 0,
        activeTrips: 0,
        createdAt: new Date().toISOString()
      };
      
      setParties(prev => [...prev, newParty]);
      setFormData(prev => ({ ...prev, partyId: newParty.id, partyName: newParty.name }));
    }
  };

  const handlePODUpload = (billId: string) => {
    if (podFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target?.result as string;
        
        const pod: POD = {
          id: Date.now().toString(),
          billId,
          billNo: bills.find(b => b.id === billId)?.billNo || '',
          partyName: bills.find(b => b.id === billId)?.partyName || '',
          fileName: podFile.name,
          fileUrl: fileContent, // Store base64 data URL for persistence
          uploadDate: new Date().toISOString()
        };

        setPods(prev => [...prev, pod]);
        setBills(prev => prev.map(bill => 
          bill.id === billId 
            ? { ...bill, podAttached: true, podUrl: pod.fileUrl }
            : bill
        ));

        setPodFile(null);
        setShowPODForm(null);
      };
      
      // Convert file to base64 data URL for persistent storage
      reader.readAsDataURL(podFile);
    }
  };

  // Handle payment processing
  const handlePaymentProcessed = (payment: BillPayment, updatedBill: Bill) => {

    // Save payment record
    setBillPayments(prev => [...prev, payment]);
    
    // Update bill with new payment information
    setBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b));
    
    // Update party ledger automatically after payment
    try {
      const updatedLedgers = updatePartyLedgerForBill(partyLedgers, parties, bills, bankEntries, updatedBill);
      setPartyLedgers(updatedLedgers);
    } catch (error) {
      console.error('Failed to update party ledger:', error);
    }
    
    // Update party balance
    setParties(prev => prev.map(party => 
      party.id === updatedBill.partyId
        ? { ...party, balance: party.balance - payment.receivedAmount }
        : party
    ));
    
    // Update bill status in place (bills remain in the same list with updated status)
    setBills(prev => prev.map(b => 
      b.id === updatedBill.id ? updatedBill : b
    ));
    
    alert(`Payment processed successfully! Status: ${updatedBill.status}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Bill
        </button>
      </div>



      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingBill ? 'Edit Bill' : 'Create Bill'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bill Number</label>
                  <input
                    type="text"
                    value={formData.billNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, billNo: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto: 5909 (or enter custom)"
                  />
                </div>

                <DateInput
                  label="Bill Date"
                  value={formData.billDate}
                  onChange={(value) => setFormData(prev => ({ ...prev, billDate: value }))}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Party</label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.partyId}
                      onChange={(e) => handlePartySelect(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Party</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.id}>{party.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddNewParty}
                      className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Add New
                    </button>
                  </div>
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
                  <label className="block text-sm font-medium text-gray-700">RTO Challan Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rtoAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, rtoAmount: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter RTO Challan amount"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Extra Charges</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.extraCharges}
                    onChange={(e) => setFormData(prev => ({ ...prev, extraCharges: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter extra charges"
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
                  placeholder="Enter any additional notes or remarks for this bill..."
                />
              </div>

              {/* Trip Details Section */}
              <div className="border-t pt-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Trip Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">CN NO</label>
                    <input
                      type="text"
                      value={tripData.cnNo || ''}
                      onChange={(e) => setTripData(prev => ({ ...prev, cnNo: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter CN Number"
                    />
                  </div>

                  <DateInput
                    label="Loading Date"
                    value={tripData.loadingDate}
                    onChange={(value) => setTripData(prev => ({ ...prev, loadingDate: value }))}
                  />

                  <AutoCompleteLocationInput
                    label="From (Loading Point)"
                    value={tripData.from}
                    onChange={(value) => setTripData(prev => ({ ...prev, from: value }))}
                    placeholder="Enter loading point"
                  />

                  <AutoCompleteLocationInput
                    label="To (Unloading Point)"
                    value={tripData.to}
                    onChange={(value) => setTripData(prev => ({ ...prev, to: value }))}
                    placeholder="Enter unloading point"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vehicle</label>
                    <input
                      type="text"
                      value={tripData.vehicle}
                      onChange={(e) => setTripData(prev => ({ ...prev, vehicle: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight (MT)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripData.weight}
                      onChange={(e) => setTripData(prev => ({ ...prev, weight: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Freight</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripData.freight}
                      onChange={(e) => setTripData(prev => ({ ...prev, freight: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">RTO Challan</label>
                    <input
                      type="text"
                      value={tripData.rtoChallan}
                      onChange={(e) => setTripData(prev => ({ ...prev, rtoChallan: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter RTO Challan"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddTrip}
                      className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      Add Trip
                    </button>
                  </div>
                </div>

                {/* Added Trips List */}
                {formData.trips.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Added Trips:</h5>
                    <div className="space-y-2">
                      {formData.trips.map((trip) => (
                        <div key={trip.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                          <div className="flex-1 grid grid-cols-6 gap-2 text-sm">
                            <span>{formatDate(trip.loadingDate)}</span>
                            <span>{trip.from} → {trip.to}</span>
                            <span>{trip.vehicle}</span>
                            <span>{trip.weight} MT</span>
                            <span>{formatCurrency(trip.freight)}</span>
                            <span>{trip.rtoChallan}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTrip(trip.id)}
                            className="ml-2 p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  {editingBill ? 'Update' : 'Create'} Bill
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

              <DateInput
                label="Date"
                value={advanceData.date}
                onChange={(value) => setAdvanceData(prev => ({ ...prev, date: value }))}
                required
              />

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

      {/* POD Upload Modal */}
      {showPODForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Upload POD</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select POD File</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setPodFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPODForm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePODUpload(showPODForm)}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Upload POD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search bills by bill number, party name, route, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredBills.length} of {bills.length} bills
            </div>
          )}
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredBills
            .sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime())
            .map((bill) => (
            <li key={bill.id}>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium text-blue-600 truncate">
                          Bill #{bill.billNo}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(bill.billDate)} • {bill.partyName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          Trips: {bill.trips.length}
                        </p>
                        <p className="text-sm text-gray-500">
                          Total Freight: {formatCurrency(bill.totalFreight)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">
                          Balance: {formatCurrency(bill.balance)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Advances: {bill.advances.length}
                        </p>
                      </div>
                      {bill.podAttached && (
                        <div className="text-green-600">
                          <Paperclip className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowAdvanceForm(bill.id)}
                      className="p-2 text-gray-400 hover:text-green-500"
                      title="Add Advance"
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowPODForm(bill.id)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Upload POD"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePreviewPDF(bill)}
                      className="p-2 text-gray-400 hover:text-green-500"
                      title="View PDF"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => generateBillPDF(bill)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleView(bill)}
                      className="p-2 text-gray-400 hover:text-green-500"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(bill)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(bill.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowPaymentModal(bill)}
                      className="p-2 text-gray-400 hover:text-purple-500"
                      title="Process Payment"
                    >
                      <CreditCard className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMarkAsReceived(bill)}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                    >
                      Mark as Received
                    </button>
                  </div>
                </div>

                {/* Advances List */}
                {bill.advances.length > 0 && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Advances:</h4>
                    <div className="space-y-1">
                      {bill.advances.map((advance) => (
                        <div key={advance.id} className="flex justify-between text-sm text-gray-600">
                          <span>{formatDate(advance.date)}: {advance.narration || 'Advance'}</span>
                          <span className="font-medium">{formatCurrency(advance.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trips List */}
                <div className="mt-4 pl-4 border-l-2 border-blue-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Trips:</h4>
                  <div className="space-y-1">
                    {bill.trips.map((trip) => (
                      <div key={trip.id} className="flex justify-between text-sm text-gray-600">
                        <span>{formatDate(trip.loadingDate)}: {trip.from} → {trip.to} ({trip.vehicle})</span>
                        <span className="font-medium">{formatCurrency(trip.freight)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {filteredBills.length === 0 && bills.length > 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No bills match your search criteria.</p>
          </div>
        )}
        
        {bills.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No bills created yet.</p>
          </div>
        )}
      </div>

      {/* View Bill Modal */}
      {viewingBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">View Bill - {viewingBill.billNo}</h2>
                <button
                  onClick={() => setViewingBill(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingBill.billNo}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
                  <div className="p-2 bg-gray-50 rounded border">{formatDate(viewingBill.billDate)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                  <div className="p-2 bg-gray-50 rounded border">{viewingBill.partyName}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className="p-2 bg-gray-50 rounded border">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      viewingBill.status === 'received' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {viewingBill.status === 'received' ? 'Received' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Tracking Section */}
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-4">Payment Tracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(viewingBill.totalFreight + viewingBill.detention - viewingBill.mamul)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Received Amount</label>
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency((viewingBill.totalFreight + viewingBill.detention - viewingBill.mamul) - viewingBill.balance)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Balance</label>
                    <div className={`text-lg font-semibold ${
                      viewingBill.balance > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(viewingBill.balance)}
                    </div>
                  </div>
                </div>
                {viewingBill.receivedDate && (
                  <div className="mt-3 text-sm text-gray-600">
                    <strong>Received Date:</strong> {formatDate(viewingBill.receivedDate)}
                  </div>
                )}
              </div>

              {/* Trips Table */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Trips</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loading Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Freight</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">RTO Challan</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detention</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {viewingBill.trips.map((trip) => (
                        <tr key={trip.id}>
                          <td className="px-3 py-2 text-sm text-gray-900">{formatDate(trip.loadingDate)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.from}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.to}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.vehicle}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.weight} MT</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(trip.freight)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.rtoChallan ? formatCurrency(Number(trip.rtoChallan)) : '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{trip.detention ? formatCurrency(trip.detention) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Advances */}
              {viewingBill.advances.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Advances</h3>
                  <div className="space-y-2">
                    {viewingBill.advances.map((advance) => (
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
                  onClick={() => generateBillPDF(viewingBill)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setViewingBill(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Payment Modal */}
      <BillPaymentModal
        bill={showPaymentModal}
        isOpen={!!showPaymentModal}
        onClose={() => setShowPaymentModal(null)}
        onPaymentProcessed={handlePaymentProcessed}
      />

      {/* PDF Preview Modal */}
      {previewBill && (
        <PDFPreviewModal
          isOpen={isPreviewOpen}
          onClose={closePreview}
          title={`Bill #${previewBill.billNo} - PDF Preview`}
          generatePDF={async () => {
            // Create a modified version of generateBillPDF that returns the PDF object
            const { generateBillPDFForPreview } = await import('../utils/pdfGenerator');
            return generateBillPDFForPreview(previewBill);
          }}
        />
      )}
    </div>
  );
};

export default Bills;
