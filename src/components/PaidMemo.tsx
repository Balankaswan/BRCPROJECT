import React, { useState, useMemo } from 'react';
import { Download, Eye, Search, Edit2, Save, X } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Memo } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { generateMemoPDF } from '../utils/pdfGenerator';

const PaidMemo: React.FC = () => {
  const [paidMemos, setPaidMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.PAID_MEMOS, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ paidNarration: '' });

  // Filter paid memos based on search term
  const filteredMemos = useMemo(() => {
    if (!searchTerm.trim()) return paidMemos;
    
    return paidMemos.filter(memo => 
      memo.memoNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [paidMemos, searchTerm]);

  const handleEditClick = (memo: Memo) => {
    setEditingMemoId(memo.id);
    // Since memos don't have a paidNarration field in the type, we'll create one if needed
    setEditForm({ paidNarration: (memo as any).paidNarration || '' });
  };

  const handleSaveEdit = (memo: Memo) => {
    const updatedMemo = {
      ...memo,
      paidNarration: editForm.paidNarration.trim() || undefined
    };
    
    setPaidMemos(prev => prev.map(m => m.id === memo.id ? updatedMemo : m));
    setEditingMemoId(null);
    setEditForm({ paidNarration: '' });
  };

  const handleCancelEdit = () => {
    setEditingMemoId(null);
    setEditForm({ paidNarration: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paid Memos</h1>
        <div className="text-sm text-gray-500">
          Total Paid Memos: {paidMemos.length}
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
              placeholder="Search paid memos by memo number, supplier, route, or vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredMemos.length} of {paidMemos.length} paid memos
            </div>
          )}
        </div>
      </div>

      {/* Paid Memos List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredMemos
            .sort((a, b) => {
              // First sort by paid date if available, then by loading date
              const dateA = a.paidDate ? new Date(a.paidDate).getTime() : new Date(a.loadingDate).getTime();
              const dateB = b.paidDate ? new Date(b.paidDate).getTime() : new Date(b.loadingDate).getTime();
              return dateB - dateA; // Latest first
            })
            .map((memo) => (
            <li key={memo.id}>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium text-green-600 truncate">
                          Memo #{memo.memoNo} (PAID)
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(memo.loadingDate)} • {memo.from} → {memo.to}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900">
                          Supplier: {memo.supplierName}
                        </p>
                        <p className="text-sm text-gray-500">
                          Vehicle: {memo.vehicle}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          Freight: {formatCurrency(memo.freight)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Commission: {formatCurrency(memo.commission)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">
                          Paid Amount: {formatCurrency(memo.balance)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Paid Date: {memo.paidDate ? formatDate(memo.paidDate) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {editingMemoId === memo.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(memo)}
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
                        onClick={() => handleEditClick(memo)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Edit Paid Memo"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => generateMemoPDF(memo)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Paid Details */}
                <div className="mt-4 pl-4 border-l-2 border-green-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Paid Narration:</h4>
                  {editingMemoId === memo.id ? (
                    <textarea
                      value={editForm.paidNarration}
                      onChange={(e) => setEditForm({ paidNarration: e.target.value })}
                      placeholder="Enter paid narration..."
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-600">
                      {(memo as any).paidNarration || <span className="italic text-gray-400">No narration provided</span>}
                    </p>
                  )}
                </div>

                {/* Advances List */}
                {memo.advances.length > 0 && (
                  <div className="mt-4 pl-4 border-l-2 border-green-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Advances Given:</h4>
                    <div className="space-y-1">
                      {memo.advances.map((advance) => (
                        <div key={advance.id} className="flex justify-between text-sm text-gray-600">
                          <span>{formatDate(advance.date)}: {advance.narration || 'Advance'}</span>
                          <span className="font-medium">{formatCurrency(advance.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex justify-between text-sm font-medium text-gray-900">
                        <span>Total Advances:</span>
                        <span>{formatCurrency(memo.advances.reduce((sum, adv) => sum + adv.amount, 0))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="mt-4 pl-4 border-l-2 border-blue-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Summary:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Freight Amount:</span>
                      <span className="ml-2 font-medium">{formatCurrency(memo.freight)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Commission (6%):</span>
                      <span className="ml-2 font-medium text-red-600">-{formatCurrency(memo.commission)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Mamul:</span>
                      <span className="ml-2 font-medium text-red-600">-{formatCurrency(memo.mamul)}</span>
                    </div>
                    {memo.detention > 0 && (
                      <div>
                        <span className="text-gray-500">Detention:</span>
                        <span className="ml-2 font-medium text-green-600">+{formatCurrency(memo.detention)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Total Advances:</span>
                      <span className="ml-2 font-medium text-red-600">-{formatCurrency(memo.advances.reduce((sum, adv) => sum + adv.amount, 0))}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-gray-200">
                      <span className="text-gray-700 font-medium">Final Paid Amount:</span>
                      <span className="ml-2 font-bold text-green-600">{formatCurrency(memo.balance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {filteredMemos.length === 0 && paidMemos.length > 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No paid memos match your search criteria.</p>
          </div>
        )}
        
        {paidMemos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">No paid memos yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaidMemo;