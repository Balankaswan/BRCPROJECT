import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Search, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatCurrency, formatDate } from '../utils/calculations';
import { STORAGE_KEYS } from '../utils/storage';
import {
  findLinkedMemos,
  recalculateMemoAfterDeletion,
  synchronizeSupplierBalance,
  calculateBillReceivedAmount
} from '../utils/balanceCalculations';
import { updatePartyLedger, updateSupplierLedger } from '../utils/ledgerUtils';
import { apiService, useRealTimeSync } from '../services/apiService';
import AutocompleteDropdown from './AutocompleteDropdown';
import {
  BankEntry,
  Ledger,
  Bill,
  Memo,
  Party,
  Supplier,
  LedgerEntry,
  Advance
} from '../types';

const Banking: React.FC = () => {
  const [bankEntries, setBankEntries] = useLocalStorage<BankEntry[]>(STORAGE_KEYS.BANK_ENTRIES, []);
  const [ledgers, setLedgers] = useLocalStorage<Ledger[]>(STORAGE_KEYS.LEDGERS, []);
  const [bills, setBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [receivedBills, setReceivedBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.RECEIVED_BILLS, []);
  const [memos, setMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [paidMemos, setPaidMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.PAID_MEMOS, []);
  const [parties, setParties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [suppliers, setSuppliers] = useLocalStorage<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
  const [partyLedgers, setPartyLedgers] = useLocalStorage<any[]>(STORAGE_KEYS.PARTY_LEDGERS, []);
  const [supplierLedgers, setSupplierLedgers] = useLocalStorage<any[]>(STORAGE_KEYS.SUPPLIER_LEDGERS, []);

  // Set up real-time sync for banking and ledger data
  React.useEffect(() => {
    const cleanupFunctions = [
      useRealTimeSync('bank_entries', setBankEntries)
      // Note: Removed non-existent API endpoints to prevent 404 errors
      // received_bills, paid_memos, party_ledgers, supplier_ledgers, ledgers don't exist
    ];

    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') cleanup();
      });
    };
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BankEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'credit' as 'credit' | 'debit',
    amount: '',
    narration: '',
    category: 'other' as 'bill' | 'memo' | 'advance' | 'expense' | 'transfer' | 'other',
    relatedName: '',
    relatedId: '',
    senderName: '',
    receiverName: ''
  });

  // Filter bank entries based on search term
  const filteredBankEntries = useMemo(() => {
    if (!searchTerm.trim()) return bankEntries;
    
    return bankEntries.filter(entry => 
      formatDate(entry.date).toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.narration.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.relatedName && entry.relatedName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.senderName && entry.senderName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.receiverName && entry.receiverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      entry.amount.toString().includes(searchTerm)
    );
  }, [bankEntries, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-link transaction to bill/memo if not already linked
    let linkedBillNo = formData.relatedName;
    let linkedId = formData.relatedId;
    
    if (!linkedId && formData.narration) {
      // Try to auto-link based on narration content
      const billMatch = bills.find(bill => 
        formData.narration.toLowerCase().includes(bill.billNo.toLowerCase()) ||
        formData.narration.toLowerCase().includes(bill.partyName.toLowerCase())
      );
      
      if (billMatch) {
        linkedId = billMatch.id;
        linkedBillNo = billMatch.billNo;
        console.log(`🔗 Auto-linked transaction to Bill: ${billMatch.billNo} (${billMatch.partyName})`);
      } else {
        const memoMatch = memos.find(memo => 
          formData.narration.toLowerCase().includes(memo.memoNo.toLowerCase()) ||
          formData.narration.toLowerCase().includes(memo.supplierName.toLowerCase())
        );
        
        if (memoMatch) {
          linkedId = memoMatch.id;
          linkedBillNo = memoMatch.memoNo;
          console.log(`🔗 Auto-linked transaction to Memo: ${memoMatch.memoNo} (${memoMatch.supplierName})`);
        }
      }
    }
    
    // Validate payment amount for Bill/Memo transactions
    if ((formData.category === 'bill' || formData.category === 'memo') && linkedId) {
      const amount = parseFloat(formData.amount);
      const warning = validatePaymentAmount(amount);
      if (warning) {
        if (!confirm(`${warning}. Do you want to proceed anyway?`)) {
          return;
        }
      }
    }
    
    const entry: BankEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: formData.date,
      type: formData.type,
      amount: parseFloat(formData.amount),
      particulars: formData.narration,
      narration: formData.narration,
      category: formData.category,
      relatedId: linkedId || undefined,
      relatedName: linkedBillNo || undefined,
      senderName: formData.senderName || undefined,
      receiverName: formData.receiverName || undefined,
      createdAt: editingEntry?.createdAt || new Date().toISOString()
    };

    try {
      if (editingEntry) {
        await apiService.updateBankEntry(editingEntry.id, entry);
        console.log('✅ Bank entry updated via backend API');
      } else {
        await apiService.createBankEntryWithLedgerUpdate(entry);
        console.log('✅ Bank entry created with ledger updates via backend API');
      }
      
      // Update local state for immediate UI feedback
      if (editingEntry) {
        setBankEntries(prev => prev.map(e => e.id === editingEntry.id ? entry : e));
      } else {
        setBankEntries(prev => [...prev, entry]);
      }

      // Update ledgers locally for immediate feedback
      if (entry.category === 'bill' && entry.relatedId) {
        const bill = bills.find(b => b.id === entry.relatedId) || receivedBills.find(b => b.id === entry.relatedId);
        const party = parties.find(p => p.id === bill?.partyId);
        if (bill && party) {
          const updatedLedgers = updatePartyLedger(partyLedgers, party, [bill], [entry]);
          setPartyLedgers(updatedLedgers);
          console.log('✅ Party ledger updated locally for bank transaction');
        }
      } else if (entry.category === 'memo' && entry.relatedId) {
        const memo = memos.find(m => m.id === entry.relatedId) || paidMemos.find(m => m.id === entry.relatedId);
        const supplier = suppliers.find(s => s.id === memo?.supplierId);
        if (memo && supplier) {
          const updatedLedgers = updateSupplierLedger(supplierLedgers, supplier, [memo], [entry]);
          setSupplierLedgers(updatedLedgers);
          console.log('✅ Supplier ledger updated locally for bank transaction');
        }
      }
    } catch (error) {
      console.error('❌ Failed to save bank entry via API:', error);
      alert('Failed to save bank entry. Please try again.');
      return;
    }

    // Update Bill/Memo payment status with linked transaction
    if (linkedId) {
      const amount = parseFloat(formData.amount);
      
      // Find the linked bill or memo
      const linkedBill = bills.find(b => b.id === linkedId) || receivedBills.find(b => b.id === linkedId);
      const linkedMemo = memos.find(m => m.id === linkedId) || paidMemos.find(m => m.id === linkedId);
      
      if (linkedBill) {
        console.log(`💰 Updating bill payment: ${linkedBill.billNo} with amount ${formatCurrency(amount)}`);
        updateBillPayment(linkedId, amount);
        
        // Note: Party ledger entries are auto-generated from bills and bank entries
        console.log(`✅ Party ledger will be auto-updated for bill ${linkedBill.billNo}`);
      } else if (linkedMemo) {
        console.log(`💰 Updating memo payment: ${linkedMemo.memoNo} with amount ${formatCurrency(amount)}`);
        updateMemoPayment(linkedId, amount);
        
        // Note: Supplier ledger entries are auto-generated from memos and bank entries
        console.log(`✅ Supplier ledger will be auto-updated for memo ${linkedMemo.memoNo}`);
      } else {
        console.warn(`⚠️ Could not find bill or memo with ID: ${linkedId}`);
      }
    } else if (formData.category === 'advance' && formData.relatedId) {
      // Handle advance payments for both bills and memos
      if (formData.relatedName === 'bill') {
        updateBillAdvance(formData.relatedId, parseFloat(formData.amount), formData.type);
      } else if (formData.relatedName === 'memo') {
        updateMemoAdvance(formData.relatedId, parseFloat(formData.amount), formData.type);
      }
    }

    // Update ledger if it's an expense
    if (formData.category === 'expense' && formData.relatedName) {
      updateLedger(formData.relatedName, entry);
    }

    resetForm();
  };

  // Update Bill payment status and balance
  const updateBillPayment = (billId: string, paymentAmount: number) => {
    setBills(prev => prev.map(bill => {
      if (bill.id === billId) {
        // Add the payment as an advance to the bill (similar to memo logic)
        // Use the bank entry ID to prevent double counting in ledger
        const newAdvance = {
          id: `bank_${Date.now().toString()}`, // Prefix to identify banking advances
          date: formData.date,
          amount: paymentAmount,
          narration: formData.narration || 'Payment from Banking'
        };
        
        const updatedAdvances = [...(bill.advances || []), newAdvance];
        const newBalance = bill.balance - paymentAmount;
        const isFullyPaid = newBalance <= 0;
        
        return {
          ...bill,
          advances: updatedAdvances,
          balance: Math.max(0, newBalance),
          status: isFullyPaid ? 'received' as const : 'pending' as const,
          receivedDate: isFullyPaid ? new Date().toISOString() : bill.receivedDate
        };
      }
      return bill;
    }));
  };

  // Update Memo payment status and balance
  const updateMemoPayment = (memoId: string, paymentAmount: number) => {
    setMemos(prev => prev.map(memo => {
      if (memo.id === memoId) {
        // Add the payment as an advance to the memo
        const newAdvance = {
          id: Date.now().toString(),
          date: formData.date,
          amount: paymentAmount,
          narration: formData.narration || 'Payment from Banking'
        };
        
        const updatedAdvances = [...memo.advances, newAdvance];
        const newBalance = memo.balance - paymentAmount;
        const isFullyPaid = newBalance <= 0;
        
        return {
          ...memo,
          advances: updatedAdvances,
          balance: Math.max(0, newBalance),
          status: isFullyPaid ? 'paid' as const : 'pending' as const,
          paidDate: isFullyPaid ? new Date().toISOString() : memo.paidDate
        };
      }
      return memo;
    }));
  };

  // Update Bill advance amount
  const updateBillAdvance = (billId: string, advanceAmount: number, transactionType: 'credit' | 'debit') => {
    setBills(prev => prev.map(bill => {
      if (bill.id === billId) {
        // Validate advance amount doesn't exceed bill total
        const currentAdvanceTotal = bill.advances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
        const newAdvanceTotal = transactionType === 'credit' 
          ? currentAdvanceTotal + advanceAmount 
          : currentAdvanceTotal - advanceAmount;
        
        if (newAdvanceTotal > bill.totalFreight) {
          alert(`Warning: Advance amount (${formatCurrency(newAdvanceTotal)}) exceeds bill total (${formatCurrency(bill.totalFreight)}). Proceeding with confirmation.`);
        }
        
        // Add the advance transaction
        const newAdvance = {
          id: Date.now().toString(),
          date: formData.date,
          amount: transactionType === 'credit' ? advanceAmount : -advanceAmount,
          narration: formData.narration || `Advance ${transactionType} from Banking`
        };
        
        const updatedAdvances: Advance[] = [...bill.advances, newAdvance];
        const totalAdvances = updatedAdvances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
        const newBalance = bill.totalFreight + (bill.detention || 0) + (bill.rtoAmount || 0) + (bill.extraCharges || 0) - totalAdvances - (bill.mamul || 0);
        
        return {
          ...bill,
          advances: updatedAdvances,
          balance: Math.max(0, newBalance)
        };
      }
      return bill;
    }));
  };

  // Update Memo advance amount
  const updateMemoAdvance = (memoId: string, advanceAmount: number, transactionType: 'credit' | 'debit') => {
    setMemos(prev => prev.map(memo => {
      if (memo.id === memoId) {
        // Validate advance amount doesn't exceed memo total
        const currentAdvanceTotal = memo.advances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
        const newAdvanceTotal = transactionType === 'credit' 
          ? currentAdvanceTotal + advanceAmount 
          : currentAdvanceTotal - advanceAmount;
        
        if (newAdvanceTotal > memo.freight) {
          alert(`Warning: Advance amount (${formatCurrency(newAdvanceTotal)}) exceeds memo freight (${formatCurrency(memo.freight)}). Proceeding with confirmation.`);
        }
        
        // Add the advance transaction
        const newAdvance = {
          id: Date.now().toString(),
          date: formData.date,
          amount: transactionType === 'credit' ? advanceAmount : -advanceAmount,
          narration: formData.narration || `Advance ${transactionType} from Banking`
        };
        
        const updatedAdvances: Advance[] = [...memo.advances, newAdvance];
        const totalAdvances = updatedAdvances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
        const newBalance = memo.freight + (memo.detention || 0) + (memo.extraCharge || 0) - totalAdvances - (memo.commission || 0) - (memo.mamul || 0);
        
        return {
          ...memo,
          advances: updatedAdvances,
          balance: Math.max(0, newBalance)
        };
      }
      return memo;
    }));
  };

  const updateLedger = (ledgerName: string, entry: BankEntry) => {
    setLedgers(prev => {
      const existingLedger = prev.find(l => l.name.toLowerCase() === ledgerName.toLowerCase());
      
      if (existingLedger) {
        const newEntry: LedgerEntry = {
          id: Date.now().toString(),
          date: entry.date,
          description: entry.narration,
          debit: entry.type === 'debit' ? entry.amount : 0,
          credit: entry.type === 'credit' ? entry.amount : 0,
          balance: existingLedger.balance + (entry.type === 'credit' ? entry.amount : -entry.amount),
          type: 'expense',
          relatedId: entry.id
        };

        return prev.map(ledger => 
          ledger.id === existingLedger.id 
            ? { 
                ...ledger, 
                entries: [...ledger.entries, newEntry],
                balance: newEntry.balance
              }
            : ledger
        );
      } else {
        const newLedger: Ledger = {
          id: Date.now().toString(),
          name: ledgerName,
          type: 'expense',
          entries: [{
            id: Date.now().toString(),
            date: entry.date,
            description: entry.narration,
            debit: entry.type === 'debit' ? entry.amount : 0,
            credit: entry.type === 'credit' ? entry.amount : 0,
            balance: entry.type === 'credit' ? entry.amount : -entry.amount,
            type: 'expense',
            relatedId: entry.id
          }],
          balance: entry.type === 'credit' ? entry.amount : -entry.amount,
          createdAt: new Date().toISOString()
        };

        return [...prev, newLedger];
      }
    });
  };

  // Note: Ledger entries are now auto-generated from bills/memos and bank entries
  // No need to create them manually via API calls


  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'credit',
      amount: '',
      narration: '',
      category: 'bill',
      relatedId: '',
      relatedName: '',
      senderName: '',
      receiverName: ''
    });
    setEditingEntry(null);
    setShowForm(false);
    setPaymentWarning('');
  };

  // ===== ROLLBACK FUNCTIONS FOR TRANSACTION DELETION =====
  
  /**
   * Rollback Bill Payment - Restore bill balance and update party ledger
   */
  const rollbackBillPayment = (deletedEntry: BankEntry, updatedBankEntries: BankEntry[]) => {
    try {
      console.log('🔄 Starting Bill Payment Rollback...');
      
      // Find the linked bill
      let linkedBill: Bill | null = null;
      let isInReceivedBills = false;
      
      // Search by ID first
      if (deletedEntry.relatedId) {
        linkedBill = bills.find(b => b.id === deletedEntry.relatedId) || null;
        if (!linkedBill) {
          linkedBill = receivedBills.find(b => b.id === deletedEntry.relatedId) || null;
          if (linkedBill) isInReceivedBills = true;
        }
      }
      
      // Search by bill number if not found by ID
      if (!linkedBill && deletedEntry.relatedName) {
        linkedBill = bills.find(b => b.billNo === deletedEntry.relatedName) || null;
        if (!linkedBill) {
          linkedBill = receivedBills.find(b => b.billNo === deletedEntry.relatedName) || null;
          if (linkedBill) isInReceivedBills = true;
        }
      }
      
      if (!linkedBill) {
        return { success: false, error: 'Linked bill not found' };
      }
      
      console.log(`📋 Found linked bill: ${linkedBill.billNo}`);
      
      // Calculate bill amounts using the correct formula
      const totalBillAmount = linkedBill.totalFreight + (linkedBill.detention || 0) + (linkedBill.rtoAmount || 0) + (linkedBill.extraCharges || 0) - (linkedBill.mamul || 0);
      const totalAdvances = (linkedBill.advances || []).reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
      
      // Calculate remaining received amount from other bank entries (excluding the deleted one)
      const remainingReceivedAmount = calculateBillReceivedAmount(linkedBill.id, updatedBankEntries);
      
      // Recalculate balance: Total - Advances - Payments
      const restoredBalance = Math.max(0, totalBillAmount - totalAdvances - remainingReceivedAmount);
      
      console.log(`💰 Bill Balance Calculation:`, {
        totalBillAmount,
        totalAdvances,
        remainingReceivedAmount,
        restoredBalance,
        deletedPayment: deletedEntry.amount
      });
      
      // Create updated bill
      const updatedBill: Bill = {
        ...linkedBill,
        balance: restoredBalance,
        status: restoredBalance > 0 ? 'pending' as const : 'received' as const,
        receivedDate: restoredBalance > 0 ? undefined : linkedBill.receivedDate,
        receivedNarration: restoredBalance > 0 ? undefined : linkedBill.receivedNarration
      };
      
      // Update bill state
      if (isInReceivedBills && restoredBalance > 0) {
        // Move from received back to pending
        console.log('📤 Moving bill from received back to pending');
        setReceivedBills(prev => prev.filter(b => b.id !== linkedBill!.id));
        setBills(prev => [...prev, updatedBill]);
      } else if (isInReceivedBills) {
        // Update in received bills
        console.log('📝 Updating bill in received bills');
        setReceivedBills(prev => prev.map(b => b.id === linkedBill!.id ? updatedBill : b));
      } else {
        // Update in pending bills
        console.log('📝 Updating bill in pending bills');
        setBills(prev => prev.map(b => b.id === linkedBill!.id ? updatedBill : b));
      }
      
      // Update party balance
      const party = parties.find(p => p.id === linkedBill.partyId);
      if (party) {
        console.log(`👤 Updating party balance for ${party.name}`);
        const partyBills = [...bills.filter(b => b.id !== linkedBill.id), updatedBill].filter(b => b.partyId === party.id);
        const newPartyBalance = partyBills.reduce((sum: number, bill: Bill) => sum + bill.balance, 0);
        
        setParties(prev => prev.map(p => 
          p.id === party.id 
            ? { ...p, balance: newPartyBalance, activeTrips: partyBills.reduce((sum: number, bill: Bill) => sum + bill.trips.length, 0) }
            : p
        ));
      }
      
      console.log(`✅ Bill payment rollback completed: ${linkedBill.billNo} balance restored to ${formatCurrency(restoredBalance)}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error in rollbackBillPayment:', error);
      return { success: false, error: String(error) };
    }
  };
  
  /**
   * Rollback Bill Advance - Remove advance from bill and recalculate balance
   */
  const rollbackBillAdvance = (deletedEntry: BankEntry) => {
    try {
      console.log('🔄 Starting Bill Advance Rollback...');
      
      // Find the linked bill
      let linkedBill: Bill | null = null;
      
      if (deletedEntry.relatedId) {
        linkedBill = bills.find(b => b.id === deletedEntry.relatedId) || receivedBills.find(b => b.id === deletedEntry.relatedId) || null;
      }
      
      if (!linkedBill && deletedEntry.relatedName) {
        linkedBill = bills.find(b => b.billNo === deletedEntry.relatedName) || receivedBills.find(b => b.billNo === deletedEntry.relatedName) || null;
      }
      
      if (!linkedBill) {
        return { success: false, error: 'Linked bill not found for advance rollback' };
      }
      
      console.log(`📋 Found linked bill for advance: ${linkedBill.billNo}`);
      
      // Remove the specific advance entry that corresponds to this bank transaction
      const updatedAdvances = (linkedBill.advances || []).filter(advance => {
        // Match by amount and date (approximate match for date)
        const advanceDate = new Date(advance.date).toDateString();
        const entryDate = new Date(deletedEntry.date).toDateString();
        return !(Math.abs(advance.amount - deletedEntry.amount) < 0.01 && advanceDate === entryDate);
      });
      
      // Recalculate bill balance
      const totalBillAmount = linkedBill.totalFreight + (linkedBill.detention || 0) + (linkedBill.rtoAmount || 0) + (linkedBill.extraCharges || 0) - (linkedBill.mamul || 0);
      const totalAdvances = updatedAdvances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
      const totalPayments = calculateBillReceivedAmount(linkedBill.id, bankEntries.filter(e => e.id !== deletedEntry.id));
      const newBalance = Math.max(0, totalBillAmount - totalAdvances - totalPayments);
      
      console.log(`💰 Bill Advance Rollback Calculation:`, {
        totalBillAmount,
        totalAdvances: totalAdvances,
        totalPayments,
        newBalance,
        removedAdvance: deletedEntry.amount
      });
      
      // Update bill with removed advance
      const updatedBill: Bill = {
        ...linkedBill,
        advances: updatedAdvances,
        balance: newBalance,
        status: newBalance > 0 ? 'pending' as const : 'received' as const
      };
      
      // Update bill in appropriate state
      const isInReceivedBills = receivedBills.some(b => b.id === linkedBill.id);
      if (isInReceivedBills) {
        if (newBalance > 0) {
          // Move from received back to pending
          setReceivedBills(prev => prev.filter(b => b.id !== linkedBill!.id));
          setBills(prev => [...prev, updatedBill]);
        } else {
          setReceivedBills(prev => prev.map(b => b.id === linkedBill!.id ? updatedBill : b));
        }
      } else {
        setBills(prev => prev.map(b => b.id === linkedBill!.id ? updatedBill : b));
      }
      
      console.log(`✅ Bill advance rollback completed: ${linkedBill.billNo} balance recalculated to ${formatCurrency(newBalance)}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error in rollbackBillAdvance:', error);
      return { success: false, error: String(error) };
    }
  };

  /**
   * Rollback Memo Payment - Restore memo balance and update supplier ledger
   */
  const rollbackMemoPayment = (deletedEntry: BankEntry, updatedBankEntries: BankEntry[]) => {
    try {
      console.log('🔄 Starting Memo Payment Rollback...');
      
      // Find linked memos using utility function
      const linkedMemos = findLinkedMemos(
        [...memos, ...paidMemos],
        deletedEntry.relatedId,
        deletedEntry.relatedName
      );
      
      if (linkedMemos.length === 0) {
        return { success: false, error: 'Linked memo not found' };
      }
      
      const linkedMemo = linkedMemos[0];
      console.log(`📋 Found linked memo: ${linkedMemo.memoNo}`);
      
      // Recalculate memo after deletion using utility function
      const updatedMemo = recalculateMemoAfterDeletion(
        linkedMemo,
        deletedEntry.amount,
        updatedBankEntries
      );
      
      console.log(`💰 Memo Balance Calculation:`, {
        memoNo: linkedMemo.memoNo,
        originalBalance: linkedMemo.balance,
        restoredBalance: updatedMemo.balance,
        deletedPayment: deletedEntry.amount
      });
      
      // Update memo in appropriate state (pending or paid)
      const isInPaidMemos = paidMemos.some(m => m.id === linkedMemo.id);
      
      if (isInPaidMemos && updatedMemo.balance > 0) {
        // Move from paid back to pending
        console.log('📤 Moving memo from paid back to pending');
        setPaidMemos(prev => prev.filter(m => m.id !== linkedMemo.id));
        setMemos(prev => [...prev, updatedMemo]);
      } else if (isInPaidMemos) {
        // Update in paid memos
        console.log('📝 Updating memo in paid memos');
        setPaidMemos(prev => prev.map(m => m.id === linkedMemo.id ? updatedMemo : m));
      } else {
        // Update in pending memos
        console.log('📝 Updating memo in pending memos');
        setMemos(prev => prev.map(m => m.id === linkedMemo.id ? updatedMemo : m));
      }
      
      // Synchronize supplier balance using utility function
      const updatedSuppliers = synchronizeSupplierBalance(
        suppliers,
        linkedMemo.supplierId,
        bills,
        [...memos.filter(m => m.id !== linkedMemo.id), updatedMemo],
        updatedBankEntries
      );
      setSuppliers(updatedSuppliers);
      
      console.log(`✅ Memo payment rollback completed: ${linkedMemo.memoNo} balance restored to ${formatCurrency(updatedMemo.balance)}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error in rollbackMemoPayment:', error);
      return { success: false, error: String(error) };
    }
  };
  
  /**
   * Rollback Memo Advance - Remove advance from memo and recalculate balance
   */
  const rollbackMemoAdvance = (deletedEntry: BankEntry) => {
    try {
      console.log('🔄 Starting Memo Advance Rollback...');
      
      // Find the linked memo
      let linkedMemo: Memo | null = null;
      
      if (deletedEntry.relatedId) {
        linkedMemo = memos.find(m => m.id === deletedEntry.relatedId) || paidMemos.find(m => m.id === deletedEntry.relatedId) || null;
      }
      
      if (!linkedMemo && deletedEntry.relatedName) {
        linkedMemo = memos.find(m => m.memoNo === deletedEntry.relatedName) || paidMemos.find(m => m.memoNo === deletedEntry.relatedName) || null;
      }
      
      if (!linkedMemo) {
        return { success: false, error: 'Linked memo not found for advance rollback' };
      }
      
      console.log(`📋 Found linked memo for advance: ${linkedMemo.memoNo}`);
      
      // Remove the specific advance entry that corresponds to this bank transaction
      const updatedAdvances = (linkedMemo.advances || []).filter(advance => {
        // Match by amount and date (approximate match for date)
        const advanceDate = new Date(advance.date).toDateString();
        const entryDate = new Date(deletedEntry.date).toDateString();
        return !(Math.abs(advance.amount - deletedEntry.amount) < 0.01 && advanceDate === entryDate);
      });
      
      // Recalculate memo balance using correct formula
      // Formula: Freight + Detention + Extra - Advances - Commission - Mamul
      const totalMemoAmount = linkedMemo.freight + (linkedMemo.detention || 0) + (linkedMemo.extraCharge || 0);
      const totalAdvances = updatedAdvances.reduce((sum: number, adv: Advance) => sum + adv.amount, 0);
      const totalDeductions = (linkedMemo.commission || 0) + (linkedMemo.mamul || 0);
      const newBalance = Math.max(0, totalMemoAmount - totalAdvances - totalDeductions);
      
      console.log(`💰 Memo Advance Rollback Calculation:`, {
        totalMemoAmount,
        totalAdvances,
        totalDeductions,
        newBalance,
        removedAdvance: deletedEntry.amount
      });
      
      // Update memo with removed advance
      const updatedMemo: Memo = {
        ...linkedMemo,
        advances: updatedAdvances,
        balance: newBalance,
        status: newBalance > 0 ? 'pending' as const : 'paid' as const
      };
      
      // Update memo in appropriate state
      const isInPaidMemos = paidMemos.some(m => m.id === linkedMemo.id);
      if (isInPaidMemos) {
        if (newBalance > 0) {
          // Move from paid back to pending
          setPaidMemos(prev => prev.filter(m => m.id !== linkedMemo.id));
          setMemos(prev => [...prev, updatedMemo]);
        } else {
          setPaidMemos(prev => prev.map(m => m.id === linkedMemo.id ? updatedMemo : m));
        }
      } else {
        setMemos(prev => prev.map(m => m.id === linkedMemo.id ? updatedMemo : m));
      }
      
      console.log(`✅ Memo advance rollback completed: ${linkedMemo.memoNo} balance recalculated to ${formatCurrency(newBalance)}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error in rollbackMemoAdvance:', error);
      return { success: false, error: String(error) };
    }
  };

  const handleEdit = (entry: BankEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: entry.date,
      type: entry.type,
      amount: entry.amount.toString(),
      narration: entry.narration,
      category: entry.category,
      relatedName: entry.relatedName || '',
      relatedId: entry.relatedId || '',
      senderName: entry.senderName || '',
      receiverName: entry.receiverName || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const entryToDelete = bankEntries.find(e => e.id === id);
    
    if (!entryToDelete) {
      alert('Bank entry not found!');
      return;
    }

    // Enhanced confirmation message based on transaction type
    let confirmMessage = 'Are you sure you want to delete this entry?';
    if (entryToDelete.category === 'bill') {
      confirmMessage = `Delete Bill Payment Entry?\n\nThis will:\n- Restore bill balance and status\n- Remove payment from party ledger\n- Increase party outstanding amount`;
    } else if (entryToDelete.category === 'memo') {
      confirmMessage = `Delete Memo Payment Entry?\n\nThis will:\n- Restore memo balance and status\n- Remove payment from supplier ledger\n- Increase supplier outstanding amount`;
    } else if (entryToDelete.category === 'advance') {
      const advanceType = entryToDelete.type === 'credit' ? 'Bill Advance' : 'Memo Advance';
      confirmMessage = `Delete ${advanceType} Entry?\n\nThis will:\n- Remove advance from ${entryToDelete.type === 'credit' ? 'bill' : 'memo'}\n- Recalculate balance without this advance\n- Remove advance entry from ledger`;
    }

    if (confirm(confirmMessage)) {
      try {
        console.log('=== STARTING TRANSACTION DELETION ===' , {
          id: entryToDelete.id,
          category: entryToDelete.category,
          type: entryToDelete.type,
          amount: entryToDelete.amount,
          relatedId: entryToDelete.relatedId,
          relatedName: entryToDelete.relatedName
        });
        
        // Get the updated bank entries list without the deleted entry
        const updatedBankEntries = bankEntries.filter(e => e.id !== id);
        
        // 1. Handle Bill Payment Deletion (Credit Transactions)
        if (entryToDelete.category === 'bill' && (entryToDelete.relatedId || entryToDelete.relatedName)) {
          console.log('🔄 Processing BILL PAYMENT deletion...', { 
            relatedId: entryToDelete.relatedId, 
            relatedName: entryToDelete.relatedName, 
            amount: entryToDelete.amount 
          });
          
          const result = rollbackBillPayment(entryToDelete, updatedBankEntries);
          if (result.success) {
            console.log('✅ Bill payment rollback successful');
          } else {
            console.error('❌ Bill payment rollback failed:', result.error);
            alert(`Error rolling back bill payment: ${result.error}`);
            return;
          }
        }
        
        // 2. Handle Bill Advance Deletion (Credit Advance Transactions)
        else if (entryToDelete.category === 'advance' && entryToDelete.type === 'credit' && (entryToDelete.relatedId || entryToDelete.relatedName)) {
          console.log('🔄 Processing BILL ADVANCE deletion...', { 
            relatedId: entryToDelete.relatedId, 
            relatedName: entryToDelete.relatedName, 
            amount: entryToDelete.amount 
          });
          
          const result = rollbackBillAdvance(entryToDelete);
          if (result.success) {
            console.log('✅ Bill advance rollback successful');
          } else {
            console.error('❌ Bill advance rollback failed:', result.error);
            alert(`Error rolling back bill advance: ${result.error}`);
            return;
          }
        }
        
        // 3. Handle Memo Payment Deletion (Debit Transactions)
        else if (entryToDelete.category === 'memo' && (entryToDelete.relatedId || entryToDelete.relatedName)) {
          console.log('🔄 Processing MEMO PAYMENT deletion...');
          
          const result = rollbackMemoPayment(entryToDelete, updatedBankEntries);
          if (result.success) {
            console.log('✅ Memo payment rollback successful');
          } else {
            console.error('❌ Memo payment rollback failed:', result.error);
            alert(`Error rolling back memo payment: ${result.error}`);
            return;
          }
        }
        
        // 4. Handle Memo Advance Deletion (Debit Advance Transactions)
        else if (entryToDelete.category === 'advance' && entryToDelete.type === 'debit' && (entryToDelete.relatedId || entryToDelete.relatedName)) {
          console.log('🔄 Processing MEMO ADVANCE deletion...', { 
            relatedId: entryToDelete.relatedId, 
            relatedName: entryToDelete.relatedName, 
            amount: entryToDelete.amount 
          });
          
          const result = rollbackMemoAdvance(entryToDelete);
          if (result.success) {
            console.log('✅ Memo advance rollback successful');
          } else {
            console.error('❌ Memo advance rollback failed:', result.error);
            alert(`Error rolling back memo advance: ${result.error}`);
            return;
          }
        }
        
        // 5. Handle Expense Ledger Cleanup
        else if (entryToDelete.category === 'expense') {
          console.log('🔄 Processing EXPENSE deletion...');
          setLedgers(prev => 
            prev.map(ledger => {
              const updatedEntries = ledger.entries.filter((entry: LedgerEntry) => entry.relatedId !== id);
              const newBalance = updatedEntries.reduce((sum: number, entry: LedgerEntry) => sum + entry.credit - entry.debit, 0);
              
              return {
                ...ledger,
                entries: updatedEntries,
                balance: newBalance
              };
            })
            // Remove ledgers that have no entries left
            .filter(ledger => ledger.entries.length > 0)
          );
        }
        
        // 6. Finally, remove the banking entry
        setBankEntries(prev => prev.filter(e => e.id !== id));
        
        console.log(`✅ Bank entry deleted successfully: ${entryToDelete.category} - ${formatCurrency(entryToDelete.amount)}`);
        console.log('=== TRANSACTION DELETION COMPLETED ===');
        
        // Show success message with details
        let successMessage = 'Bank entry deleted successfully!';
        if (entryToDelete.category === 'bill') {
          successMessage = 'Bill payment deleted! Bill balance restored and party ledger updated.';
        } else if (entryToDelete.category === 'memo') {
          successMessage = 'Memo payment deleted! Memo balance restored and supplier ledger updated.';
        } else if (entryToDelete.category === 'advance') {
          const advanceType = entryToDelete.type === 'credit' ? 'Bill' : 'Memo';
          successMessage = `${advanceType} advance deleted! ${advanceType} balance recalculated and ledger updated.`;
        } else if (entryToDelete.category === 'expense') {
          successMessage = 'Expense entry deleted! Ledger updated.';
        }
        
        alert(successMessage);
        
      } catch (error) {
        console.error('Error during bank entry deletion:', error);
        alert('An error occurred while deleting the bank entry. Please check the console for details.');
      }
    }
  };

  const totalCredit = bankEntries
    .filter((entry: BankEntry) => entry.type === 'credit')
    .reduce((sum: number, entry: BankEntry) => sum + entry.amount, 0);

  const totalDebit = bankEntries
    .filter((entry: BankEntry) => entry.type === 'debit')
    .reduce((sum: number, entry: BankEntry) => sum + entry.amount, 0);

  const balance = totalCredit - totalDebit;

  // Get existing ledger names for autocomplete
  const existingLedgerNames = useMemo(() => {
    const ledgerNames = ledgers.map(ledger => ledger.name);
    // Also include unique related names from previous bank entries
    const relatedNames = bankEntries
      .filter(entry => entry.relatedName && entry.category === 'expense')
      .map(entry => entry.relatedName!)
      .filter((name, index, arr) => arr.indexOf(name) === index);
    
    const allNames = [...new Set([...ledgerNames, ...relatedNames])];
    return allNames.sort();
  }, [ledgers, bankEntries]);

  const handleCreateNewLedger = (ledgerName: string) => {
    setFormData(prev => ({ ...prev, relatedName: ledgerName }));
  };

  // Get available bills for credit transactions (pending bills only)
  const availableBills = useMemo(() => {
    return bills
      .filter(bill => bill.status === 'pending')
      .map(bill => ({
        id: bill.id,
        label: `${bill.billNo} - ${bill.partyName} (${formatCurrency(bill.balance)})`,
        value: bill.billNo,
        balance: bill.balance,
        totalAmount: bill.totalFreight + bill.detention - bill.mamul,
        paidAmount: (bill.totalFreight + bill.detention - bill.mamul) - bill.balance
      }));
  }, [bills]);

  // Get available memos for debit transactions (pending memos only)
  const availableMemos = useMemo(() => {
    return memos
      .filter(memo => memo.status === 'pending')
      .map(memo => ({
        id: memo.id,
        label: `${memo.memoNo} - ${memo.supplierName} (${formatCurrency(memo.balance)})`,
        value: memo.memoNo,
        balance: memo.balance,
        totalAmount: memo.freight + memo.commission + memo.detention - memo.mamul,
        paidAmount: (memo.freight + memo.commission + memo.detention - memo.mamul) - memo.balance
      }));
  }, [memos]);

  // Get selected Bill/Memo details
  const getSelectedBillMemo = () => {
    if (formData.category === 'bill' && formData.relatedId) {
      return availableBills.find(bill => bill.id === formData.relatedId);
    }
    if (formData.category === 'memo' && formData.relatedId) {
      return availableMemos.find(memo => memo.id === formData.relatedId);
    }
    return null;
  };

  // Validate payment amount
  const validatePaymentAmount = (amount: number) => {
    const selected = getSelectedBillMemo();
    if (!selected) return null;
    
    if (amount > selected.balance) {
      return `Payment amount (${formatCurrency(amount)}) exceeds remaining balance (${formatCurrency(selected.balance)})`;
    }
    return null;
  };

  // Handle form field changes with validation
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear related fields when category changes
    if (field === 'category') {
      setFormData(prev => ({ ...prev, relatedId: '', relatedName: '' }));
      setPaymentWarning(null);
    }
    
    // Clear type-specific fields when type changes
    if (field === 'type') {
      setFormData(prev => ({ ...prev, category: 'other', relatedId: '', relatedName: '' }));
      setPaymentWarning(null);
    }
    
    // Validate payment amount
    if (field === 'amount' && value && (formData.category === 'bill' || formData.category === 'memo')) {
      const amount = parseFloat(value);
      if (!isNaN(amount)) {
        const warning = validatePaymentAmount(amount);
        setPaymentWarning(warning);
      }
    }
  };

  // Handle Bill/Memo selection
  const handleBillMemoSelection = (selectedId: string) => {
    if (!selectedId) {
      setFormData(prev => ({ 
        ...prev, 
        relatedId: '',
        relatedName: ''
      }));
      setPaymentWarning(null);
      return;
    }

    // For regular bill/memo payments
    if (formData.category === 'bill') {
      const selected = availableBills.find(bill => bill.id === selectedId);
      if (selected) {
        setFormData(prev => ({ 
          ...prev, 
          relatedId: selectedId,
          relatedName: selected.value
        }));
      }
    } else if (formData.category === 'memo') {
      const selected = availableMemos.find(memo => memo.id === selectedId);
      if (selected) {
        setFormData(prev => ({ 
          ...prev, 
          relatedId: selectedId,
          relatedName: selected.value
        }));
      }
    } else if (formData.category === 'advance') {
      // For advance payments, find from all bills/memos
      if (formData.type === 'credit') {
        // Credit advance - find bill
        const selected = bills.find(bill => bill.id === selectedId);
        if (selected) {
          setFormData(prev => ({ 
            ...prev, 
            relatedId: selectedId,
            relatedName: selected.billNo
          }));
        }
      } else if (formData.type === 'debit') {
        // Debit advance - find memo
        const selected = memos.find(memo => memo.id === selectedId);
        if (selected) {
          setFormData(prev => ({ 
            ...prev, 
            relatedId: selectedId,
            relatedName: selected.memoNo
          }));
        }
      }
    }
    
    // Validate current amount if entered
    if (formData.amount) {
      const amount = parseFloat(formData.amount);
      if (!isNaN(amount)) {
        const warning = validatePaymentAmount(amount);
        setPaymentWarning(warning);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-md bg-green-100">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Credit
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(totalCredit)}
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
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Debit
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(totalDebit)}
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
                <div className={`p-3 rounded-md ${balance >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                  <div className={`h-6 w-6 font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ₹
                  </div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Bank Balance
                  </dt>
                  <dd className={`text-lg font-medium ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(balance)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingEntry ? 'Edit Bank Entry' : 'Add Bank Entry'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="credit">Credit (Money In)</option>
                  <option value="debit">Debit (Money Out)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {paymentWarning && (
                  <div className="mt-2 flex items-center text-sm text-amber-600">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {paymentWarning}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {formData.type === 'credit' && (
                    <>
                      <option value="bill">Bill Payment (Credit)</option>
                      <option value="advance">Advance BILL (Credit)</option>
                    </>
                  )}
                  {formData.type === 'debit' && (
                    <>
                      <option value="memo">Memo Payment (Debit)</option>
                      <option value="advance">Advance MEMO (Debit)</option>
                    </>
                  )}
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Bill Selection for Credit Transactions */}
              {formData.type === 'credit' && formData.category === 'bill' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Bill No</label>
                  <select
                    value={formData.relatedId}
                    onChange={(e) => handleBillMemoSelection(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a Bill...</option>
                    {availableBills.map(bill => (
                      <option key={bill.id} value={bill.id}>
                        {bill.label}
                      </option>
                    ))}
                  </select>
                  {availableBills.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">No pending bills available</p>
                  )}
                </div>
              )}

              {/* Memo Selection for Debit Transactions */}
              {formData.type === 'debit' && formData.category === 'memo' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Memo No</label>
                  <select
                    value={formData.relatedId}
                    onChange={(e) => handleBillMemoSelection(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a Memo...</option>
                    {availableMemos.map(memo => (
                      <option key={memo.id} value={memo.id}>
                        {memo.label}
                      </option>
                    ))}
                  </select>
                  {availableMemos.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">No pending memos available</p>
                  )}
                </div>
              )}

              {/* Bill Advance Selection for Credit Transactions */}
              {formData.type === 'credit' && formData.category === 'advance' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Bill No for Advance</label>
                  <select
                    value={formData.relatedId}
                    onChange={(e) => {
                      handleBillMemoSelection(e.target.value);
                      setFormData(prev => ({ ...prev, relatedName: 'bill' }));
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a Bill...</option>
                    {bills.map(bill => (
                      <option key={bill.id} value={bill.id}>
                        Bill #{bill.billNo} - {bill.partyName} - {formatCurrency(bill.totalFreight)}
                      </option>
                    ))}
                  </select>
                  {bills.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">No bills available</p>
                  )}
                </div>
              )}

              {/* Memo Advance Selection for Debit Transactions */}
              {formData.type === 'debit' && formData.category === 'advance' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Memo No for Advance</label>
                  <select
                    value={formData.relatedId}
                    onChange={(e) => {
                      handleBillMemoSelection(e.target.value);
                      setFormData(prev => ({ ...prev, relatedName: 'memo' }));
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a Memo...</option>
                    {memos.map(memo => (
                      <option key={memo.id} value={memo.id}>
                        Memo #{memo.memoNo} - {memo.supplierName} - {formatCurrency(memo.freight)}
                      </option>
                    ))}
                  </select>
                  {memos.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">No memos available</p>
                  )}
                </div>
              )}

              {/* Show selected Bill/Memo details */}
              {(formData.category === 'bill' || formData.category === 'memo') && formData.relatedId && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">
                    {formData.category === 'bill' ? 'Bill' : 'Memo'} Details
                  </h4>
                  {(() => {
                    const selected = getSelectedBillMemo();
                    if (!selected) return null;
                    return (
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>Total Amount: {formatCurrency(selected.totalAmount)}</div>
                        <div>Paid/Received: {formatCurrency(selected.paidAmount)}</div>
                        <div className="font-medium">Remaining Balance: {formatCurrency(selected.balance)}</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Sender Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Sender Name (Optional)</label>
                <input
                  type="text"
                  value={formData.senderName}
                  onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter sender name"
                />
              </div>

              {/* Receiver Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Receiver Name (Optional)</label>
                <input
                  type="text"
                  value={formData.receiverName}
                  onChange={(e) => setFormData(prev => ({ ...prev, receiverName: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter receiver name"
                />
              </div>

              {formData.category === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Person/Ledger Name</label>
                  <AutocompleteDropdown
                    options={existingLedgerNames}
                    value={formData.relatedName}
                    onChange={(value) => setFormData(prev => ({ ...prev, relatedName: value }))}
                    onCreateNew={handleCreateNewLedger}
                    placeholder="Enter person or expense category name"
                    allowCreate={true}
                    required={true}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Narration</label>
                <textarea
                  value={formData.narration}
                  onChange={(e) => setFormData(prev => ({ ...prev, narration: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
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
                  {editingEntry ? 'Update' : 'Add'} Entry
                </button>
              </div>
            </form>
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
              placeholder="Search bank entries by date, type, amount, category, narration, or names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredBankEntries.length} of {bankEntries.length} bank entries
            </div>
          )}
        </div>
      </div>

      {/* Bank Entries List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-500">
            <div>Date</div>
            <div>Type</div>
            <div>Amount</div>
            <div>Category</div>
            <div>Linked Bill/Memo</div>
            <div>Narration</div>
            <div>Actions</div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredBankEntries
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((entry) => (
            <li key={entry.id}>
              <div className="px-4 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-7 gap-4 items-center">
                  <div className="text-sm text-gray-900">
                    {formatDate(entry.date)}
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      entry.type === 'credit' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {entry.type === 'credit' ? 'Credit' : 'Debit'}
                    </span>
                  </div>
                  <div className={`text-sm font-medium ${
                    entry.type === 'credit' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                  </div>
                  <div className="text-sm text-gray-900 capitalize">
                    {entry.category}
                    {entry.senderName && (
                      <div className="text-xs text-blue-500">From: {entry.senderName}</div>
                    )}
                    {entry.receiverName && (
                      <div className="text-xs text-green-500">To: {entry.receiverName}</div>
                    )}
                  </div>
                  <div className="text-sm">
                    {(entry.category === 'bill' || entry.category === 'memo') && entry.relatedName ? (
                      <div className="space-y-1">
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          entry.category === 'bill' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {entry.category === 'bill' ? 'Bill' : 'Memo'}: {entry.relatedName}
                        </div>
                        {(() => {
                          if (entry.category === 'bill') {
                            const linkedBill = bills.find(b => b.id === entry.relatedId);
                            if (linkedBill) {
                              return (
                                <div className="text-xs text-gray-500">
                                  {linkedBill.partyName}
                                </div>
                              );
                            }
                          } else if (entry.category === 'memo') {
                            const linkedMemo = memos.find(m => m.id === entry.relatedId);
                            if (linkedMemo) {
                              return (
                                <div className="text-xs text-gray-500">
                                  {linkedMemo.supplierName}
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    ) : entry.relatedName ? (
                      <div className="text-gray-600">{entry.relatedName}</div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-900">
                    {entry.narration}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {filteredBankEntries.length === 0 && bankEntries.length > 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No bank entries match your search criteria.</p>
          </div>
        )}
        
        {bankEntries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No bank entries added yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Banking;