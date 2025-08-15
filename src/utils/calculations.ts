export const calculateCommission = (freight: number, rate: number = 6): number => {
  return Math.round((freight * rate) / 100);
};

export const calculateMemoBalance = (
  freight: number,
  advances: { amount: number }[],
  commission: number,
  mamul: number,
  detention: number = 0,
  rtoAmount: number = 0,
  extraCharge: number = 0
): number => {
  const totalAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);
  // Updated Balance = Freight - Advances - Commission - Mamul + Detention + RTO Amount + Extra Charge
  return freight - totalAdvances - commission - mamul + detention + rtoAmount + extraCharge;
};

export const calculateBillBalance = (
  totalFreight: number,
  advances: { amount: number }[],
  detention: number = 0,
  rtoChallan: number = 0,
  extraWeight: number = 0
): number => {
  const totalAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);
  // Updated Balance = Freight - Advance + RTO Challan + Detention + Extra Weight
  return totalFreight - totalAdvances + rtoChallan + detention + extraWeight;
};

export const formatCurrency = (amount: number): string => {
  // Format number with Indian comma style and Rs. prefix for better PDF compatibility
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
  return `Rs. ${formatted}`;
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Utility function to calculate total pending bills balance for a party
export const calculatePartyPendingBalance = (bills: any[], partyId: string): number => {
  return bills
    .filter(bill => bill.partyId === partyId && bill.status === 'pending')
    .reduce((sum, bill) => sum + bill.balance, 0);
};

// Utility function to recalculate bill balance with correct parameters
export const recalculateBillBalance = (bill: any): number => {
  const totalFreight = bill.trips.reduce((sum: number, trip: any) => sum + trip.freight, 0);
  const totalRtoChallan = bill.trips.reduce((sum: number, trip: any) => {
    const rtoChallanAmount = parseFloat(trip.rtoChallan) || 0;
    return sum + rtoChallanAmount;
  }, 0);
  
  return calculateBillBalance(
    totalFreight,
    bill.advances || [],
    bill.detention || 0,
    totalRtoChallan,
    0 // extraWeight - not implemented yet
  );
};

// Utility function to synchronize party balance with actual pending bills total
export const synchronizePartyBalance = (party: any, bills: any[]): number => {
  const partyPendingBills = bills.filter(bill => bill.partyId === party.id && bill.status === 'pending');
  return partyPendingBills.reduce((sum, bill) => {
    const correctBillBalance = recalculateBillBalance(bill);
    return sum + correctBillBalance;
  }, 0);
};

// Utility function to fix all bill balances and sync party balances
export const fixAllBalances = (bills: any[], parties: any[]) => {
  // First, recalculate all bill balances
  const fixedBills = bills.map(bill => ({
    ...bill,
    balance: recalculateBillBalance(bill)
  }));
  
  // Then, synchronize party balances
  const fixedParties = parties.map(party => ({
    ...party,
    balance: synchronizePartyBalance(party, fixedBills)
  }));
  
  return { fixedBills, fixedParties };
};

// Utility function to calculate supplier balance from pending memos
export const calculateSupplierBalance = (supplier: any, memos: any[]): number => {
  return memos
    .filter(memo => memo.supplierId === supplier.id && memo.status === 'pending')
    .reduce((sum, memo) => sum + memo.balance, 0);
};

// Utility function to synchronize all supplier balances with memo balances
export const synchronizeSupplierBalances = (suppliers: any[], memos: any[]) => {
  return suppliers.map(supplier => ({
    ...supplier,
    balance: calculateSupplierBalance(supplier, memos),
    activeTrips: memos.filter(memo => memo.supplierId === supplier.id && memo.status === 'pending').length
  }));
};
