import { realtimeFirebaseService } from './realtimeFirebaseService';
import { firebaseAuthService } from './firebaseAuthService';

// Types for entity relationships
export interface BillEntity {
  id: string;
  billNo: string;
  partyName: string;
  freight: number;
  detention?: number;
  rto?: number;
  extraCharges?: number;
  advances?: Array<{
    id: string;
    date: string;
    amount: number;
    narration?: string;
  }>;
  received?: number;
  receivedDate?: string;
  balance: number;
  companyId: string;
  userId: string;
}

export interface MemoEntity {
  id: string;
  memoNo: string;
  supplierName: string;
  freight: number;
  commission: number;
  commissionPercentage?: number;
  mamul?: number;
  detention?: number;
  rto?: number;
  extraCharges?: number;
  advances?: Array<{
    id: string;
    date: string;
    amount: number;
    narration?: string;
  }>;
  paid?: number;
  paidDate?: string;
  balance: number;
  companyId: string;
  userId: string;
}

export interface BankTransactionEntity {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  transactionType: 'bill' | 'memo' | 'advance_bill' | 'advance_memo' | 'other';
  amount: number;
  billNo?: string;
  memoNo?: string;
  narration: string;
  companyId: string;
  userId: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  description: string;
  amount: number;
  runningBalance: number;
  billId?: string;
  memoId?: string;
  transactionId?: string;
  companyId: string;
  userId: string;
}

class RealtimeSyncManager {
  private isInitialized = false;
  private currentUserId: string | null = null;
  private currentCompanyId: string | null = null;

  // Update authentication state
  private updateAuthState(): void {
    const authState = firebaseAuthService.getCurrentAuth();
    if (authState.isAuthenticated && authState.user) {
      this.currentUserId = authState.user.uid;
      this.currentCompanyId = authState.user.companyName || authState.user.uid;
      console.log('🔥 Real-time sync initialized for:', {
        userId: this.currentUserId,
        companyId: this.currentCompanyId
      });
    } else {
      this.currentUserId = null;
      this.currentCompanyId = null;
      this.cleanup();
    }
  }

  // Get current user ID from Firebase auth
  private getCurrentUserId(): string {
    const authState = firebaseAuthService.getCurrentAuth();
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('User not authenticated');
    }
    return authState.user.uid;
  }

  // Get current company ID from Firebase auth
  private getCurrentCompanyId(): string {
    const authState = firebaseAuthService.getCurrentAuth();
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('User not authenticated');
    }
    return authState.user.companyName || authState.user.uid;
  }

  // Initialize real-time sync for all entities
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.updateAuthState();

    if (!this.currentCompanyId) {
      throw new Error('User must be authenticated to initialize sync');
    }

    console.log('🚀 Initializing Real-time Sync Manager for company:', this.currentCompanyId);

    // Set up all real-time listeners
    const callbacks = {
      'loading_slips': this.handleLoadingSlipsUpdate.bind(this),
      'bills': this.handleBillsUpdate.bind(this),
      'memos': this.handleMemosUpdate.bind(this),
      'bank_transactions': this.handleBankTransactionsUpdate.bind(this),
      'cashbook_transactions': this.handleCashbookTransactionsUpdate.bind(this),
      'parties': this.handlePartiesUpdate.bind(this),
      'suppliers': this.handleSuppliersUpdate.bind(this),
      'party_ledger': this.handlePartyLedgerUpdate.bind(this),
      'supplier_ledger': this.handleSupplierLedgerUpdate.bind(this)
    };

    realtimeFirebaseService.initializeAllListeners(callbacks);
    this.isInitialized = true;
    console.log('✅ Real-time Sync Manager initialized successfully');
  }

  // Handle Loading Slips updates
  private handleLoadingSlipsUpdate(data: any[]): void {
    console.log('📄 Loading Slips updated:', data.length, 'items');
    localStorage.setItem('loadingSlips', JSON.stringify(data));
    this.triggerUIUpdate('loadingSlips');
  }

  // Handle Bills updates with ledger sync
  private handleBillsUpdate(data: BillEntity[]): void {
    console.log('📋 Bills updated:', data.length, 'items');
    localStorage.setItem('bills', JSON.stringify(data));
    
    // Update party ledger entries for all bills
    this.syncPartyLedgerFromBills(data);
    this.triggerUIUpdate('bills');
  }

  // Handle Memos updates with ledger sync
  private handleMemosUpdate(data: MemoEntity[]): void {
    console.log('📝 Memos updated:', data.length, 'items');
    localStorage.setItem('memos', JSON.stringify(data));
    
    // Update supplier ledger entries for all memos
    this.syncSupplierLedgerFromMemos(data);
    this.triggerUIUpdate('memos');
  }

  // Handle Bank Transactions updates
  private handleBankTransactionsUpdate(data: BankTransactionEntity[]): void {
    console.log('🏦 Bank Transactions updated:', data.length, 'items');
    localStorage.setItem('bankEntries', JSON.stringify(data));
    this.triggerUIUpdate('bankEntries');
  }

  // Handle Cashbook Transactions updates
  private handleCashbookTransactionsUpdate(data: any[]): void {
    console.log('💰 Cashbook Transactions updated:', data.length, 'items');
    localStorage.setItem('cashbookEntries', JSON.stringify(data));
    this.triggerUIUpdate('cashbookEntries');
  }

  // Handle Parties updates
  private handlePartiesUpdate(data: any[]): void {
    console.log('👥 Parties updated:', data.length, 'items');
    localStorage.setItem('parties', JSON.stringify(data));
    this.triggerUIUpdate('parties');
  }

  // Handle Suppliers updates
  private handleSuppliersUpdate(data: any[]): void {
    console.log('🚚 Suppliers updated:', data.length, 'items');
    localStorage.setItem('suppliers', JSON.stringify(data));
    this.triggerUIUpdate('suppliers');
  }

  // Handle Party Ledger updates
  private handlePartyLedgerUpdate(data: LedgerEntry[]): void {
    console.log('📊 Party Ledger updated:', data.length, 'items');
    localStorage.setItem('partyLedger', JSON.stringify(data));
    this.triggerUIUpdate('partyLedger');
  }

  // Handle Supplier Ledger updates
  private handleSupplierLedgerUpdate(data: LedgerEntry[]): void {
    console.log('📈 Supplier Ledger updated:', data.length, 'items');
    localStorage.setItem('supplierLedger', JSON.stringify(data));
    this.triggerUIUpdate('supplierLedger');
  }

  // Create Bill with automatic ledger updates
  async createBill(billData: Omit<BillEntity, 'id' | 'companyId' | 'userId'>): Promise<string> {
    console.log('🔥 Creating bill with real-time sync:', billData.billNo);
    
    // Calculate balance
    const totalAmount = billData.freight + (billData.detention || 0) + (billData.rto || 0) + (billData.extraCharges || 0);
    const advancesTotal = billData.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0;
    const receivedAmount = billData.received || 0;
    const balance = totalAmount - advancesTotal - receivedAmount;

    const bill: Omit<BillEntity, 'id'> = {
      ...billData,
      balance,
      companyId: this.getCurrentCompanyId(),
      userId: this.getCurrentUserId()
    };

    // Create party ledger entries
    const partyLedgerEntries = this.generatePartyLedgerEntries(bill, 'temp_bill_id');

    const billId = await realtimeFirebaseService.createDocument('bills', bill, 
      partyLedgerEntries.map(entry => ({
        collection: 'party_ledger',
        docId: entry.id,
        data: { ...entry, billId }
      }))
    );

    console.log('✅ Bill created with ID:', billId);
    return billId;
  }

  // Create Memo with automatic ledger updates
  async createMemo(memoData: Omit<MemoEntity, 'id' | 'companyId' | 'userId'>): Promise<string> {
    console.log('🔥 Creating memo with real-time sync:', memoData.memoNo);
    
    // Calculate balance
    const totalAmount = memoData.freight;
    const commission = memoData.commission;
    const mamul = memoData.mamul || 0;
    const detention = memoData.detention || 0;
    const rto = memoData.rto || 0;
    const extraCharges = memoData.extraCharges || 0;
    const advancesTotal = memoData.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0;
    const paidAmount = memoData.paid || 0;
    
    const balance = totalAmount - commission - mamul + detention + rto + extraCharges - advancesTotal - paidAmount;

    const memo: Omit<MemoEntity, 'id'> = {
      ...memoData,
      balance,
      companyId: this.getCurrentCompanyId(),
      userId: this.getCurrentUserId()
    };

    // Create supplier ledger entries
    const supplierLedgerEntries = this.generateSupplierLedgerEntries(memo as any, 'temp_memo_id');

    const memoId = await realtimeFirebaseService.createDocument('memos', memo,
      supplierLedgerEntries.map((entry: any) => ({
        collection: 'supplier_ledger',
        docId: entry.id,
        data: { ...entry, memoId }
      }))
    );

    console.log('✅ Memo created with ID:', memoId);
    return memoId;
  }

  // Update Bill with cascade updates
  async updateBill(billId: string, updates: Partial<BillEntity>): Promise<void> {
    console.log('🔥 Updating bill with cascade sync:', billId);
    
    // Get current bill data
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    const currentBill = bills.find((b: BillEntity) => b.id === billId);
    
    if (!currentBill) {
      throw new Error(`Bill ${billId} not found`);
    }

    // Calculate new balance if financial fields changed
    const updatedBill = { ...currentBill, ...updates };
    if (updates.freight !== undefined || updates.detention !== undefined || 
        updates.rto !== undefined || updates.extraCharges !== undefined ||
        updates.advances !== undefined || updates.received !== undefined) {
      
      const totalAmount = updatedBill.freight + (updatedBill.detention || 0) + 
                         (updatedBill.rto || 0) + (updatedBill.extraCharges || 0);
      const advancesTotal = updatedBill.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0;
      const receivedAmount = updatedBill.received || 0;
      updatedBill.balance = totalAmount - advancesTotal - receivedAmount;
    }

    // Generate updated ledger entries
    const updatedLedgerEntries = this.generatePartyLedgerEntries(updatedBill, billId);

    await realtimeFirebaseService.updateDocument('bills', billId, updatedBill,
      updatedLedgerEntries.map((entry: any) => ({
        collection: 'party_ledger',
        docId: entry.id,
        data: entry
      }))
    );

    console.log('✅ Bill updated with cascade sync:', billId);
  }

  // Delete Bill with cascade cleanup
  async deleteBill(billId: string): Promise<void> {
    console.log('🔥 Deleting bill with cascade cleanup:', billId);
    
    // Get current bill data
    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    const bill = bills.find((b: BillEntity) => b.id === billId);
    
    if (!bill) {
      throw new Error(`Bill ${billId} not found`);
    }

    // Find all related ledger entries to delete
    const partyLedger = JSON.parse(localStorage.getItem('partyLedger') || '[]');
    const relatedEntries = partyLedger.filter((entry: any) => entry.billId === billId);

    const cascadeUpdates = relatedEntries.map((entry: any) => ({
      collection: 'party_ledger',
      docId: entry.id,
      data: { _deleted: true } // Mark for deletion
    }));

    await realtimeFirebaseService.deleteDocument('bills', billId, cascadeUpdates);
    console.log('✅ Bill deleted with cascade cleanup:', billId);
  }

  // Create Bank Transaction with bill/memo linking
  async createBankTransaction(transactionData: Omit<BankTransactionEntity, 'id' | 'companyId' | 'userId'>): Promise<string> {
    console.log('🔥 Creating bank transaction with linking:', transactionData);
    
    const linkedUpdates: Array<{ collection: string; docId: string; data: any }> = [];

    // Handle bill payments
    if (transactionData.transactionType === 'bill' && transactionData.billNo) {
      const bills = JSON.parse(localStorage.getItem('bills') || '[]');
      const bill = bills.find((b: BillEntity) => b.billNo === transactionData.billNo);
      
      if (bill) {
        const newReceived = (bill.received || 0) + transactionData.amount;
        const newBalance = bill.freight + (bill.detention || 0) + (bill.rto || 0) + 
                          (bill.extraCharges || 0) - 
                          (bill.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0) - 
                          newReceived;
        
        linkedUpdates.push({
          collection: 'bills',
          docId: bill.id,
          data: { 
            received: newReceived, 
            balance: newBalance,
            receivedDate: transactionData.date
          }
        });
      }
    }

    // Handle memo payments
    if (transactionData.transactionType === 'memo' && transactionData.memoNo) {
      const memos = JSON.parse(localStorage.getItem('memos') || '[]');
      const memo = memos.find((m: MemoEntity) => m.memoNo === transactionData.memoNo);
      
      if (memo) {
        const newPaid = (memo.paid || 0) + transactionData.amount;
        const newBalance = memo.freight - memo.commission - (memo.mamul || 0) + 
                          (memo.detention || 0) + (memo.rto || 0) + (memo.extraCharges || 0) -
                          (memo.advances?.reduce((sum: number, adv: any) => sum + adv.amount, 0) || 0) - 
                          newPaid;
        
        linkedUpdates.push({
          collection: 'memos',
          docId: memo.id,
          data: { 
            paid: newPaid, 
            balance: newBalance,
            paidDate: transactionData.date
          }
        });
      }
    }

    const transactionId = await realtimeFirebaseService.createDocument('bank_transactions', transactionData, linkedUpdates);
    console.log('✅ Bank transaction created with linking:', transactionId);
    return transactionId;
  }

  // Generate party ledger entries for a bill
  private generatePartyLedgerEntries(bill: Partial<BillEntity>, billId: string): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    let runningBalance = 0;

    // Bill amount (credit)
    const billAmount = bill.freight! + (bill.detention || 0) + (bill.rto || 0) + (bill.extraCharges || 0);
    runningBalance += billAmount;
    
    entries.push({
      id: `${billId}_bill_credit`,
      date: new Date().toISOString().split('T')[0],
      type: 'credit',
      description: `Bill ${bill.billNo} - Freight Amount`,
      amount: billAmount,
      runningBalance,
      billId,
      companyId: this.currentCompanyId!,
      userId: firebaseAuthService.getCurrentAuth().user!.uid
    });

    // Advances (debit)
    if (bill.advances) {
      for (const advance of bill.advances) {
        runningBalance -= advance.amount;
        entries.push({
          id: `${billId}_advance_${advance.id}`,
          date: advance.date,
          type: 'debit',
          description: `Advance - ${advance.narration || 'Payment'}`,
          amount: advance.amount,
          runningBalance,
          billId,
          companyId: this.currentCompanyId!,
          userId: firebaseAuthService.getCurrentAuth().user!.uid
        });
      }
    }

    // Received amount (debit)
    if (bill.received) {
      runningBalance -= bill.received;
      entries.push({
        id: `${billId}_received`,
        date: bill.receivedDate || new Date().toISOString().split('T')[0],
        type: 'debit',
        description: `Payment Received`,
        amount: bill.received,
        runningBalance,
        billId,
        companyId: this.currentCompanyId!,
        userId: firebaseAuthService.getCurrentAuth().user!.uid
      });
    }

    return entries;
  }

  // Generate supplier ledger entries for a memo
  private generateSupplierLedgerEntries(memo: Partial<MemoEntity>, memoId: string): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    let runningBalance = 0;

    // Freight amount (credit)
    runningBalance += memo.freight!;
    entries.push({
      id: `${memoId}_freight_credit`,
      date: new Date().toISOString().split('T')[0],
      type: 'credit',
      description: `Memo ${memo.memoNo} - Freight Amount`,
      amount: memo.freight!,
      runningBalance,
      memoId,
      companyId: this.currentCompanyId!,
      userId: firebaseAuthService.getCurrentAuth().user!.uid
    });

    // Commission (debit)
    runningBalance -= memo.commission!;
    entries.push({
      id: `${memoId}_commission_debit`,
      date: new Date().toISOString().split('T')[0],
      type: 'debit',
      description: `Commission (${memo.commissionPercentage || 6}%)`,
      amount: memo.commission!,
      runningBalance,
      memoId,
      companyId: this.currentCompanyId!,
      userId: firebaseAuthService.getCurrentAuth().user!.uid
    });

    // Mamul (debit)
    if (memo.mamul) {
      runningBalance -= memo.mamul;
      entries.push({
        id: `${memoId}_mamul_debit`,
        date: new Date().toISOString().split('T')[0],
        type: 'debit',
        description: `Mamul Deduction`,
        amount: memo.mamul,
        runningBalance,
        memoId,
        companyId: this.currentCompanyId!,
        userId: firebaseAuthService.getCurrentAuth().user!.uid
      });
    }

    // Detention (credit)
    if (memo.detention) {
      runningBalance += memo.detention;
      entries.push({
        id: `${memoId}_detention_credit`,
        date: new Date().toISOString().split('T')[0],
        type: 'credit',
        description: `Detention Charges`,
        amount: memo.detention,
        runningBalance,
        memoId,
        companyId: this.currentCompanyId!,
        userId: firebaseAuthService.getCurrentAuth().user!.uid
      });
    }

    return entries;
  }

  // Sync party ledger from bills data
  private async syncPartyLedgerFromBills(bills: BillEntity[]): Promise<void> {
    const allEntries: LedgerEntry[] = [];
    
    for (const bill of bills) {
      const entries = this.generatePartyLedgerEntries(bill, bill.id);
      allEntries.push(...entries);
    }

    // Update party ledger in Firestore
    for (const entry of allEntries) {
      await realtimeFirebaseService.updateDocument('party_ledger', entry.id, entry);
    }
  }

  // Sync supplier ledger from memos data
  private async syncSupplierLedgerFromMemos(memos: MemoEntity[]): Promise<void> {
    const allEntries: LedgerEntry[] = [];
    
    for (const memo of memos) {
      const entries = this.generateSupplierLedgerEntries(memo, memo.id);
      allEntries.push(...entries);
    }

    // Update supplier ledger in Firestore
    for (const entry of allEntries) {
      await realtimeFirebaseService.updateDocument('supplier_ledger', entry.id, entry);
    }
  }

  // Trigger UI updates
  private triggerUIUpdate(entityType: string): void {
    // Dispatch custom event to notify UI components
    window.dispatchEvent(new CustomEvent('realtimeDataUpdate', {
      detail: { entityType, timestamp: Date.now() }
    }));
  }

  // Get sync status
  getSyncStatus() {
    return realtimeFirebaseService.getSyncStatus();
  }

  // Cleanup
  cleanup(): void {
    realtimeFirebaseService.cleanup();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const realtimeSyncManager = new RealtimeSyncManager();
