import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, Receipt, Users, Truck, 
  CreditCard, BookOpen, Image, Menu, X
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Loading Slip', href: '/loading-slip', icon: FileText },
    { name: 'Memo', href: '/memo', icon: Receipt },
    { name: 'Bills', href: '/bills', icon: FileText },
    { name: 'Paid Memo', href: '/paid-memo', icon: Receipt },
    { name: 'Received Bills', href: '/received-bills', icon: FileText },
    { name: 'Party', href: '/party', icon: Users },
    { name: 'Supplier', href: '/supplier', icon: Truck },
    { name: 'Banking', href: '/banking', icon: CreditCard },
    { name: 'Ledgers', href: '/ledgers', icon: BookOpen },
    { name: 'POD', href: '/pod', icon: Image },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent navigation={navigation} currentPath={location.pathname} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent navigation={navigation} currentPath={location.pathname} />
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <h1 className="text-lg font-semibold text-gray-900">
              Bhavishya Road Carriers - Logistics Management
            </h1>
            
            {/* LAN Mode indicator */}
            <div className="flex items-center space-x-2 text-sm text-green-600">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>LAN Mode - Real-time Sync Active</span>
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarContent: React.FC<{ navigation: any[], currentPath: string }> = ({ navigation, currentPath }) => (
  <div className="flex flex-col flex-grow border-r border-gray-200 pt-5 pb-4 bg-white overflow-y-auto">
    <div className="flex items-center flex-shrink-0 px-4">
      <Truck className="h-8 w-8 text-blue-600" />
      <span className="ml-2 text-lg font-bold text-gray-900">BHAVISHYA ROAD CARRIERS</span>
    </div>
    <div className="mt-5 flex-grow flex flex-col">
      <nav className="flex-1 px-2 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon
                className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  </div>
);

export default Layout;