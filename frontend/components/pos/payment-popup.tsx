'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CartItem {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  total?: number;
}

interface PaymentPopupProps {
  open: boolean;
  onClose: () => void;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  customer?: { name?: string; phone?: string } | null;
  items?: CartItem[];
  onConfirm: (method: "cash" | "card" | "mobile" | "tab", amount?: number, change?: number) => Promise<void> | void;
}

const NUMPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0', '.', 'Backspace'],
];

export function PaymentPopup({
  open,
  onClose,
  total,
  subtotal = 0,
  discount = 0,
  tax = 0,
  customer,
  items = [],
  onConfirm,
}: PaymentPopupProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('cash');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [showNumpad, setShowNumpad] = useState(false);

  const handleNumpadClick = (value: string) => {
    if (value === 'Backspace') {
      setReceivedAmount(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!receivedAmount.includes('.')) {
        setReceivedAmount(prev => (prev ? prev + '.' : '0.'));
      }
    } else {
      setReceivedAmount(prev => {
        // Prevent leading zeros
        if (prev === '0' && value !== '.') {
          return value;
        }
        return prev + value;
      });
    }
  };

  const received = receivedAmount ? parseFloat(receivedAmount) : 0;
  const change = Math.max(0, received - total);

  const handleConfirm = () => {
    onConfirm(selectedMethod as "cash" | "card" | "mobile" | "tab", received || undefined, change);
    setSelectedMethod('cash');
    setReceivedAmount('');
    setShowNumpad(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl border border-gray-200 bg-white p-0 shadow-lg max-h-[80vh]">
        <div className="flex h-full max-h-[80vh]">
          {/* Left Column - Transaction Details */}
          <div className="flex-1 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
            {/* Header */}
            <div className="mb-4 sticky top-0 bg-gray-50 pb-2">
              <h2 className="text-lg font-bold text-gray-900">Payment</h2>
            </div>

            {/* Customer Info */}
            {customer && (
              <div className="mb-4 rounded bg-white p-3 text-sm">
                <h3 className="mb-1 font-semibold text-gray-700">Customer</h3>
                <p className="font-medium text-gray-900">{customer.name || 'Walk-in'}</p>
              </div>
            )}

            {/* Items Bought */}
            {items.length > 0 && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Items</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center justify-between rounded bg-white p-2 text-xs">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 line-clamp-1">{item.name}</p>
                        <p className="text-gray-600">{item.quantity}x MWK {item.price.toLocaleString()}</p>
                      </div>
                      <p className="font-semibold text-gray-900 ml-2">MWK {((item.total || item.price * item.quantity)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Summary */}
            <div className="space-y-2 rounded bg-white p-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">MWK {subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">-MWK {discount.toLocaleString()}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium text-gray-900">+MWK {tax.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-900 text-sm">Total:</span>
                  <span className="text-lg font-bold text-emerald-600">MWK {total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Payment Method & Keyboard */}
          <div className="flex-1 p-4 flex flex-col">
            {/* Payment Method */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-700">Payment Method</label>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger className="w-full border-gray-300 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                  <SelectItem value="tab">Tab/Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Received Amount */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-700">Amount Received</label>
              <div className="rounded border border-gray-300 bg-white p-2">
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border-0 bg-transparent text-right text-xl font-bold text-gray-900 outline-none"
                />
              </div>
            </div>

            {/* Change Due */}
            <div className="mb-4 rounded bg-emerald-50 p-3">
              <div className="text-xs text-gray-600">Change Due</div>
              <div className="text-lg font-bold text-emerald-600">MWK {change.toLocaleString()}</div>
            </div>

            {/* Numeric Keypad - Compact */}
            {showNumpad && (
              <div className="mb-4 grid grid-cols-3 gap-1">
                {NUMPAD.map((row, rowIdx) => (
                  <div key={rowIdx} className="contents">
                    {row.map(btn => (
                      <button
                        key={btn}
                        onClick={() => handleNumpadClick(btn)}
                        className={`py-2 px-1 text-sm font-semibold transition-colors rounded ${
                          btn === 'Backspace'
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                        }`}
                      >
                        {btn === 'Backspace' ? '⌫' : btn}
                      </button>
                    ))}
                  </div>
                ))}
                <button
                  onClick={() => setReceivedAmount('')}
                  className="col-span-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Toggle Keypad Button */}
            <button
              onClick={() => setShowNumpad(!showNumpad)}
              className="mb-4 w-full text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1"
            >
              {showNumpad ? '▼ Hide Keypad' : '▶ Show Keypad'}
            </button>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-auto">
              <Button
                variant="outline"
                onClick={onClose}
                size="sm"
                className="flex-1 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                Pay Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
