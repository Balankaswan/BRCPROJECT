import React from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Bill, Party, PartyLedger } from '../types';

const DebugLedger: React.FC = () => {
  const [bills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [parties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [partyLedgers] = useLocalStorage<PartyLedger[]>(STORAGE_KEYS.PARTY_LEDGERS, []);

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h2 className="text-lg font-bold mb-4">Debug Ledger Data</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Bills ({bills.length})</h3>
          <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(bills.map(b => ({
              id: b.id,
              billNo: b.billNo,
              partyId: b.partyId,
              partyName: b.partyName,
              balance: b.balance
            })), null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold">Parties ({parties.length})</h3>
          <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(parties.map(p => ({
              id: p.id,
              name: p.name,
              balance: p.balance
            })), null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold">Party Ledgers ({partyLedgers.length})</h3>
          <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(partyLedgers.map(l => ({
              id: l.id,
              partyId: l.partyId,
              partyName: l.partyName,
              entriesCount: l.entries?.length || 0,
              outstandingBalance: l.outstandingBalance
            })), null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugLedger;
