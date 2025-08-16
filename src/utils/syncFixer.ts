import { apiService } from '../services/apiService';
import { STORAGE_KEYS } from './storage';

export interface SyncIssue {
  type: 'unlinked_memo' | 'unlinked_loading_slip' | 'data_mismatch' | 'missing_supplier' | 'missing_party';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedItems: any[];
  fixAction: () => Promise<void>;
}

export class SyncFixer {
  private syncLogs: string[] = [];

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.syncLogs.push(`[${timestamp}] ${message}`);
    console.log(`[SyncFixer] ${message}`);
  }

  getLogs(): string[] {
    return this.syncLogs;
  }

  clearLogs() {
    this.syncLogs = [];
  }

  // Detect synchronization issues
  async detectIssues(): Promise<SyncIssue[]> {
    this.addLog('🔍 Starting synchronization issue detection...');
    const issues: SyncIssue[] = [];

    try {
      // Get data from both localStorage and backend
      const [localLoadingSlips, localMemos, localBills, localParties, localSuppliers] = await Promise.all([
        this.getLocalData(STORAGE_KEYS.LOADING_SLIPS),
        this.getLocalData(STORAGE_KEYS.MEMOS),
        this.getLocalData(STORAGE_KEYS.BILLS),
        this.getLocalData(STORAGE_KEYS.PARTIES),
        this.getLocalData(STORAGE_KEYS.SUPPLIERS)
      ]);

      const [backendLoadingSlips, backendMemos, backendBills, backendParties, backendSuppliers] = await Promise.all([
        apiService.getLoadingSlips().catch(() => []),
        apiService.getMemos().catch(() => []),
        apiService.getBills().catch(() => []),
        apiService.getParties().catch(() => []),
        apiService.getSuppliers().catch(() => [])
      ]);

      // Check for unlinked memos
      const unlinkedMemos = localMemos.filter(memo => !memo.linkedLoadingSlipId);
      if (unlinkedMemos.length > 0) {
        issues.push({
          type: 'unlinked_memo',
          description: `${unlinkedMemos.length} memos without linked loading slips`,
          severity: 'medium',
          affectedItems: unlinkedMemos,
          fixAction: () => this.fixUnlinkedMemos(unlinkedMemos, localLoadingSlips)
        });
      }

      // Check for loading slips without linked memos
      const unlinkedSlips = localLoadingSlips.filter(slip => !slip.linkedMemoNo);
      if (unlinkedSlips.length > 0) {
        issues.push({
          type: 'unlinked_loading_slip',
          description: `${unlinkedSlips.length} loading slips without linked memos`,
          severity: 'low',
          affectedItems: unlinkedSlips,
          fixAction: () => this.fixUnlinkedLoadingSlips(unlinkedSlips, localMemos)
        });
      }

      // Check for data mismatches
      const dataMismatches = this.detectDataMismatches({
        loadingSlips: { local: localLoadingSlips, backend: backendLoadingSlips },
        memos: { local: localMemos, backend: backendMemos },
        bills: { local: localBills, backend: backendBills },
        parties: { local: localParties, backend: backendParties },
        suppliers: { local: localSuppliers, backend: backendSuppliers }
      });

      if (dataMismatches.length > 0) {
        issues.push({
          type: 'data_mismatch',
          description: `${dataMismatches.length} data mismatches detected`,
          severity: 'high',
          affectedItems: dataMismatches,
          fixAction: () => this.fixDataMismatches(dataMismatches)
        });
      }

      // Check for missing suppliers
      const missingSuppliers = this.detectMissingSuppliers(localMemos, localSuppliers);
      if (missingSuppliers.length > 0) {
        issues.push({
          type: 'missing_supplier',
          description: `${missingSuppliers.length} suppliers referenced but not found`,
          severity: 'medium',
          affectedItems: missingSuppliers,
          fixAction: () => this.fixMissingSuppliers(missingSuppliers)
        });
      }

      // Check for missing parties
      const missingParties = this.detectMissingParties(localBills, localParties);
      if (missingParties.length > 0) {
        issues.push({
          type: 'missing_party',
          description: `${missingParties.length} parties referenced but not found`,
          severity: 'medium',
          affectedItems: missingParties,
          fixAction: () => this.fixMissingParties(missingParties)
        });
      }

      this.addLog(`✅ Issue detection completed. Found ${issues.length} issues.`);
    } catch (error) {
      this.addLog(`❌ Issue detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return issues;
  }

  // Fix unlinked memos by attempting to link them to loading slips
  private async fixUnlinkedMemos(unlinkedMemos: any[], loadingSlips: any[]): Promise<void> {
    this.addLog('🔧 Fixing unlinked memos...');
    
    for (const memo of unlinkedMemos) {
      // Try to find matching loading slip by vehicle number and date
      const matchingSlip = loadingSlips.find(slip => 
        slip.vehicleNo === memo.vehicle && 
        slip.date === memo.loadingDate &&
        !slip.linkedMemoNo
      );

      if (matchingSlip) {
        try {
          // Update memo with loading slip reference
          const updatedMemo = { ...memo, linkedLoadingSlipId: matchingSlip.id };
          await apiService.updateMemo(memo.id, updatedMemo);
          
          // Update loading slip with memo reference
          const updatedSlip = { ...matchingSlip, linkedMemoNo: memo.memoNo };
          await apiService.updateLoadingSlip(matchingSlip.id, updatedSlip);
          
          this.addLog(`✅ Linked memo ${memo.memoNo} to loading slip ${matchingSlip.slipNo}`);
        } catch (error) {
          this.addLog(`❌ Failed to link memo ${memo.memoNo}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Fix unlinked loading slips by creating memos for them
  private async fixUnlinkedLoadingSlips(unlinkedSlips: any[], memos: any[]): Promise<void> {
    this.addLog('🔧 Fixing unlinked loading slips...');
    
    for (const slip of unlinkedSlips) {
      // Check if memo already exists for this slip
      const existingMemo = memos.find(memo => 
        memo.vehicle === slip.vehicleNo && 
        memo.loadingDate === slip.date
      );

      if (!existingMemo) {
        try {
          // Create memo for this loading slip
          const memo = {
            memoNumber: `MEMO-${Date.now()}`,
            loadingDate: slip.date,
            from_location: slip.from,
            to_location: slip.to,
            supplierName: slip.supplierDetail,
            partyName: slip.partyName,
            vehicleNumber: slip.vehicleNo,
            weight: slip.weight,
            materialType: slip.material,
            freight: slip.freight,
            commission: Math.round((slip.freight * 6) / 100),
            balance: slip.freight,
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          const createdMemo = await apiService.createMemo(memo);
          
          // Update loading slip with memo reference
          const updatedSlip = { ...slip, linkedMemoNo: createdMemo.memoNumber };
          await apiService.updateLoadingSlip(slip.id, updatedSlip);
          
          this.addLog(`✅ Created memo ${createdMemo.memoNumber} for loading slip ${slip.slipNo}`);
        } catch (error) {
          this.addLog(`❌ Failed to create memo for slip ${slip.slipNo}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Fix data mismatches by syncing local data to backend
  private async fixDataMismatches(mismatches: any[]): Promise<void> {
    this.addLog('🔧 Fixing data mismatches...');
    
    for (const mismatch of mismatches) {
      try {
        await apiService.syncToBackend(mismatch.type, mismatch.localData);
        this.addLog(`✅ Synced ${mismatch.type} data to backend`);
      } catch (error) {
        this.addLog(`❌ Failed to sync ${mismatch.type}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Fix missing suppliers by creating them
  private async fixMissingSuppliers(missingSuppliers: any[]): Promise<void> {
    this.addLog('🔧 Fixing missing suppliers...');
    
    for (const supplierName of missingSuppliers) {
      try {
        const supplier = {
          name: supplierName,
          balance: 0,
          activeTrips: 0,
          createdAt: new Date().toISOString()
        };
        
        await apiService.createSupplier(supplier);
        this.addLog(`✅ Created missing supplier: ${supplierName}`);
      } catch (error) {
        this.addLog(`❌ Failed to create supplier ${supplierName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Fix missing parties by creating them
  private async fixMissingParties(missingParties: any[]): Promise<void> {
    this.addLog('🔧 Fixing missing parties...');
    
    for (const partyName of missingParties) {
      try {
        const party = {
          name: partyName,
          balance: 0,
          activeTrips: 0,
          createdAt: new Date().toISOString()
        };
        
        await apiService.createParty(party);
        this.addLog(`✅ Created missing party: ${partyName}`);
      } catch (error) {
        this.addLog(`❌ Failed to create party ${partyName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Helper methods
  private async getLocalData(key: string): Promise<any[]> {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      this.addLog(`❌ Failed to get local data for ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private detectDataMismatches(dataSets: any): any[] {
    const mismatches = [];
    
    Object.entries(dataSets).forEach(([type, data]) => {
      if (data.local.length !== data.backend.length) {
        mismatches.push({
          type,
          localData: data.local,
          backendData: data.backend,
          description: `${type}: Local ${data.local.length} vs Backend ${data.backend.length}`
        });
      }
    });
    
    return mismatches;
  }

  private detectMissingSuppliers(memos: any[], suppliers: any[]): string[] {
    const supplierNames = suppliers.map(s => s.name.toLowerCase());
    const missingSuppliers = new Set<string>();
    
    memos.forEach(memo => {
      if (memo.supplierName && !supplierNames.includes(memo.supplierName.toLowerCase())) {
        missingSuppliers.add(memo.supplierName);
      }
    });
    
    return Array.from(missingSuppliers);
  }

  private detectMissingParties(bills: any[], parties: any[]): string[] {
    const partyNames = parties.map(p => p.name.toLowerCase());
    const missingParties = new Set<string>();
    
    bills.forEach(bill => {
      if (bill.partyName && !partyNames.includes(bill.partyName.toLowerCase())) {
        missingParties.add(bill.partyName);
      }
    });
    
    return Array.from(missingParties);
  }

  // Comprehensive fix all issues
  async fixAllIssues(): Promise<void> {
    this.addLog('🚀 Starting comprehensive issue fixing...');
    
    const issues = await this.detectIssues();
    
    if (issues.length === 0) {
      this.addLog('✅ No issues found. System is synchronized.');
      return;
    }

    // Sort issues by severity (high first)
    const sortedIssues = issues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    for (const issue of sortedIssues) {
      this.addLog(`🔧 Fixing ${issue.type}: ${issue.description}`);
      try {
        await issue.fixAction();
        this.addLog(`✅ Fixed ${issue.type}`);
      } catch (error) {
        this.addLog(`❌ Failed to fix ${issue.type}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.addLog('✅ Comprehensive issue fixing completed.');
  }
}

// Export singleton instance
export const syncFixer = new SyncFixer();
