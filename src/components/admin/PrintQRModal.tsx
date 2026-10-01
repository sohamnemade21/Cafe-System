import React from 'react';
import { CafeTable, Cafe } from '../../types';
import { Modal } from '../common/Modal';
import { Printer, Download, QrCode } from 'lucide-react';

interface PrintQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: CafeTable | null;
  cafe: Cafe;
}

export const PrintQRModal: React.FC<PrintQRModalProps> = ({
  isOpen,
  onClose,
  table,
  cafe,
}) => {
  if (!isOpen || !table) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!table.qr_code_url) return;
    const link = document.createElement('a');
    link.download = `${cafe.slug}-Table-${table.table_number}-QR.png`;
    link.href = table.qr_code_url;
    link.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Table ${table.table_number} QR Standee`} maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Printable Standee Preview */}
        <div className="printable-area bg-white border-2 border-stone-800 rounded-3xl p-6 text-center shadow-xl space-y-4 max-w-sm mx-auto">
          {/* Cafe Header */}
          <div className="space-y-1">
            {cafe.logo_url && (
              <img
                src={cafe.logo_url}
                alt={cafe.name}
                className="w-12 h-12 rounded-2xl mx-auto object-cover border border-stone-200"
              />
            )}
            <h2 className="text-lg font-black text-stone-900 tracking-tight">{cafe.name}</h2>
            <p className="text-[11px] text-stone-500">{cafe.tag_line || 'Dine-In Digital Menu'}</p>
          </div>

          {/* Table Badge */}
          <div className="bg-stone-900 text-white py-1.5 px-4 rounded-xl inline-block shadow-xs">
            <span className="text-xs font-black uppercase tracking-widest">
              TABLE {table.table_number}
            </span>
          </div>

          {/* QR Code Container */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl inline-block shadow-inner">
            {table.qr_code_url ? (
              <img
                src={table.qr_code_url}
                alt={`QR code for Table ${table.table_number}`}
                className="w-48 h-48 mx-auto"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-stone-400">
                <QrCode className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wide">
              Scan with Phone Camera to Order
            </h4>
            <p className="text-[11px] text-stone-500">
              Browse artisan menu · Customize · Pay with UPI/Card
            </p>
          </div>

          {/* Table WiFi & details */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-2 text-[10px] text-stone-400 font-mono">
            <span>Free Guest Wi-Fi: {cafe.slug}-Guest</span>
            <span>·</span>
            <span>No App Download Required</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee Card</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
