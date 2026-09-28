import { getUnsyncedExpenses, markExpenseAsSynced, getUnsyncedAccounts, markAccountAsSynced, getLocalAccounts } from './guestExpenseService';
import api from '@/api/api';
import { useAuthStore } from '@/store/authStore';

const ACCOUNT_BATCH_SIZE = 50; // Keep below backend maximum of 100
const EXPENSE_BATCH_SIZE = 400;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T,>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Retry ${i + 1}/${retries} after error:`, error);
      await sleep(delay * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
};

interface MigrationProgress {
  onProgress?: (current: number, total: number, stage: string) => void;
}

interface MigrationResult {
  success: boolean;
  accountsMigrated: number;
  expensesMigrated: number;
  accountsFailed: number;
  expensesFailed: number;
  allSuccessful: boolean;
}

export const migrateGuestDataToAccount = async (progress?: MigrationProgress) => {
  try {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      throw new Error('User must be logged in to migrate data');
    }

    let accountsMigrated = 0;
    let expensesMigrated = 0;
    let accountsFailed = 0;
    let expensesFailed = 0;
    const accountMapping: Record<string, string> = {}; // Maps account name to remoteId

    // Pre-populate accountMapping with accounts already synced in previous runs (for retry)
    const allLocalAccounts = await getLocalAccounts();
    for (const acc of allLocalAccounts) {
      if (acc.name && acc.remoteId) {
        accountMapping[acc.name] = acc.remoteId;
      }
    }

    // Migrate accounts first (expenses depend on accounts)
    const unsyncedAccounts = await getUnsyncedAccounts();
    
    if (unsyncedAccounts.length > 0) {
      progress?.onProgress?.(0, unsyncedAccounts.length, 'Migrating accounts...');
      
      // Batch migrate accounts with proper batch size
      const accountBatches = [];
      for (let i = 0; i < unsyncedAccounts.length; i += ACCOUNT_BATCH_SIZE) {
        accountBatches.push(unsyncedAccounts.slice(i, i + ACCOUNT_BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < accountBatches.length; batchIndex++) {
        const batch = accountBatches[batchIndex];
        try {
          const response = await retryOperation(async () => {
            return await api.post('/account/batch-add', {
              accounts: batch.map(acc => ({
                localId: acc.id?.toString(),
                name: acc.name,
                type: acc.type,
                balance: acc.balance
              }))
            });
          });

          if (response.data && response.data.results) {
            const { success, failed, accountMapping: mapping, errors } = response.data.results;
            accountsMigrated += success;
            accountsFailed += failed;

            // Update local account mapping and mark only successful accounts as synced
            for (const [localId, remoteId] of Object.entries(mapping)) {
              if (localId && remoteId && typeof localId === 'string' && typeof remoteId === 'string') {
                const localIdNum = parseInt(localId);
                if (!isNaN(localIdNum)) {
                  const account = batch.find(acc => acc.id === localIdNum);
                  if (account && account.id) {
                    accountMapping[account.name] = remoteId;
                    await markAccountAsSynced(account.id, remoteId);
                  }
                }
              }
            }

            progress?.onProgress?.(
              Math.min((batchIndex + 1) * ACCOUNT_BATCH_SIZE, unsyncedAccounts.length),
              unsyncedAccounts.length,
              'Migrating accounts...'
            );
            console.log(`Batch accounts: ${success} migrated, ${failed} failed`);
          }
        } catch (error) {
          console.error('Failed to migrate account batch:', error);
          accountsFailed += batch.length;
        }
      }
    }

    // Migrate expenses in batches
    const unsyncedExpenses = await getUnsyncedExpenses();
    
    if (unsyncedExpenses.length > 0) {
      progress?.onProgress?.(0, unsyncedExpenses.length, 'Migrating expenses...');
      
      const expenseBatches = [];
      for (let i = 0; i < unsyncedExpenses.length; i += EXPENSE_BATCH_SIZE) {
        expenseBatches.push(unsyncedExpenses.slice(i, i + EXPENSE_BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < expenseBatches.length; batchIndex++) {
        const batch = expenseBatches[batchIndex];
        try {
          // Filter expenses to only include those with successfully migrated accounts
          const validExpenses = batch.filter(exp =>
            !exp.sourceId || accountMapping[exp.sourceId]
          );

          const skippedCount = batch.length - validExpenses.length;

          if (validExpenses.length === 0) {
            // Skip this batch entirely if no valid accounts
            expensesFailed += skippedCount;
            continue;
          }

          const response = await retryOperation(async () => {
            return await api.post('/expense/batch-add', {
              expenses: validExpenses.map(exp => ({
                clientId: exp.clientId,
                details: exp.details,
                amount: exp.amount,
                type: exp.type,
                category: exp.category,
                date: exp.date,
                sourceId: exp.sourceId ? accountMapping[exp.sourceId] : null
              }))
            });
          });

          if (response.data && response.data.results) {
            const { success, failed, errors, expenseMapping } = response.data.results;
            expensesMigrated += success;
            expensesFailed += failed + skippedCount; // Include skipped expenses in failed count

            // Mark only successful expenses as synced using expenseMapping
            // expenseMapping maps clientId to remote MongoDB ID
            if (expenseMapping && Object.keys(expenseMapping).length > 0) {
              for (let i = 0; i < batch.length; i++) {
                const expense = batch[i];
                if (expense.id && expense.clientId) {
                  const remoteId = expenseMapping[expense.clientId];
                  if (remoteId) {
                    // This expense was successfully migrated
                    await markExpenseAsSynced(expense.id, remoteId);
                  }
                }
              }
            }

            progress?.onProgress?.(
              Math.min((batchIndex + 1) * EXPENSE_BATCH_SIZE, unsyncedExpenses.length),
              unsyncedExpenses.length,
              'Migrating expenses...'
            );
            console.log(`Batch expenses: ${success} migrated, ${failed} failed`);
          }
        } catch (error) {
          console.error('Failed to migrate expense batch:', error);
          expensesFailed += batch.length;
        }
      }
    }

    // Calculate overall success - only successful if no failures
    const allSuccessful = accountsFailed === 0 && expensesFailed === 0;

    return {
      success: allSuccessful,
      accountsMigrated,
      expensesMigrated,
      accountsFailed,
      expensesFailed,
      allSuccessful,
    };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

export const hasUnsyncedData = async () => {
  const unsyncedExpenses = await getUnsyncedExpenses();
  const unsyncedAccounts = await getUnsyncedAccounts();
  
  return {
    hasExpenses: unsyncedExpenses.length > 0,
    hasAccounts: unsyncedAccounts.length > 0,
    expenseCount: unsyncedExpenses.length,
    accountCount: unsyncedAccounts.length,
  };
};