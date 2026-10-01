import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { Bell, GlassWater, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

interface CallWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber?: number | null;
  tableId: string;
}

export const CallWaiterModal: React.FC<CallWaiterModalProps> = ({
  isOpen,
  onClose,
  tableNumber,
  tableId,
}) => {
  const [selectedPreset, setSelectedPreset] = useState('General Assistance');
  const [customMessage, setCustomMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const presets = [
    { label: 'Water Refill', icon: GlassWater },
    { label: 'Cutlery & Napkins', icon: Sparkles },
    { label: 'Clean Table', icon: Sparkles },
    { label: 'General Assistance', icon: Bell },
  ];

  const handleSend = async () => {
    setSubmitting(true);
    try {
      const msg = customMessage.trim() ? `${selectedPreset}: ${customMessage.trim()}` : selectedPreset;
      await api.callWaiter(tableId, msg);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1400);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tableNumber ? `Call Waiter to Table #${tableNumber}` : 'Call Waiter Assistance'}
      maxWidth="max-w-sm"
    >
      {success ? (
        <div className="py-8 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
          <h4 className="text-sm font-bold text-stone-900">Staff Alerted!</h4>
          <p className="text-xs text-stone-500">
            A team member is heading {tableNumber ? `to Table #${tableNumber}` : 'to assist you'}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-stone-500">
            Select what you need, and our service staff will attend {tableNumber ? `to Table #${tableNumber}` : 'to you'} immediately.
          </p>

          <div className="grid grid-cols-2 gap-2">
            {presets.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelectedPreset(p.label)}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                  selectedPreset === p.label
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Additional Details (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Need high chair, warm water"
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-hidden focus:border-stone-900"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={submitting}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            <span>RING STAFF BELL</span>
          </button>
        </div>
      )}
    </Modal>
  );
};
