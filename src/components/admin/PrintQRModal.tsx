import React, { useState } from 'react';
import { CafeTable, Cafe } from '../../types';
import { Modal } from '../common/Modal';
import { Printer, Download, QrCode, Sparkles, Smartphone, Utensils, CreditCard, Layers } from 'lucide-react';

interface PrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: CafeTable | null;
  allTables?: CafeTable[];
  cafe: Cafe;
}

export const PrintQRModal: React.FC<PrintQRModalProps> = ({
  isOpen,
  onClose,
  table,
  allTables = [],
  cafe,
}) => {
  const [format, setFormat] = useState<'standee' | 'sticker'>('standee');
  const [printMode, setPrintMode] = useState<'single' | 'batch'>('single');

  if (!isOpen) return null;

  const targetTables = printMode === 'batch' && allTables.length > 0 
    ? allTables 
    : (table ? [table] : (allTables.length > 0 ? [allTables[0]] : []));

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (tbl: CafeTable) => {
    if (!tbl.qr_code_url) return;
    const link = document.createElement('a');
    link.download = `${cafe.slug}-Table-${tbl.table_number}-QR.png`;
    link.href = tbl.qr_code_url;
    link.click();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={printMode === 'batch' ? `Batch Print Table QR Standees (${targetTables.length} Tables)` : `Table ${targetTables[0]?.table_number || ''} QR Standee`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Format & Mode Controls (hidden when printing) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-100 rounded-2xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-600">Print Mode:</span>
            <div className="bg-white p-0.5 rounded-xl border border-stone-200 flex text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintMode('single')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  printMode === 'single' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Single Table
              </button>
              {allTables.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPrintMode('batch')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    printMode === 'batch' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>All Tables ({allTables.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-600">Style:</span>
            <div className="bg-white p-0.5 rounded-xl border border-stone-200 flex text-xs font-bold">
              <button
                type="button"
                onClick={() => setFormat('standee')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  format === 'standee' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                4"x6" Standee
              </button>
              <button
                type="button"
                onClick={() => setFormat('sticker')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  format === 'sticker' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                3"x3" Sticker
              </button>
            </div>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="printable-area max-h-[60vh] overflow-y-auto p-2 space-y-6">
          {targetTables.map((tbl, idx) => (
            <div key={tbl.id} className="relative group page-break-after">
              {format === 'standee' ? (
                /* Premium 4"x6" Acrylic Standee Layout */
                <div className="bg-[#FAF8F5] border-2 border-stone-800 rounded-3xl p-6 text-center shadow-lg space-y-4 max-w-sm mx-auto relative overflow-hidden">
                  {/* Crop / Cut markers */}
                  <div className="absolute top-2 left-2 text-[10px] text-stone-300 font-mono select-none">+</div>
                  <div className="absolute top-2 right-2 text-[10px] text-stone-300 font-mono select-none">+</div>
                  <div className="absolute bottom-2 left-2 text-[10px] text-stone-300 font-mono select-none">+</div>
                  <div className="absolute bottom-2 right-2 text-[10px] text-stone-300 font-mono select-none">+</div>

                  {/* Brand Header */}
                  <div className="space-y-1">
                    {cafe.logo_url && (
                      <img
                        src={cafe.logo_url}
                        alt={cafe.name}
                        className="w-12 h-12 rounded-2xl mx-auto object-cover border border-stone-200 shadow-xs"
                      />
                    )}
                    <h2 className="text-lg font-black text-stone-900 tracking-tight">{cafe.name}</h2>
                    <p className="text-[11px] text-stone-500 font-medium">{cafe.tag_line || 'Artisan Roastery & Kitchen'}</p>
                  </div>

                  {/* Table Badge */}
                  <div className="bg-stone-900 text-amber-100 py-1.5 px-5 rounded-xl inline-flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-widest">
                      TABLE #{tbl.table_number}
                    </span>
                  </div>

                  {/* High-Resolution QR Code Container */}
                  <div className="p-3.5 bg-white border-2 border-stone-200 rounded-2xl inline-block shadow-sm">
                    {tbl.qr_code_url ? (
                      <img
                        src={tbl.qr_code_url}
                        alt={`Scan QR Code for Table ${tbl.table_number}`}
                        className="w-48 h-48 mx-auto"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-stone-400">
                        <QrCode className="w-12 h-12" />
                      </div>
                    )}
                  </div>

                  {/* 3-Step Scan Instructions */}
                  <div className="bg-white/80 border border-stone-200 rounded-xl p-3 text-left space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-stone-800">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                        <Smartphone className="w-3 h-3" />
                      </div>
                      <span>1. Scan with your phone camera</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-stone-800">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                        <Utensils className="w-3 h-3" />
                      </div>
                      <span>2. Browse menu & customize order</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-stone-800">
                      <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                        <CreditCard className="w-3 h-3" />
                      </div>
                      <span>3. Instant UPI / Card pay or Pay at Counter</span>
                    </div>
                  </div>

                  {/* Footer Wi-Fi & Support info */}
                  <div className="pt-2 border-t border-stone-200 flex items-center justify-center gap-2 text-[10px] text-stone-500 font-medium">
                    <span>Wi-Fi: <strong className="text-stone-800">{cafe.slug}-Guest</strong></span>
                    <span>·</span>
                    <span>No App Download Required</span>
                  </div>
                </div>
              ) : (
                /* Compact 3"x3" Table Sticker Layout */
                <div className="bg-white border-2 border-stone-900 rounded-2xl p-4 text-center shadow-md space-y-2.5 max-w-[240px] mx-auto relative">
                  <div className="flex items-center justify-between text-[11px] font-black text-stone-900 border-b border-stone-200 pb-1.5">
                    <span className="truncate max-w-[120px]">{cafe.name}</span>
                    <span className="bg-stone-900 text-white px-2 py-0.5 rounded text-[10px]">T-{tbl.table_number}</span>
                  </div>

                  <div className="p-2 bg-stone-50 border border-stone-200 rounded-xl inline-block">
                    {tbl.qr_code_url ? (
                      <img
                        src={tbl.qr_code_url}
                        alt={`QR code for Table ${tbl.table_number}`}
                        className="w-32 h-32 mx-auto"
                      />
                    ) : (
                      <QrCode className="w-12 h-12 text-stone-400 mx-auto" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-[11px] font-black text-stone-900 uppercase">SCAN TO ORDER & PAY</p>
                    <p className="text-[9px] text-stone-500">Camera / Google Lens / UPI</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons (hidden during actual window.print) */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-200 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Print {printMode === 'batch' ? `All (${targetTables.length}) Standees` : `Table #${targetTables[0]?.table_number} Standee`}</span>
          </button>

          {targetTables.length === 1 && (
            <button
              onClick={() => handleDownload(targetTables[0])}
              className="py-3 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
