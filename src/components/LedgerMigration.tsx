import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Database, FileText } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../utils/storage';
import { Bill, PartyLedger, Party } from '../types';
import { 
  migrateExistingBillsToLedger, 
  checkMigrationNeeded, 
  validateLedgerIntegrity,
  generateMigrationReport,
  MigrationResult 
} from '../utils/ledgerMigration';

interface LedgerMigrationProps {
  onMigrationComplete?: () => void;
  autoMigrate?: boolean;
}

const LedgerMigration: React.FC<LedgerMigrationProps> = ({ onMigrationComplete, autoMigrate = false }) => {
  const [bills] = useLocalStorage<Bill[]>(STORAGE_KEYS.BILLS, []);
  const [receivedBills] = useLocalStorage<Bill[]>(STORAGE_KEYS.RECEIVED_BILLS, []);
  const [parties] = useLocalStorage<Party[]>(STORAGE_KEYS.PARTIES, []);
  const [partyLedgers, setPartyLedgers] = useLocalStorage<PartyLedger[]>(STORAGE_KEYS.PARTY_LEDGERS, []);
  
  const [migrationNeeded, setMigrationNeeded] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateLedgerIntegrity> | null>(null);

  // Check if migration is needed on component mount
  useEffect(() => {
    const checkMigration = () => {
      const allBills = [...bills, ...receivedBills];
      const needed = checkMigrationNeeded(allBills, partyLedgers);
      setMigrationNeeded(needed);

      // Auto-migrate if requested and bills need migration
      if (autoMigrate && needed > 0) {
        handleMigrate();
      }
    };

    checkMigration();
  }, [bills, receivedBills, partyLedgers, autoMigrate]);

  const handleMigrate = async () => {
    setIsLoading(true);
    setMigrationResult(null);
    setValidationResult(null);

    try {
      const allBills = [...bills, ...receivedBills];
      
      // Perform migration
      const { updatedLedgers, migrationResult } = migrateExistingBillsToLedger(
        allBills,
        partyLedgers,
        parties
      );

      // Update party ledgers
      setPartyLedgers(updatedLedgers);

      // Validate the migration results
      const validation = validateLedgerIntegrity(updatedLedgers, allBills);

      setMigrationResult(migrationResult);
      setValidationResult(validation);
      setShowReport(true);

      // Update migration needed count
      const stillNeeded = checkMigrationNeeded(allBills, updatedLedgers);
      setMigrationNeeded(stillNeeded);

      // Call completion callback
      if (onMigrationComplete) {
        onMigrationComplete();
      }

    } catch (error) {
      console.error('Migration failed:', error);
      const errorResult: MigrationResult = {
        totalBillsMigrated: 0,
        partiesUpdated: [],
        errors: [error instanceof Error ? error.message : 'Unknown migration error']
      };
      setMigrationResult(errorResult);
      setShowReport(true);
    }

    setIsLoading(false);
  };

  const handleValidateOnly = () => {
    setIsLoading(true);
    
    try {
      const allBills = [...bills, ...receivedBills];
      const validation = validateLedgerIntegrity(partyLedgers, allBills);
      setValidationResult(validation);
      setShowReport(true);
    } catch (error) {
      console.error('Validation failed:', error);
    }

    setIsLoading(false);
  };

  // Don't show component if no migration is needed and not in explicit mode
  if (migrationNeeded === 0 && !showReport && !autoMigrate) {
    return null;
  }

  return (
    <div className="bg-white shadow sm:rounded-lg mb-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
              <Database className="h-5 w-5 mr-2 text-blue-500" />
              Party Ledger Migration
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              {migrationNeeded > 0 ? (
                <div className="flex items-center text-yellow-600">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  <span>
                    {migrationNeeded} existing bill{migrationNeeded > 1 ? 's' : ''} need{migrationNeeded === 1 ? 's' : ''} to be linked to party ledgers.
                  </span>
                </div>
              ) : (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span>All bills are properly linked to party ledgers.</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex-shrink-0 sm:flex sm:items-center space-x-2">
            {migrationNeeded > 0 && (
              <button
                type="button"
                onClick={handleMigrate}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Migrating...' : `Migrate ${migrationNeeded} Bills`}
              </button>
            )}
            
            <button
              type="button"
              onClick={handleValidateOnly}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate Ledgers
            </button>
          </div>
        </div>

        {/* Migration Progress */}
        {isLoading && (
          <div className="mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center">
                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">Processing Migration</h4>
                  <p className="text-sm text-blue-700">
                    Linking existing bills to party ledgers using double-entry accounting...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Migration Results */}
        {showReport && (migrationResult || validationResult) && (
          <div className="mt-4">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Migration Report</h4>
                  
                  {migrationResult && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-green-600">{migrationResult.totalBillsMigrated}</div>
                        <div className="text-sm text-gray-600">Bills Migrated</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-blue-600">{migrationResult.partiesUpdated.length}</div>
                        <div className="text-sm text-gray-600">Parties Updated</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-red-600">{migrationResult.errors.length}</div>
                        <div className="text-sm text-gray-600">Errors</div>
                      </div>
                    </div>
                  )}

                  {validationResult && (
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        {validationResult.isValid ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                        )}
                        <span className={`font-medium ${validationResult.isValid ? 'text-green-700' : 'text-yellow-700'}`}>
                          {validationResult.isValid ? 'Ledger data is valid' : `${validationResult.issues.length} issues found`}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 grid grid-cols-2 md:grid-cols-5 gap-2">
                        <div>Ledgers: {validationResult.summary.totalLedgers}</div>
                        <div>Total Entries: {validationResult.summary.totalEntries}</div>
                        <div>Bills: {validationResult.summary.billEntries}</div>
                        <div>Payments: {validationResult.summary.paymentEntries}</div>
                        <div>Advances: {validationResult.summary.advanceEntries}</div>
                      </div>
                    </div>
                  )}

                  {/* Error Details */}
                  {migrationResult && migrationResult.errors.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-sm font-medium text-red-700 mb-1">Errors:</h5>
                      <ul className="text-sm text-red-600 space-y-1">
                        {migrationResult.errors.map((error, index) => (
                          <li key={index} className="break-words">• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Validation Issues */}
                  {validationResult && validationResult.issues.length > 0 && (
                    <div className="mt-3">
                      <h5 className="text-sm font-medium text-yellow-700 mb-1">Issues:</h5>
                      <ul className="text-sm text-yellow-600 space-y-1">
                        {validationResult.issues.map((issue, index) => (
                          <li key={index} className="break-words">• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowReport(false)}
                  className="ml-4 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {migrationResult && migrationResult.totalBillsMigrated > 0 && migrationNeeded === 0 && (
          <div className="mt-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">Migration Completed Successfully!</h4>
                  <p className="text-sm text-green-700">
                    All existing bills have been linked to party ledgers. You can now view detailed ledger entries 
                    with proper credit/debit accounting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LedgerMigration;
