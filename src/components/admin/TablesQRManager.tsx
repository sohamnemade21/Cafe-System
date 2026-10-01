import React, { useState } from 'react';
import { Cafe, CafeTable } from '../../types';
import { api } from '../../services/api';
import { PrintQRModal } from './PrintQRModal';
import { Modal } from '../common/Modal';
import { Plus, QrCode, Printer, RefreshCw, CheckCircle, ExternalLink, Users, Download } from 'lucide-react';

interface TablesQRManagerProps {
  cafe: Cafe;
  tables: CafeTable[];
  onRefresh: () => void;
  onSelectTableForCustomerView: (tableNumber: number) => void;
}

export const TablesQRManager: React.FC<TablesQRManagerProps> = ({
  cafe,
  tables,
  onRefresh,
  onSelectTableForCustomerView,
}) => {
  const [selectedTableForPrint, setSelectedTableForPrint] = useState<CafeTable | null>(null);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber) return;
    setIsSubmitting(true);
    setAddError(null);

    try {
      await api.addTable(cafe.id, {
        table_number: Number(tableNumber),
        table_name: tableName.trim() || `Table ${tableNumber}`,
        capacity: Number(capacity) || 4,
      });
      setIsAddTableOpen(false);
      setTableNumber('');
      setTableName('');
      onRefresh();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReleaseTable = async (tableId: string) => {
    await api.releaseTable(tableId);
    onRefresh();
  };

  const handleRegenerateQR = async (tableId: string) => {
    await api.regenerateQR(tableId);
    onRefresh();
  };

  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Table & QR Code Management</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {tables.length} Tables Active
            </span>
          </h2>
          <p className="text-xs text-stone-500">
            Generate printable high-resolution QR standees & stickers to place on physical dining tables in {cafe.name}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsBatchPrintOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Print ready-to-cut standees for all tables at once"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Batch Print All Standees</span>
          </button>

          <button
            onClick={() => setIsAddTableOpen(true)}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(table => {
          const isOccupied = table.status === 'OCCUPIED';
          const isBillRequested = table.status === 'BILL_REQUESTED';

          const handleDownloadPNG = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!table.qr_code_url) return;
            const link = document.createElement('a');
            link.download = `${cafe.slug}-Table-${table.table_number}-QR.png`;
            link.href = table.qr_code_url;
            link.click();
          };

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl border p-5 transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                isBillRequested
                  ? 'border-amber-400 ring-2 ring-amber-400/20'
                  : isOccupied
                  ? 'border-stone-300'
                  : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-stone-900">
                        Table {table.table_number}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          isBillRequested
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : isOccupied
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {table.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{table.table_name}</p>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-stone-400 font-medium">
                    <Users className="w-3.5 h-3.5" />
                    <span>{table.capacity} seats</span>
                  </div>
                </div>

                {/* QR Preview Box */}
                <div className="my-4 p-3.5 bg-[#FAF8F5] border border-stone-200 rounded-xl flex items-center gap-3.5">
                  {table.qr_code_url ? (
                    <div className="relative group/qr shrink-0">
                      <img
                        src={table.qr_code_url}
                        alt={`Table ${table.table_number} QR`}
                        className="w-20 h-20 rounded-xl bg-white p-1.5 border border-stone-300 shadow-xs cursor-pointer hover:border-stone-900 transition-colors"
                        onClick={() => setSelectedTableForPrint(table)}
                        title="Click to view full standee & print preview"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
                      <QrCode className="w-8 h-8" />
                    </div>
                  )}

                  <div className="text-xs space-y-1.5 min-w-0 flex-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-stone-900 truncate text-[11px]">
                        /?mode=customer&table={table.table_number}
                      </p>
                      <p className="text-[10px] text-stone-500">
                        Scan sends diner directly to Table #{table.table_number} ordering menu
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => onSelectTableForCustomerView(table.table_number)}
                        className="text-amber-800 hover:text-amber-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer underline"
                        title="Simulate diner phone camera scan"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Simulate Scan</span>
                      </button>

                      {table.qr_code_url && (
                        <button
                          onClick={handleDownloadPNG}
                          className="text-stone-600 hover:text-stone-900 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Download standalone PNG for table sticker"
                        >
                          <Download className="w-3 h-3" />
                          <span>PNG</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center gap-2">
                <button
                  onClick={() => setSelectedTableForPrint(table)}
                  className="flex-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Standee Card</span>
                </button>

                {isOccupied || isBillRequested ? (
                  <button
                    onClick={() => handleReleaseTable(table.id)}
                    title="Mark Table as Free"
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRegenerateQR(table.id)}
                    title="Regenerate QR Code"
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Table Modal */}
      <Modal isOpen={isAddTableOpen} onClose={() => setIsAddTableOpen(false)} title="Add Dining Table" maxWidth="max-w-md">
        <form onSubmit={handleAddTable} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Table Number</label>
            <input
              type="number"
              required
              min={1}
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              placeholder="e.g. 7"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Table Name / Zone</label>
            <input
              type="text"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder="e.g. Table 7 - Rooftop Garden"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">Seating Capacity</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          {addError && (
            <p className="text-xs text-rose-600 font-medium">{addError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-60"
          >
            {isSubmitting ? 'Creating & Generating QR...' : 'Create Table & Generate QR'}
          </button>
        </form>
      </Modal>

      {/* Print Standee Modal (Single & Batch) */}
      <PrintQRModal
        isOpen={Boolean(selectedTableForPrint) || isBatchPrintOpen}
        onClose={() => {
          setSelectedTableForPrint(null);
          setIsBatchPrintOpen(false);
        }}
        table={selectedTableForPrint}
        allTables={tables}
        cafe={cafe}
      />
    </div>
  );
};
