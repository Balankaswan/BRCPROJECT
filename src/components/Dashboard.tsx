import React, { useState } from 'react';
import { TrendingUp, Users, Truck, DollarSign, Calendar } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Bill, Memo } from '../types';
import { formatCurrency, calculateCommission } from '../utils/calculations';

const Dashboard: React.FC = () => {
  const [bills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [memos] = useLocalStorage<Memo[]>(STORAGE_KEYS.MEMOS, []);
  const [paidMemos] = useLocalStorage<Memo[]>(STORAGE_KEYS.PAID_MEMOS, []);
  // Note: We calculate balances directly from bills/memos instead of using party/supplier balance fields
  // to ensure synchronization
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Calculate dashboard metrics
  // Profit = Sum of actual commission amounts from all memos (including paid)
  const allMemos = [...memos, ...paidMemos];
  const totalProfit = allMemos.reduce((sum, memo) => {
    // Use actual commission amount if available, otherwise calculate from freight
    return sum + (memo.commission || calculateCommission(memo.freight, 6));
  }, 0);
  
  // Calculate actual balances from bills and memos
  const totalPartyBalance = bills.reduce((sum, bill) => sum + bill.balance, 0);
  const totalSupplierBalance = memos.reduce((sum, memo) => sum + memo.balance, 0);
  
  // Monthly revenue calculation
  const getMonthlyRevenue = (month: string) => {
    const [year, monthNum] = month.split('-');
    return bills
      .filter(bill => {
        const billDate = new Date(bill.billDate);
        return billDate.getFullYear().toString() === year && 
               (billDate.getMonth() + 1).toString().padStart(2, '0') === monthNum;
      })
      .reduce((sum, bill) => sum + bill.totalFreight, 0);
  };

  const monthlyRevenue = getMonthlyRevenue(selectedMonth);

  const stats = [
    {
      name: 'Total Profit (Actual Commission)',
      value: formatCurrency(totalProfit),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      name: 'Party Balance',
      value: formatCurrency(totalPartyBalance),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      name: 'Supplier Balance',
      value: formatCurrency(totalSupplierBalance),
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      name: 'Monthly Revenue',
      value: formatCurrency(monthlyRevenue),
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bills */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Bills
            </h3>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {bills.slice(0, 5).map((bill) => (
                  <li key={bill.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          Bill #{bill.billNo}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {bill.partyName}
                        </p>
                      </div>
                      <div className="text-sm text-gray-900">
                        {formatCurrency(bill.balance)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Memos */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Memos
            </h3>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {memos.slice(0, 5).map((memo) => (
                  <li key={memo.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          Memo #{memo.memoNo}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {memo.supplierName}
                        </p>
                      </div>
                      <div className="text-sm text-gray-900">
                        {formatCurrency(memo.balance)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;