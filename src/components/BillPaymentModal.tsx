import React, { useState, useEffect } from 'react';
import { X, Calculator, Check, AlertTriangle } from 'lucide-react';
import { Bill, BillPayment, PartyLedgerEntry } from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import { processBillPayment, PaymentFormData, isBillFullyPaid } from '../utils/paymentProcessing';
import DateInput from './DateInput';

interface BillPaymentModalProps {
  bill: Bill | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentProcessed: (payment: BillPayment, updatedBill: Bill, ledgerEntry: PartyLedgerEntry) => void;
}

const BillPaymentModal: React.FC<BillPaymentModalProps> = ({
  bill,
  isOpen,
  onClose,
  onPaymentProcessed,
}) => {
  const [formData, setFormData] = useState<PaymentFormData>({
    paymentDate: new Date().toISOString().split('T')[0],
    receivedAmount: 0,
    deductions: {
      tdsDeduction: 0,
      mamul: 0,
      paymentCharges: 0,
      commissionDeduction: 0,
      otherDeduction: 0,
    },
    paymentMethod: '',
    reference: '',
    remarks: '',
  });

  const [autoCalculate, setAutoCalculate] = useState(true);
  const [showDeductionBreakdown, setShowDeductionBreakdown] = useState(false);

  useEffect(() => {
    if (isOpen && bill) {
      // Reset form when modal opens
      setFormData({
        paymentDate: new Date().toISOString().split('T')[0],
        receivedAmount: bill.balance,
        deductions: {
          tdsDeduction: 0,
          mamul: 0,
          paymentCharges: 0,
          commissionDeduction: 0,
          otherDeduction: 0,
        },
        paymentMethod: '',
        reference: '',
        remarks: '',
      });
      setAutoCalculate(true);
      setShowDeductionBreakdown(false);
    }
  }, [isOpen, bill?.balance]);

  const totalDeductions = Object.values(formData.deductions).reduce((sum, deduction) => sum + deduction, 0);
  const differenceAmount = bill ? bill.balance - formData.receivedAmount : 0;
  const remainingBalance = bill ? Math.max(0, bill.balance - formData.receivedAmount - totalDeductions) : 0;
  const isFullyPaid = bill ? isBillFullyPaid(bill.balance, formData.receivedAmount) && totalDeductions === 0 : false;
  const isSettledWithDeductions = remainingBalance === 0 && (totalDeductions > 0 || differenceAmount > 0);

  const handleAutoCalculate = () => {
    if (differenceAmount > 0) {
      // Auto-distribute difference to "Other Deduction"
      setFormData(prev => ({
        ...prev,
        deductions: {
          ...prev.deductions,
          otherDeduction: differenceAmount,
        },
      }));
      setShowDeductionBreakdown(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.receivedAmount < 0) {
      alert('Received amount cannot be negative');
      return;
    }

    if (bill && formData.receivedAmount > bill.balance && totalDeductions === 0) {
      alert('Received amount cannot be greater than bill amount without deductions');
      return;
    }

    if (Object.values(formData.deductions).some(d => d < 0)) {
      alert('Deductions cannot be negative');
      return;
    }

    // Process payment
    if (!bill) return;
    const { payment, updatedBill, ledgerEntry } = processBillPayment(bill, formData);
    onPaymentProcessed(payment, updatedBill, ledgerEntry);
    onClose();
  };

  if (!isOpen || !bill) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Process Payment - Bill #{bill.billNo}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Bill Summary */}
          <div className="mb-6 bg-gray-50 border rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Bill Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Party Name</label>
                <div className="text-sm text-gray-900">{bill.partyName}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bill Date</label>
                <div className="text-sm text-gray-900">{formatDate(bill.billDate)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bill Amount</label>
                <div className="text-lg font-semibold text-gray-900">{formatCurrency(bill.balance)}</div>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payment Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DateInput
                label="Payment Date"
                value={formData.paymentDate}
                onChange={(value) => setFormData(prev => ({ ...prev, paymentDate: value }))}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.receivedAmount}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    receivedAmount: parseFloat(e.target.value) || 0 
                  }))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-3">Payment Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Bill Amount:</span>
                  <span className="ml-2 font-medium">{formatCurrency(bill.balance)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Received Amount:</span>
                  <span className="ml-2 font-medium text-green-600">{formatCurrency(formData.receivedAmount)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Difference:</span>
                  <span className={`ml-2 font-medium ${differenceAmount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {formatCurrency(Math.abs(differenceAmount))}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Deductions:</span>
                  <span className="ml-2 font-medium text-red-600">{formatCurrency(totalDeductions)}</span>
                </div>
              </div>
              
              {differenceAmount > 0 && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-orange-800 text-sm">
                      Difference of {formatCurrency(differenceAmount)} needs to be allocated to deductions
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoCalculate}
                      className="text-orange-600 hover:text-orange-800 text-sm underline"
                    >
                      Auto-allocate
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Deduction Breakdown */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">Deduction Breakdown</h3>
                <button
                  type="button"
                  onClick={() => setShowDeductionBreakdown(!showDeductionBreakdown)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {showDeductionBreakdown ? 'Hide' : 'Show'} Breakdown
                </button>
              </div>

              {showDeductionBreakdown && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TDS Deduction</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions.tdsDeduction}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        deductions: { 
                          ...prev.deductions, 
                          tdsDeduction: parseFloat(e.target.value) || 0 
                        }
                      }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mamul</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions.mamul}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        deductions: { 
                          ...prev.deductions, 
                          mamul: parseFloat(e.target.value) || 0 
                        }
                      }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Charges</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions.paymentCharges}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        deductions: { 
                          ...prev.deductions, 
                          paymentCharges: parseFloat(e.target.value) || 0 
                        }
                      }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commission Deduction</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions.commissionDeduction}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        deductions: { 
                          ...prev.deductions, 
                          commissionDeduction: parseFloat(e.target.value) || 0 
                        }
                      }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other Deduction</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions.otherDeduction}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        deductions: { 
                          ...prev.deductions, 
                          otherDeduction: parseFloat(e.target.value) || 0 
                        }
                      }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Transaction ID, Cheque No., etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Final Status */}
            <div className="bg-gray-50 border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                {isFullyPaid ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : isSettledWithDeductions ? (
                  <Calculator className="h-5 w-5 text-orange-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium text-gray-900">
                  Final Status: {
                    isFullyPaid ? 'Fully Paid' :
                    isSettledWithDeductions ? 'Settled with Deductions' :
                    'Partial Payment'
                  }
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Remaining Balance: <span className="font-medium">{formatCurrency(remainingBalance)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Process Payment
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BillPaymentModal;
