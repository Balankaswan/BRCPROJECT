import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Party as PartyType, Bill } from '../types';
import { formatCurrency, formatDate, fixAllBalances } from '../utils/calculations';
import { apiService, useRealTimeSync } from '../services/apiService';


const Party: React.FC = () => {
  const [parties, setParties] = useState<PartyType[]>([]);

  // Load data from API and set up real-time sync
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiService.getParties();
        setParties(data);
      } catch (error) {
        console.error('Error loading parties:', error);
      }
    };
    loadData();
  }, []);

  // Set up real-time sync
  useRealTimeSync('parties', setParties);
  const [bills, setBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [receivedBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.RECEIVED_BILLS, []);
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyType | null>(null);
  const [selectedParty, setSelectedParty] = useState<PartyType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    address: '',
    gst: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const party: PartyType = {
      id: editingParty?.id || Date.now().toString(),
      name: formData.name,
      mobile: formData.mobile,
      address: formData.address,
      gst: formData.gst,
      balance: editingParty?.balance || 0,
      activeTrips: editingParty?.activeTrips || 0,
      createdAt: editingParty?.createdAt || new Date().toISOString()
    };

    try {
      if (editingParty) {
        await apiService.updateParty(editingParty.id, party);
        console.log('✅ Party updated via backend API');
      } else {
        await apiService.createParty(party);
        console.log('✅ Party created via backend API');
      }
      
      // Refresh data from API
      const updatedData = await apiService.getParties();
      setParties(updatedData);
    } catch (error) {
      console.error('❌ Failed to save party:', error);
      // Fallback to localStorage
      if (editingParty) {
        setParties(prev => prev.map(p => p.id === editingParty.id ? party : p));
      } else {
        setParties(prev => [...prev, party]);
      }
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      address: '',
      gst: ''
    });
    setShowForm(false);
    setEditingParty(null);
  };

  const handleEdit = (party: PartyType) => {
    setEditingParty(party);
    setFormData({
      name: party.name,
      mobile: party.mobile || '',
      address: party.address || '',
      gst: party.gst || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this party?')) {
      setParties(prev => prev.filter(p => p.id !== id));
    }
  };

  const getPartyBills = (partyId: string) => {
    const activeBills = bills.filter(bill => bill.partyId === partyId);
    const completedBills = receivedBills.filter(bill => bill.partyId === partyId);
    return [...activeBills, ...completedBills].sort((a, b) => 
      new Date(b.billDate).getTime() - new Date(a.billDate).getTime()
    );
  };

  const filteredParties = parties.filter(party =>
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.mobile?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSyncBalances = () => {
    if (confirm('This will recalculate all bill balances and synchronize party balances. Continue?')) {
      const { fixedBills, fixedParties } = fixAllBalances(bills, parties);
      setBills(fixedBills);
      setParties(fixedParties);
      alert('Balances synchronized successfully!');
    }
  };

  const totalPartyBalance = parties.reduce((sum, party) => sum + (party.balance || 0), 0);
  const totalActiveTrips = parties.reduce((sum, party) => sum + (party.activeTrips || 0), 0);



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Party Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleSyncBalances}
            className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md shadow-sm text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            🔄 Sync Balances
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Party
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="p-3 rounded-md bg-blue-100">
                  <div className="h-6 w-6 text-blue-600 font-bold">₹</div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Party Balance
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatCurrency(totalPartyBalance)}
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
                    Total Active Trips
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
                  <div className="h-6 w-6 text-purple-600 font-bold">{parties.length}</div>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Parties
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {parties.length}
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
          placeholder="Search parties..."
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
              {editingParty ? 'Edit Party' : 'Add Party'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Party Name</label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700">GST Number</label>
                <input
                  type="text"
                  value={formData.gst}
                  onChange={(e) => setFormData(prev => ({ ...prev, gst: e.target.value }))}
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
                  {editingParty ? 'Update' : 'Add'} Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Party Details Modal */}
      {selectedParty && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedParty.name} - Party Details
              </h3>
              <button
                onClick={() => setSelectedParty(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            {/* Party Info */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Mobile:</span>
                  <span className="ml-2 font-medium">{selectedParty.mobile || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">GST:</span>
                  <span className="ml-2 font-medium">{selectedParty.gst || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Balance:</span>
                  <span className="ml-2 font-medium text-blue-600">{formatCurrency(selectedParty.balance)}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Active Trips:</span>
                  <span className="ml-2 font-medium">{selectedParty.activeTrips}</span>
                </div>
                {selectedParty.address && (
                  <div className="col-span-2">
                    <span className="text-sm text-gray-500">Address:</span>
                    <span className="ml-2 font-medium">{selectedParty.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bills List */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Bills History</h4>
              <div className="space-y-3">
                {getPartyBills(selectedParty.id).map((bill) => (
                  <div key={bill.id} className="border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-blue-600">Bill #{bill.billNo}</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          bill.status === 'received' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bill.status === 'received' ? 'RECEIVED' : 'PENDING'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(bill.billDate)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Total Freight:</span>
                        <span className="ml-1 font-medium">{formatCurrency(bill.totalFreight)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Trips:</span>
                        <span className="ml-1 font-medium">{bill.trips.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Balance:</span>
                        <span className="ml-1 font-medium text-green-600">{formatCurrency(bill.balance)}</span>
                      </div>
                    </div>

                    {/* Trip Details */}
                    <div className="mt-3 space-y-1">
                      {bill.trips.map((trip) => (
                        <div key={trip.id} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                          <span>{formatDate(trip.loadingDate)}: {trip.from} → {trip.to}</span>
                          <span className="ml-2">({trip.vehicle})</span>
                          <span className="ml-2 font-medium">{formatCurrency(trip.freight)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {getPartyBills(selectedParty.id).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No bills found for this party.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parties List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-500">
            <div>Name</div>
            <div>Mobile Number</div>
            <div>Active Trips Count</div>
            <div>Party Balance</div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredParties.map((party) => (
            <li key={party.id}>
              <div className="px-4 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{party.name}</p>
                    {party.gst && (
                      <p className="text-sm text-gray-500">GST: {party.gst}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-900">
                    {party.mobile || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-900">
                    {party.activeTrips}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-600">
                      {formatCurrency(party.balance)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedParty(party)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleEdit(party)}
                        className="p-2 text-gray-400 hover:text-blue-500"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(party.id)}
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
        
        {filteredParties.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              {searchTerm ? 'No parties found matching your search.' : 'No parties added yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Party;