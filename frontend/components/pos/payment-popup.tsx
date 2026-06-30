'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type PaymentMethod =
  | "cash"
  | "airtel"
  | "tnm"
  | "first_capital_bank"
  | "national_bank"
  | "standard_bank"
  | "tab"
  | "other"
  | "mixed";

interface PaymentLine {
  payment_method: Exclude<PaymentMethod, "mixed">;
  amount: number;
  change?: number;
  other_payment_method_name?: string;
}

interface PaymentPopupProps {
  open: boolean;
  onClose?: () => void;
  onDismiss?: () => void;
  onCancel?: () => void;
  blockOutsideClose?: boolean;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  customer?: { name?: string; phone?: string } | null;
  items?: CartItem[];
  onConfirm: (
    method: PaymentMethod,
    amount?: number,
    change?: number,
    options?: { payment_lines?: PaymentLine[]; other_payment_method_name?: string }
  ) => Promise<void> | void;
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
  onDismiss,
  onCancel,
  blockOutsideClose = false,
  total,
  subtotal = 0,
  discount = 0,
  tax = 0,
  customer,
  items = [],
  onConfirm,
}: PaymentPopupProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [otherPaymentMethodName, setOtherPaymentMethodName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paidAmount = paymentLines.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = Math.max(0, total - paidAmount);

  useEffect(() => {
    if (!open) return;
    setSelectedMethod('cash');
    setReceivedAmount('');
    setPaymentLines([]);
    setOtherPaymentMethodName('');
    setIsSubmitting(false);
  }, [open]);

  const resetForm = () => {
    setPaymentLines([]);
    setSelectedMethod('cash');
    setReceivedAmount('');
    setOtherPaymentMethodName('');
  };

  const handleMethodChange = (value: string) => {
    setSelectedMethod(value as PaymentMethod);
  };

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
  const change = selectedMethod === 'cash' ? Math.max(0, received - remainingAmount) : 0;

  const canAddLine = () => {
    if (!selectedMethod || selectedMethod === 'mixed') return false
    const amountNum = parseFloat(receivedAmount) || 0
    if (amountNum <= 0) return false
    if (amountNum > remainingAmount) return false
    if (selectedMethod === 'other') {
      return Boolean(otherPaymentMethodName.trim())
    }
    return true
  }

  const canCompleteWithCurrentEntry = () => {
    if (remainingAmount <= 0) return false
    if (!selectedMethod || selectedMethod === 'mixed') return false
    if (received <= 0) return false
    if (received < remainingAmount) return false
    if (selectedMethod !== 'cash' && received > remainingAmount + 0.001) return false
    if (selectedMethod === 'other' && !otherPaymentMethodName.trim()) return false
    return true
  }

  const canConfirm = () => {
    if (isSubmitting) return false
    if (paymentLines.length > 0 && remainingAmount === 0) return true
    return canCompleteWithCurrentEntry()
  }

  const removePaymentLine = (index: number) => {
    setPaymentLines((current) => current.filter((_, idx) => idx !== index))
  }

  const addPaymentLine = () => {
    if (!canAddLine()) return
    const line: PaymentLine = {
      payment_method: selectedMethod as Exclude<PaymentMethod, 'mixed'>,
      amount: received,
    }
    if (selectedMethod === 'other') {
      line.other_payment_method_name = otherPaymentMethodName.trim()
    }
    setPaymentLines((current) => [...current, line])
    setReceivedAmount('')
    setOtherPaymentMethodName('')
    setSelectedMethod('cash')
  }

  const handleConfirm = async () => {
    if (!canConfirm()) return

    let lines = [...paymentLines]
    let confirmChange = 0

    if (remainingAmount > 0) {
      if (!canCompleteWithCurrentEntry()) return

      confirmChange = selectedMethod === 'cash' ? Math.max(0, received - remainingAmount) : 0

      const line: PaymentLine = {
        payment_method: selectedMethod as Exclude<PaymentMethod, 'mixed'>,
        amount: remainingAmount,
      }
      if (selectedMethod === 'other') {
        line.other_payment_method_name = otherPaymentMethodName.trim()
      }
      lines.push(line)
    }

    const lineTotal = lines.reduce((sum, line) => sum + line.amount, 0)
    const method = lines.length > 1 ? 'mixed' : (lines[0]?.payment_method || selectedMethod)
    const options = lines.length > 1
      ? { payment_lines: lines }
      : {
          payment_lines: lines.length === 1 ? lines : undefined,
          other_payment_method_name: lines[0]?.other_payment_method_name,
        }

    setIsSubmitting(true)
    try {
      await onConfirm(method, lineTotal, confirmChange, options)
      resetForm()
      if (onClose) {
        onClose()
      } else {
        handleDismiss()
      }
    } finally {
      setIsSubmitting(false)
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
      return;
    }
    if (onClose) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleDismiss();
        }
      }}
    >
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-2xl border border-gray-200 bg-white p-0 shadow-lg max-h-[90vh] overflow-hidden"
        showCloseButton={false}
        onPointerDownOutside={(event) => {
          if (blockOutsideClose) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (blockOutsideClose) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Payment</DialogTitle>
          <DialogDescription>Review items and complete checkout with your selected payment method.</DialogDescription>
        </DialogHeader>
        <div className="flex h-full max-h-[90vh] flex-col md:max-h-[80vh] md:flex-row">
          {/* Left Column - Transaction Details */}
          <div className="flex-1 border-b border-gray-200 bg-gray-50 p-4 overflow-y-auto md:border-b-0 md:border-r">
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
          <div className="flex-1 p-4 flex flex-col overflow-y-auto">
            {/* Payment Method */}
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold text-gray-700">Payment Method</label>
              <Select value={selectedMethod} onValueChange={handleMethodChange}>
                <SelectTrigger className="w-full border-gray-300 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="airtel">Airtel Money</SelectItem>
                <SelectItem value="tnm">TNM Money</SelectItem>
                <SelectItem value="first_capital_bank">First Capital Bank</SelectItem>
                <SelectItem value="national_bank">National Bank</SelectItem>
                <SelectItem value="standard_bank">Standard Bank</SelectItem>
                <SelectItem value="tab">Tab/Credit</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Lines */}
            {paymentLines.length > 0 && (
              <div className="mb-4 rounded border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Payment Breakdown</span>
                  <span className="text-xs text-muted-foreground">Remaining MWK {remainingAmount.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  {paymentLines.map((line, idx) => (
                    <div key={`${line.payment_method}-${idx}`} className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm">
                      <div>
                        <div className="font-medium text-gray-900">
                          {line.payment_method === 'other'
                            ? line.other_payment_method_name || 'Other'
                            : line.payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </div>
                        {line.payment_method === 'other' && line.other_payment_method_name && (
                          <div className="text-xs text-gray-500">{line.other_payment_method_name}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900">MWK {line.amount.toLocaleString()}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePaymentLine(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Custom name for Other */}
            {selectedMethod === 'other' && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-semibold text-gray-700">Other Payment Method Name</label>
                <input
                  type="text"
                  value={otherPaymentMethodName}
                  onChange={(e) => setOtherPaymentMethodName(e.target.value)}
                  placeholder="e.g. PayPal, Bank Deposit"
                  className="w-full rounded border border-gray-300 bg-white p-2 text-sm outline-none"
                />
              </div>
            )}

            {/* Change Due */}
            {selectedMethod === 'cash' && (
              <div className="mb-4 rounded bg-emerald-50 p-3">
                <div className="text-xs text-gray-600">Change Due</div>
                <div className="text-lg font-bold text-emerald-600">MWK {change.toLocaleString()}</div>
                {remainingAmount > 0 && received >= remainingAmount && change > 0 && (
                  <div className="mt-1 text-xs text-emerald-700">
                    Tendered MWK {received.toLocaleString()} for MWK {remainingAmount.toLocaleString()} due
                  </div>
                )}
              </div>
            )}

            {/* Numeric Keypad - Compact */}
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

            {/* Action Buttons */}
            <div className="flex gap-2 mt-auto">
              <Button
                variant="outline"
                onClick={handleCancel}
                size="sm"
                className="flex-1 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={addPaymentLine}
                size="sm"
                disabled={!canAddLine()}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white text-sm"
              >
                Add Payment
              </Button>
              <Button
                onClick={handleConfirm}
                size="sm"
                disabled={!canConfirm()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Sale'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
