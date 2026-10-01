import React, { useState } from 'react';
import { Cafe, Order } from '../../types';
import { api } from '../../services/api';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { Clock, Download, ChevronRight, Eye } from 'lucide-react';
import { Modal } from '../common/Modal';

interface LiveOrdersViewProps {
  cafe: Cafe;
  orders: Order[];
  onRefresh: () => void;
}

export const LiveOrdersView: React.FC<LiveOrdersViewProps> = ({
  cafe,
  orders,
  onRefresh,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'ALL') return true;
    return o.order_status === statusFilter;
  });

  const handleUpdateStatus = async (orderId: string, status: string) => {
    await api.updateOrderStatus(orderId, status);
    onRefresh();
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, order_status: status as any } : null);
    }
  };

  const handleDownloadInvoice = async (ord: Order) => {
    const doc = await generateInvoicePDF(ord, cafe);
    doc.save(`Invoice_${cafe.slug}_Order_${ord.id.slice(-6)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Live Dine-In Orders Stream
          </h2>
          <p className="text-xs text-stone-500">
            Real-time feed of all table orders, payment verification status, and kitchen fulfillment.
          </p>
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Table</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Kitchen Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-stone-400">
                    No orders matching filter
                  </td>
                </tr>
              ) : (
                filteredOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-stone-900">
                      #{ord.id.slice(-6)}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-amber-800">
                      Table {ord.table_number}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-stone-800">{ord.customer_name || 'Guest'}</div>
                      <div className="text-[10px] text-stone-400">{ord.customer_email || 'No email'}</div>
                    </td>

                    <td className="px-5 py-3.5 text-stone-600 max-w-xs truncate">
                      {ord.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}
                    </td>

                    <td className="px-5 py-3.5 font-extrabold text-stone-900">
                      {cafe.currency}{ord.total.toFixed(2)}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {ord.payment_status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                          ord.order_status === 'SERVED' || ord.order_status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ord.order_status === 'READY'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : ord.order_status === 'PREPARING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {ord.order_status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="View Order Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadInvoice(ord)}
                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                        title="Download Invoice PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <Modal isOpen={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} title={`Order #${selectedOrder?.id.slice(-6)} Details`} maxWidth="max-w-md">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div>
                <span className="text-xs text-stone-500 font-medium">Table</span>
                <div className="text-sm font-bold text-stone-900">Table {selectedOrder.table_number}</div>
              </div>
              <div>
                <span className="text-xs text-stone-500 font-medium">Diner</span>
                <div className="text-sm font-bold text-stone-900">{selectedOrder.customer_name}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-stone-500 font-medium">Total</span>
                <div className="text-sm font-extrabold text-stone-900">{cafe.currency}{selectedOrder.total.toFixed(2)}</div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide">Ordered Items</h4>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl p-3 bg-white">
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between text-xs">
                    <div>
                      <span className="font-bold">{it.quantity}x</span> {it.item_name}
                      {it.selected_variants_json && it.selected_variants_json.length > 0 && (
                        <p className="text-[11px] text-stone-400">
                          {it.selected_variants_json.map((v: any) => v.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold">{cafe.currency}{it.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Status Changers */}
            <div className="pt-2 border-t border-stone-100">
              <label className="block text-xs font-bold text-stone-800 mb-2">Change Order Status</label>
              <div className="grid grid-cols-3 gap-2">
                {['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                    className={`py-2 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      selectedOrder.order_status === s
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleDownloadInvoice(selectedOrder)}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Tax Invoice PDF</span>
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
