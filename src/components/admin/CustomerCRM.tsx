import React, { useState, useEffect } from 'react';
import { Cafe, Customer } from '../../types';
import { api } from '../../services/api';
import { Users, Mail, Phone, ShieldCheck, Check, X, Search } from 'lucide-react';

interface CustomerCRMProps {
  cafe: Cafe;
}

export const CustomerCRM: React.FC<CustomerCRMProps> = ({ cafe }) => {
  const [customers, setCustomers] = useState<(Customer & { marketing?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getCustomers(cafe.id)
      .then(res => setCustomers(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [cafe.id]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">
            Customer Profiles & Marketing CRM
          </h2>
          <p className="text-xs text-stone-500">
            Patron visit frequencies, lifetime spending, and verified GDPR/DPDP marketing consents.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search patrons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-hidden focus:border-stone-900"
          />
        </div>
      </div>

      {/* CRM Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Dine-Ins</th>
                <th className="px-5 py-3">Lifetime Spend</th>
                <th className="px-5 py-3">Marketing Consent</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-400">
                    Loading customer profiles...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-400">
                    No customers found
                  </td>
                </tr>
              ) : (
                filtered.map(cust => (
                  <tr key={cust.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {cust.profile_image ? (
                          <img
                            src={cust.profile_image}
                            alt={cust.name}
                            className="w-8 h-8 rounded-full object-cover border border-stone-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-xs">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-stone-900">{cust.name}</div>
                          <div className="text-[11px] text-stone-400">{cust.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-stone-600 font-mono text-[11px]">
                      {cust.phone || '—'}
                    </td>

                    <td className="px-5 py-3.5 font-bold text-stone-800">
                      {cust.total_orders} visits
                    </td>

                    <td className="px-5 py-3.5 font-extrabold text-stone-900">
                      {cafe.currency}{cust.total_spent.toFixed(2)}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cust.marketing?.email_marketing
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          Email {cust.marketing?.email_marketing ? '✓' : '✗'}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            cust.marketing?.whatsapp_marketing
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          WhatsApp {cust.marketing?.whatsapp_marketing ? '✓' : '✗'}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Patron
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
