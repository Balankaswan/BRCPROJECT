import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoadingSlip from './components/LoadingSlip';
import Memo from './components/Memo';
import Bills from './components/Bills';
import PaidMemo from './components/PaidMemo';
import ReceivedBills from './components/ReceivedBills';
import Party from './components/Party';
import Supplier from './components/Supplier';
import Banking from './components/Banking';
import Ledgers from './components/Ledgers';
import PODComponent from './components/POD';
import { directSyncManager } from './utils/directSync';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🚀 App starting - setting up auth state listeners');
    
    // Initialize direct sync immediately for LAN usage
    console.log('🚀 Initializing direct sync for LAN...');
    directSyncManager.initialize().then(() => {
      console.log('✅ Direct sync initialized successfully');
      setLoading(false);
    }).catch((error: any) => {
      console.error('❌ Failed to initialize sync:', error);
      setLoading(false);
    });
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Initializing LAN Sync...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/loading-slip" element={<LoadingSlip />} />
          <Route path="/memo" element={<Memo />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/paid-memo" element={<PaidMemo />} />
          <Route path="/received-bills" element={<ReceivedBills />} />
          <Route path="/party" element={<Party />} />
          <Route path="/supplier" element={<Supplier />} />
          <Route path="/banking" element={<Banking />} />
          <Route path="/ledgers" element={<Ledgers />} />
          <Route path="/pod" element={<PODComponent />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;