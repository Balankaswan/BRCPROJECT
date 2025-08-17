import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Eye } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Supplier as SupplierType, Memo } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { apiService, useRealTimeSync } from '../services/apiService';

const Supplier: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierType[]>([]);
  const [memos, setMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [paidMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.PAID_MEMOS, []);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierType | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load data from API and set up real-time sync
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiService.getSuppliers();
        setSuppliers(data);
      } catch (error) {
        console.error('Error loading suppliers:', error);
      }
    };
    loadData();
  }, []);

  // Set up real-time sync with cleanup to avoid duplicate listeners
  useEffect(() => {
    const unsubscribe = useRealTimeSync('suppliers', setSuppliers);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [setSuppliers]);
  
  // Set up real-time sync for memos
  useEffect(() => {
    const unsubscribe = useRealTimeSync('memos', setMemos);
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [setMemos]);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    address: ''
  });

  // Calculate supplier balance from memos
  const calculateSupplierBalance = (supplier: SupplierType, memos: Memo[]): number => {
    return memos
      .filter(memo => memo.supplierId === supplier.id && memo.status === 'pending')
      .reduce((sum, memo) => sum + memo.balance, 0);
  };

  // Synchronize supplier balances with memo balances
  const synchronizeSupplierBalances = (suppliers: SupplierType[], memos: Memo[]): SupplierType[] => {
    return suppliers.map(supplier => ({
      ...supplier,
      balance: calculateSupplierBalance(supplier, memos),
      activeTrips: memos.filter(memo => memo.supplierId === supplier.id && memo.status === 'pending').length
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const supplier: SupplierType = {
      id: editingSupplier?.id || Date.now().toString(),
      name: formData.name,
      mobile: formData.mobile,
      address: formData.address,
      balance: editingSupplier?.balance || 0,
      activeTrips: editingSupplier?.activeTrips || 0,
      createdAt: editingSupplier?.createdAt || new Date().toISOString()
    };

    try {
      if (editingSupplier) {
        // Update supplier via API
        await apiService.updateSupplier(editingSupplier.id, supplier);
        console.log('✅ Supplier updated via backend API');
      } else {
        // Create supplier via API
        await apiService.createSupplier(supplier);
        console.log('✅ Supplier created via backend API');
      }
      
      // Refresh data from API
      const updatedData = await apiService.getSuppliers();
      setSuppliers(updatedData);
      
    } catch (error) {
      console.error('❌ Failed to save supplier via API:', error);
      
      // Fallback to localStorage
      if (editingSupplier) {
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? supplier : s));
      } else {
        setSuppliers(prev => [...prev, supplier]);
      }
      console.log('✅ Supplier saved to localStorage as fallback');
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      address: ''
    });
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleEdit = (supplier: SupplierType) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      mobile: supplier.mobile || '',
      address: supplier.address || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!id || id === 'undefined') {
      alert('Cannot delete supplier: Invalid ID');
      return;
    }
    
    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        await apiService.deleteSupplier(id);
        console.log('✅ Supplier deleted via backend API');
        
        // Refresh data from API
        const updatedData = await apiService.getSuppliers();
        setSuppliers(updatedData);
      } catch (error) {
        console.error('❌ Failed to delete supplier via API:', error);
        
        // Fallback to localStorage
        setSuppliers(prev => prev.filter(s => s.id !== id));
        console.log('✅ Supplier deleted from localStorage as fallback');
      }
    }
  };

  const getSupplierMemos = (supplierId: string) => {
    const activeMemos = memos.filter(memo => memo.supplierId === supplierId);
    const completedMemos = paidMemos.filter(memo => memo.supplierId === supplierId);
    return [...activeMemos, ...completedMemos].sort((a, b) => 
      new Date(b.loadingDate).getTime() - new Date(a.loadingDate).getTime()
    );
  };

  // Calculate actual balances from memos instead of using stored values
  const suppliersWithCalculatedBalances = suppliers.map(supplier => ({
    ...supplier,
    balance: calculateSupplierBalance(supplier, memos),
    activeTrips: memos.filter(memo => memo.supplierId === supplier.id && memo.status === 'pending').length
  }));

  const filteredSuppliers = suppliersWithCalculatedBalances.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.mobile?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalSupplierBalance = suppliersWithCalculatedBalances.reduce((sum, supplier) => sum + supplier.balance, 0);
  const totalActiveTrips = suppliersWithCalculatedBalances.reduce((sum, supplier) => sum + supplier.activeTrips, 0);
  
  const handleSyncSupplierBalances = () => {
    if (confirm('This will synchronize supplier balances with memo balances. Continue?')) {
      const syncedSuppliers = synchronizeSupplierBalances(suppliers, memos);
      setSuppliers(syncedSuppliers);
      alert('Supplier balances synchronized successfully!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleSyncSupplierBalances}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sync Balances
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    Total Supplier Balance
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(totalSupplierBalance)}
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
                  <div className="h-6 w-6 text-green-600 font-bold">{totalActiveTrips}</div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Market Trips
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalActiveTrips}
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
                <div className="p-3 rounded-md bg-purple-100">
                  <div className="h-6 w-6 text-purple-600 font-bold">{suppliers.length}</div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Suppliers
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {suppliers.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Supplier Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                  {editingSupplier ? 'Update' : 'Add'} Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Details Modal */}
      {selectedSupplier && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedSupplier.name} - Supplier Details
              </h3>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            {/* Supplier Info */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Mobile:</span>
                  <span className="ml-2 font-medium">{selectedSupplier.mobile || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Balance:</span>
                  <span className="ml-2 font-medium text-red-600">{formatCurrency(calculateSupplierBalance(selectedSupplier, memos))}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Active Trips:</span>
                  <span className="ml-2 font-medium">{memos.filter(memo => memo.supplierId === selectedSupplier.id && memo.status === 'pending').length}</span>
                </div>
                {selectedSupplier.address && (
                  <div className="col-span-2">
                    <span className="text-sm text-gray-500">Address:</span>
                    <span className="ml-2 font-medium">{selectedSupplier.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Memos List */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Memos History</h4>
              <div className="space-y-3">
                {getSupplierMemos(selectedSupplier.id).map((memo) => (
                  <div key={memo.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-blue-600">Memo #{memo.memoNo}</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          memo.status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {memo.status === 'paid' ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(memo.loadingDate)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Route:</span>
                        <span className="ml-1 font-medium">{memo.from} → {memo.to}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Vehicle:</span>
                        <span className="ml-1 font-medium">{memo.vehicle}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Freight:</span>
                        <span className="ml-1 font-medium">{formatCurrency(memo.freight)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Commission:</span>
                        <span className="ml-1 font-medium text-red-600">-{formatCurrency(memo.commission)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Mamul:</span>
                        <span className="ml-1 font-medium text-red-600">-{formatCurrency(memo.mamul)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Balance:</span>
                        <span className="ml-1 font-medium text-green-600">{formatCurrency(memo.balance)}</span>
                      </div>
                    </div>

                    {/* Advances */}
                    {memo.advances && memo.advances.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Advances:</h5>
                        <div className="space-y-1">
                          {memo.advances.map((advance) => (
                            <div key={advance.id} className="flex justify-between text-sm text-gray-600">
                              <span>{formatDate(advance.date)}: {advance.narration || 'Advance'}</span>
                              <span className="font-medium">{formatCurrency(advance.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {getSupplierMemos(selectedSupplier.id).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No memos found for this supplier.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suppliers List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-500">
            <div>Supplier Name</div>
            <div>Mobile Number</div>
            <div>Active Trips</div>
            <div>Supplier Balance</div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredSuppliers.map((supplier) => (
            <li key={supplier.id}>
              <div className="px-4 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                  </div>
                  <div className="text-sm text-gray-900">
                    {supplier.mobile || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-900">
                    {supplier.activeTrips}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-600">
                      {formatCurrency(supplier.balance)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedSupplier(supplier)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="p-2 text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        
        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              {searchTerm ? 'No suppliers found matching your search.' : 'No suppliers added yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Supplier;