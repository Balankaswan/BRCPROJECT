import { Bill, PartyLedger, Party } from '../types';
import { addBillToPartyLedger } from './partyLedgerManager';

/**
 * Migration utility to convert existing bills into proper party ledger entries
 * This function will create credit entries for all existing bills that are not yet linked
 */

export interface MigrationResult {
  totalBillsMigrated: number;
  partiesUpdated: string[];
  errors: string[];
}

/**
 * Migrates existing bills to the new credit/debit party ledger system
 * @param existingBills - Array of existing bills
 * @param existingLedgers - Array of existing party ledgers
 * @param parties - Array of parties for validation
 * @returns Migration result with statistics and any errors
 */
export const migrateExistingBillsToLedger = (
  existingBills: Bill[],
  existingLedgers: PartyLedger[],
  parties: Party[]
): { updatedLedgers: PartyLedger[]; migrationResult: MigrationResult } => {
  const migrationResult: MigrationResult = {
    totalBillsMigrated: 0,
    partiesUpdated: [],
    errors: []
  };

  let updatedLedgers = [...existingLedgers];

  // Process each bill
  for (const bill of existingBills) {
    try {
      // Check if this bill is already linked to a party ledger
      const existingEntry = updatedLedgers.find(ledger => 
        ledger.partyId === bill.partyId &&
        ledger.entries.some(entry => 
          entry.relatedBillId === bill.id && 
          entry.entryType === 'credit' && 
          entry.type === 'bill_created'
        )
      );

      // Skip if bill is already linked
      if (existingEntry) {
        continue;
      }

      // Verify party exists
      const party = parties.find(p => p.id === bill.partyId);
      if (!party) {
        migrationResult.errors.push(`Party not found for bill ${bill.billNo} (Party ID: ${bill.partyId})`);
        continue;
      }

      // Add bill to party ledger using the new credit/debit system
      updatedLedgers = addBillToPartyLedger(updatedLedgers, bill);
      
      migrationResult.totalBillsMigrated++;
      
      // Track unique parties updated
      if (!migrationResult.partiesUpdated.includes(bill.partyId)) {
        migrationResult.partiesUpdated.push(bill.partyId);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      migrationResult.errors.push(`Failed to migrate bill ${bill.billNo}: ${errorMessage}`);
    }
  }

  return { updatedLedgers, migrationResult };
};

/**
 * Checks if migration is needed by looking for bills without corresponding ledger entries
 * @param existingBills - Array of existing bills
 * @param existingLedgers - Array of existing party ledgers
 * @returns Number of bills that need migration
 */
export const checkMigrationNeeded = (
  existingBills: Bill[],
  existingLedgers: PartyLedger[]
): number => {
  let billsNeedingMigration = 0;

  for (const bill of existingBills) {
    const existingEntry = existingLedgers.find(ledger => 
      ledger.partyId === bill.partyId &&
      ledger.entries.some(entry => 
        entry.relatedBillId === bill.id && 
        entry.entryType === 'credit' && 
        entry.type === 'bill_created'
      )
    );

    if (!existingEntry) {
      billsNeedingMigration++;
    }
  }

  return billsNeedingMigration;
};

/**
 * Validates party ledger data integrity after migration
 * @param ledgers - Array of party ledgers to validate
 * @param bills - Array of bills for cross-reference
 * @returns Validation results
 */
export const validateLedgerIntegrity = (
  ledgers: PartyLedger[],
  bills: Bill[]
): {
  isValid: boolean;
  issues: string[];
  summary: {
    totalLedgers: number;
    totalEntries: number;
    billEntries: number;
    paymentEntries: number;
    advanceEntries: number;
  };
} => {
  const issues: string[] = [];
  let totalEntries = 0;
  let billEntries = 0;
  let paymentEntries = 0;
  let advanceEntries = 0;

  for (const ledger of ledgers) {
    // Validate running balance calculation
    let calculatedBalance = 0;
    const sortedEntries = [...ledger.entries].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      
      if (entry.entryType === 'credit') {
        calculatedBalance += entry.amount;
      } else {
        calculatedBalance -= entry.amount;
      }

      // Check if running balance matches calculated balance
      if (Math.abs(entry.runningBalance - calculatedBalance) > 0.01) {
        issues.push(
          `Ledger ${ledger.partyName}: Entry ${entry.id} has incorrect running balance. ` +
          `Expected: ${calculatedBalance}, Found: ${entry.runningBalance}`
        );
      }

      totalEntries++;
      
      // Count entry types
      if (entry.type === 'bill_created') {
        billEntries++;
        
        // Validate bill reference
        const referencedBill = bills.find(b => b.id === entry.relatedBillId);
        if (!referencedBill) {
          issues.push(`Ledger entry ${entry.id} references non-existent bill ${entry.relatedBillId}`);
        }
      } else if (entry.type === 'payment_received') {
        paymentEntries++;
      } else if (entry.type === 'advance_given') {
        advanceEntries++;
      }
    }

    // Validate final outstanding balance
    if (Math.abs(ledger.outstandingBalance - calculatedBalance) > 0.01) {
      issues.push(
        `Ledger ${ledger.partyName}: Outstanding balance mismatch. ` +
        `Expected: ${calculatedBalance}, Found: ${ledger.outstandingBalance}`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      totalLedgers: ledgers.length,
      totalEntries,
      billEntries,
      paymentEntries,
      advanceEntries
    }
  };
};

/**
 * Generates a migration report for display to the user
 * @param migrationResult - Result from migration operation
 * @param validationResult - Result from validation operation
 * @returns Formatted report string
 */
export const generateMigrationReport = (
  migrationResult: MigrationResult,
  validationResult?: ReturnType<typeof validateLedgerIntegrity>
): string => {
  let report = '\n=== LEDGER MIGRATION REPORT ===\n';
  report += `✅ Bills migrated: ${migrationResult.totalBillsMigrated}\n`;
  report += `👥 Parties updated: ${migrationResult.partiesUpdated.length}\n`;
  
  if (migrationResult.errors.length > 0) {
    report += `\n❌ Errors encountered: ${migrationResult.errors.length}\n`;
    migrationResult.errors.forEach((error, index) => {
      report += `   ${index + 1}. ${error}\n`;
    });
  }

  if (validationResult) {
    report += '\n=== VALIDATION RESULTS ===\n';
    report += `Status: ${validationResult.isValid ? '✅ Valid' : '❌ Issues Found'}\n`;
    report += `Total Ledgers: ${validationResult.summary.totalLedgers}\n`;
    report += `Total Entries: ${validationResult.summary.totalEntries}\n`;
    report += `  - Bill Entries: ${validationResult.summary.billEntries}\n`;
    report += `  - Payment Entries: ${validationResult.summary.paymentEntries}\n`;
    report += `  - Advance Entries: ${validationResult.summary.advanceEntries}\n`;
    
    if (validationResult.issues.length > 0) {
      report += '\n❌ Validation Issues:\n';
      validationResult.issues.forEach((issue, index) => {
        report += `   ${index + 1}. ${issue}\n`;
      });
    }
  }

  return report;
};
