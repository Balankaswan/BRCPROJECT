import React, { useState, useMemo } from 'react';
import { Download, Paperclip, Search, Edit2, Save, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Bill } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { generateBillPDF } from '../utils/pdfGenerator';
import { useRealTimeSync } from '../services/apiService';

const ReceivedBills: React.FC = () => {
  const [receivedBills, setReceivedBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.RECEIVED_BILLS, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ receivedNarration: '' });

  // Set up real-time sync for received bills
  React.useEffect(() => {
    const cleanup = useRealTimeSync('received_bills', setReceivedBills);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // Filter received bills based on search term
  const filteredBills = useMemo(() => {
    if (!searchTerm.trim()) return receivedBills;
    
    return receivedBills.filter(bill => 
      bill.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.trips.some(trip => 
        trip.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trip.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [receivedBills, searchTerm]);

  const handleEditClick = (bill: Bill) => {
    setEditingBillId(bill.id);
    setEditForm({ receivedNarration: bill.receivedNarration || '' });
  };

  const handleSaveEdit = (bill: Bill) => {
    const updatedBill = {
      ...bill,
      receivedNarration: editForm.receivedNarration.trim() || undefined
    };
    
    setReceivedBills(prev => prev.map(b => b.id === bill.id ? updatedBill : b));
    setEditingBillId(null);
    setEditForm({ receivedNarration: '' });
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    setEditForm({ receivedNarration: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Received Bills</h1>
        <div className="text-sm text-gray-500">
          Total Received Bills: {receivedBills.length}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search received bills by bill number, party name, route, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredBills.length} of {receivedBills.length} received bills
            </div>
          )}
        </div>
      </div>

      {/* Received Bills List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredBills
            .sort((a, b) => {
              // First sort by received date if available, then by bill date
              const dateA = a.receivedDate ? new Date(a.receivedDate).getTime() : new Date(a.billDate).getTime();
              const dateB = b.receivedDate ? new Date(b.receivedDate).getTime() : new Date(b.billDate).getTime();
              return dateB - dateA; // Latest first
            })
            .map((bill) => (
            <li key={bill.id}>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium text-green-600 truncate">
                          Bill #{bill.billNo} (RECEIVED)
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
                          Received Amount: {formatCurrency(bill.balance)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Received Date: {bill.receivedDate ? formatDate(bill.receivedDate) : 'N/A'}
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
                    {editingBillId === bill.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(bill)}
                          className="p-2 text-green-500 hover:text-green-600"
                          title="Save Changes"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-2 text-red-500 hover:text-red-600"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditClick(bill)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Edit Received Bill"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => generateBillPDF(bill)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Received Details */}
                <div className="mt-4 pl-4 border-l-2 border-green-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Received Narration:</h4>
                  {editingBillId === bill.id ? (
                    <textarea
                      value={editForm.receivedNarration}
                      onChange={(e) => setEditForm({ receivedNarration: e.target.value })}
                      placeholder="Enter received narration..."
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-600">
                      {bill.receivedNarration || <span className="italic text-gray-400">No narration provided</span>}
                    </p>
                  )}
                </div>

                {/* Advances List */}
                {bill.advances.length > 0 && (
                  <div className="mt-4 pl-4 border-l-2 border-blue-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Advances Received:</h4>
                    <div className="space-y-1">
                      {bill.advances.map((advance) => (
                        <div key={advance.id} className="flex justify-between text-sm text-gray-600">
                          <span>{formatDate(advance.date)}: {advance.narration || 'Advance'}</span>
                          <span className="font-medium">{formatCurrency(advance.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-sm font-medium text-gray-900">
                        <span>Total Advances:</span>
                        <span>{formatCurrency(bill.advances.reduce((sum, adv) => sum + adv.amount, 0))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trips List */}
                <div className="mt-4 pl-4 border-l-2 border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Trip Details:</h4>
                  <div className="space-y-2">
                    {bill.trips.map((trip) => (
                      <div key={trip.id} className="bg-gray-50 p-3 rounded-md">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <span className="ml-1 font-medium">{formatDate(trip.loadingDate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Route:</span>
                            <span className="ml-1 font-medium">{trip.from} → {trip.to}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Vehicle:</span>
                            <span className="ml-1 font-medium">{trip.vehicle}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Freight:</span>
                            <span className="ml-1 font-medium">{formatCurrency(trip.freight)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Weight:</span>
                            <span className="ml-1 font-medium">{trip.weight} MT</span>
                          </div>
                          <div>
                            <span className="text-gray-500">RTO Challan:</span>
                            <span className="ml-1 font-medium">{trip.rtoChallan}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="mt-4 pl-4 border-l-2 border-green-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Summary:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Total Freight:</span>
                      <span className="ml-2 font-medium">{formatCurrency(bill.totalFreight)}</span>
                    </div>
                    {bill.detention > 0 && (
                      <div>
                        <span className="text-gray-500">Detention:</span>
                        <span className="ml-2 font-medium text-green-600">+{formatCurrency(bill.detention)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Mamul:</span>
                      <span className="ml-2 font-medium text-red-600">-{formatCurrency(bill.mamul)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Advances:</span>
                      <span className="ml-2 font-medium text-red-600">-{formatCurrency(bill.advances.reduce((sum, adv) => sum + adv.amount, 0))}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-gray-200">
                      <span className="text-gray-700 font-medium">Final Received Amount:</span>
                      <span className="ml-2 font-bold text-green-600">{formatCurrency(bill.balance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {filteredBills.length === 0 && receivedBills.length > 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No received bills match your search criteria.</p>
          </div>
        )}
        
        {receivedBills.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No received bills yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivedBills;