import React, { useState } from 'react';
import { Download, Eye, Search, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { POD } from '../types';
import { formatDate } from '../utils/calculations';

const PODComponent: React.FC = () => {
  const [pods, setPods] = useLocalStorage<POD[]>(STORAGE_KEYS.PODS, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPOD, setSelectedPOD] = useState<POD | null>(null);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this POD?')) {
      setPods(prev => prev.filter(pod => pod.id !== id));
    }
  };

  const handleDownload = (pod: POD) => {
    const link = document.createElement('a');
    link.href = pod.fileUrl;
    link.download = pod.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPODs = pods.filter(pod =>
    pod.billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">POD (Proof of Delivery)</h1>
        <div className="text-sm text-gray-500">
          Total PODs: {pods.length}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 rounded-md bg-blue-100">
                <div className="h-6 w-6 text-blue-600 font-bold">{pods.length}</div>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total POD Documents
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {pods.length} files uploaded
                </dd>
              </dl>
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
          placeholder="Search by bill number, party name, or file name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* POD Viewer Modal */}
      {selectedPOD && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                POD - Bill #{selectedPOD.billNo}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload(selectedPOD)}
                  className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedPOD(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* POD Details */}
            <div className="bg-gray-50 p-4 rounded-md mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Bill Number:</span>
                  <span className="ml-2 font-medium">{selectedPOD.billNo}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Party Name:</span>
                  <span className="ml-2 font-medium">{selectedPOD.partyName}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">File Name:</span>
                  <span className="ml-2 font-medium">{selectedPOD.fileName}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Upload Date:</span>
                  <span className="ml-2 font-medium">{formatDate(selectedPOD.uploadDate)}</span>
                </div>
              </div>
            </div>

            {/* POD Preview */}
            <div className="border border-gray-200 rounded-md p-4">
              {selectedPOD.fileName.toLowerCase().includes('.pdf') ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">PDF Preview</div>
                  <iframe
                    src={selectedPOD.fileUrl}
                    className="w-full h-96 border border-gray-300 rounded"
                    title="POD Preview"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <img
                    src={selectedPOD.fileUrl}
                    alt="POD Document"
                    className="max-w-full h-auto mx-auto rounded border border-gray-300"
                    style={{ maxHeight: '500px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PODs List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-4 text-sm font-medium text-gray-500">
            <div>Bill Number</div>
            <div>Party Name</div>
            <div>File Name</div>
            <div>Upload Date</div>
            <div>Actions</div>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredPODs
            .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
            .map((pod) => (
            <li key={pod.id}>
              <div className="px-4 py-4 hover:bg-gray-50">
                <div className="grid grid-cols-5 gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Bill #{pod.billNo}
                    </p>
                  </div>
                  <div className="text-sm text-gray-900">
                    {pod.partyName}
                  </div>
                  <div className="text-sm text-gray-900">
                    <div className="truncate max-w-xs" title={pod.fileName}>
                      {pod.fileName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {pod.fileName.toLowerCase().includes('.pdf') ? 'PDF' : 'Image'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-900">
                    {formatDate(pod.uploadDate)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedPOD(pod)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="View POD"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(pod)}
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(pod.id)}
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
        
        {filteredPODs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500">
              {searchTerm ? 'No PODs found matching your search.' : 'No POD documents uploaded yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PODComponent;