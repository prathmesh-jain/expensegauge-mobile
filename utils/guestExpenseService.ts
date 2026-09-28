import { getDatabase } from './sqlite';
import * as Crypto from 'expo-crypto';

export interface LocalExpense {
  id?: number;
  clientId?: string;
  remoteId?: string;
  details: string;
  amount: number;
  type: 'credit' | 'debit' | 'assign';
  category?: string;
  date: string;
  sourceId?: string; // Account name (string) for guest mode
  createdAt: string;
  updatedAt: string;
  synced: number;
}

export interface LocalAccount {
  id?: number;
  remoteId?: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'credit_card' | 'business';
  balance: number;
  createdAt: string;
  updatedAt: string;
  synced: number;
}

// Expense CRUD Operations
export const addLocalExpense = async (expense: Omit<LocalExpense, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'clientId'>): Promise<{ id: number; clientId: string }> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const clientId = Crypto.randomUUID();

  const result = await db.runAsync(
    `INSERT INTO expenses (clientId, details, amount, type, category, date, sourceId, createdAt, updatedAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [clientId, expense.details, expense.amount, expense.type, expense.category || null, expense.date, expense.sourceId || null, now, now]
  );

  return { id: result.lastInsertRowId as number, clientId };
};

export const isExpenseInRange = (dateStr: string, range: string) => {
  if (range === 'all_time') return true;

  const expenseDate = new Date(dateStr);
  if (Number.isNaN(expenseDate.getTime())) return false;

  const now = new Date();
  const currentDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (range === 'current_day') {
    return expenseDate >= currentDayStart && expenseDate < nextDayStart;
  }
  if (range === 'current_month') {
    return expenseDate >= currentMonthStart && expenseDate < nextMonthStart;
  }
  if (range === 'last_month') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return expenseDate >= lastMonthStart && expenseDate < currentMonthStart;
  }
  if (range === 'last_3_months') {
    const lastThreeMonthsStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return expenseDate >= lastThreeMonthsStart && expenseDate < nextMonthStart;
  }

  return true;
};

export const getLocalExpenses = async (
  limit = 50,
  offset = 0,
  range = 'all_time',
  sourceId?: string | null
) => {
  const db = await getDatabase();
  const allExpenses = await db.getAllAsync<LocalExpense>(
    `SELECT * FROM expenses ORDER BY date DESC, createdAt DESC`
  );

  let targetAccountName: string | null = null;
  let targetAccountBalance: number | null = null;
  if (sourceId) {
    const account = await db.getFirstAsync<LocalAccount>(
      'SELECT * FROM accounts WHERE id = ? OR name = ?',
      [sourceId, sourceId]
    );
    if (account) {
      targetAccountName = account.name;
      targetAccountBalance = account.balance;
    }
  }

  const filteredExpenses = allExpenses.filter((exp) => {
    if (sourceId) {
      const matchSource = exp.sourceId === sourceId || (targetAccountName && exp.sourceId === targetAccountName);
      if (!matchSource) return false;
    }
    if (range && range !== 'all_time') {
      return isExpenseInRange(exp.date, range);
    }
    return true;
  });

  const rangeBalance = filteredExpenses.reduce((sum, exp) => {
    return exp.type === 'debit' ? sum - exp.amount : sum + exp.amount;
  }, 0);

  const totalBalance = allExpenses.reduce((sum, exp) => {
    return exp.type === 'debit' ? sum - exp.amount : sum + exp.amount;
  }, 0);

  const paginatedExpenses = filteredExpenses.slice(offset, offset + limit);
  const hasMore = offset + paginatedExpenses.length < filteredExpenses.length;

  return {
    expenses: paginatedExpenses.map((exp) => ({
      _id: exp.id?.toString() || exp.clientId || '',
      clientId: exp.clientId,
      details: exp.details,
      amount: exp.amount,
      type: exp.type,
      category: exp.category,
      date: exp.date,
      sourceId: exp.sourceId,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt,
      isSynced: Boolean(exp.synced),
    })),
    totalBalance,
    rangeBalance,
    accountBalance: targetAccountBalance,
    range,
    hasMore,
  };
};

export const getLocalExpenseById = async (id: number) => {
  const db = await getDatabase();
  const expense = await db.getFirstAsync<LocalExpense>(
    'SELECT * FROM expenses WHERE id = ?',
    [id]
  );
  return expense;
};

export const updateLocalExpense = async (id: number, updates: Partial<Omit<LocalExpense, 'id' | 'createdAt' | 'synced'>>): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields = [];
  const values = [];

  if (updates.details !== undefined) {
    fields.push('details = ?');
    values.push(updates.details);
  }
  if (updates.amount !== undefined) {
    fields.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.date !== undefined) {
    fields.push('date = ?');
    values.push(updates.date);
  }
  if (updates.sourceId !== undefined) {
    fields.push('sourceId = ?');
    values.push(updates.sourceId);
  }

  fields.push('updatedAt = ?');
  fields.push('synced = 0');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const deleteLocalExpense = async (id: number) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
};

export const getUnsyncedExpenses = async () => {
  const db = await getDatabase();
  const expenses = await db.getAllAsync<LocalExpense>(
    'SELECT * FROM expenses WHERE synced = 0 ORDER BY createdAt ASC'
  );
  return expenses;
};

export const markExpenseAsSynced = async (id: number, remoteId: string) => {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE expenses SET synced = 1, remoteId = ? WHERE id = ?',
    [remoteId, id]
  );
};

// Account CRUD Operations
export const addLocalAccount = async (account: Omit<LocalAccount, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'remoteId'>): Promise<{ id: number }> => {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO accounts (name, type, balance, createdAt, updatedAt, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [account.name, account.type, account.balance, now, now]
  );

  return { id: result.lastInsertRowId as number };
};

export const getLocalAccounts = async () => {
  const db = await getDatabase();
  const accounts = await db.getAllAsync<LocalAccount>(
    'SELECT * FROM accounts ORDER BY createdAt DESC'
  );
  return accounts;
};

export const updateLocalAccount = async (id: number, updates: Partial<Omit<LocalAccount, 'id' | 'createdAt' | 'synced'>>) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  
  const fields = [];
  const values = [];
  
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.balance !== undefined) {
    fields.push('balance = ?');
    values.push(updates.balance);
  }
  
  fields.push('updatedAt = ?');
  fields.push('synced = 0');
  values.push(now);
  values.push(id);
  
  await db.runAsync(
    `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const deleteLocalAccount = async (id: number, transferToAccountId?: string) => {
  const db = await getDatabase();
  // Start a transaction to delete account and its dependent expenses
  await db.execAsync('BEGIN TRANSACTION');
  try {
    // Get the account's ID and name first
    const account = await db.getFirstAsync<LocalAccount>(
      'SELECT id, name, balance FROM accounts WHERE id = ?',
      [id]
    );

    if (account) {
      if (transferToAccountId) {
        // Resolve target account
        const targetAccount = await db.getFirstAsync<LocalAccount>(
          'SELECT id, name, balance FROM accounts WHERE id = ? OR name = ?',
          [transferToAccountId, transferToAccountId]
        );
        if (targetAccount) {
          // Transfer balance to target account
          const updatedBalance = targetAccount.balance + account.balance;
          await db.runAsync(
            'UPDATE accounts SET balance = ?, updatedAt = ? WHERE id = ?',
            [updatedBalance, new Date().toISOString(), targetAccount.id!]
          );
          // Transfer expenses referencing the deleted account to the target account
          await db.runAsync(
            'UPDATE expenses SET sourceId = ? WHERE sourceId = ? OR sourceId = ?',
            [targetAccount.name, account.name, account.id!.toString()]
          );
        }
      } else {
        // Delete all expenses that reference this account by name or id
        await db.runAsync(
          'DELETE FROM expenses WHERE sourceId = ? OR sourceId = ?',
          [account.name, account.id!.toString()]
        );
      }

      // Then delete the account
      await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const getUnsyncedAccounts = async () => {
  const db = await getDatabase();
  const accounts = await db.getAllAsync<LocalAccount>(
    'SELECT * FROM accounts WHERE synced = 0 ORDER BY createdAt ASC'
  );
  return accounts;
};

export const markAccountAsSynced = async (id: number, remoteId: string) => {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE accounts SET synced = 1, remoteId = ? WHERE id = ?',
    [remoteId, id]
  );
};

// Analytics for guest users
export const getLocalExpenseAnalytics = async (range = 'all_time', sourceId?: string | null) => {
  const db = await getDatabase();
  
  let targetAccountName: string | null = null;
  if (sourceId) {
    const account = await db.getFirstAsync<LocalAccount>(
      'SELECT * FROM accounts WHERE id = ? OR name = ?',
      [sourceId, sourceId]
    );
    if (account) {
      targetAccountName = account.name;
    }
  }

  const allDebits = await db.getAllAsync<LocalExpense>(
    `SELECT * FROM expenses WHERE type = 'debit' ORDER BY date DESC`
  );

  const debitExpenses = allDebits.filter((exp) => {
    if (sourceId) {
      const matchSource = exp.sourceId === sourceId || (targetAccountName && exp.sourceId === targetAccountName);
      if (!matchSource) return false;
    }
    if (range && range !== 'all_time') {
      return isExpenseInRange(exp.date, range);
    }
    return true;
  });
  
  const totalSpend = debitExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalTransactions = debitExpenses.length;
  
  const categoryTotals: Record<string, number> = {};
  const accountTotals: Record<string, number> = {};
  const weekdayTotals: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0
  };
  const activeDates = new Set<string>();
  
  debitExpenses.forEach((expense) => {
    const categoryName = expense.category || 'Other';
    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
    
    if (expense.sourceId) {
      accountTotals[expense.sourceId.toString()] = (accountTotals[expense.sourceId.toString()] || 0) + expense.amount;
    }
    
    const expenseDate = new Date(expense.date);
    if (!isNaN(expenseDate.getTime())) {
      activeDates.add(expenseDate.toISOString().slice(0, 10));
      const weekday = expenseDate.toLocaleDateString('en-US', { weekday: 'long' });
      weekdayTotals[weekday] = (weekdayTotals[weekday] || 0) + expense.amount;
    }
  });
  
  const largestExpense = debitExpenses.reduce((largest, expense) => 
    (!largest || expense.amount > largest.amount) ? expense : largest, null as LocalExpense | null);
  
  const categoryBreakdown = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([key, amount]) => ({
      key,
      label: key,
      amount: Number(amount.toFixed(2)),
      percentage: totalSpend > 0 ? Number(((amount / totalSpend) * 100).toFixed(2)) : 0
    }));
  
  const sortedByDateAsc = [...debitExpenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const effectiveStart = sortedByDateAsc[0] ? new Date(sortedByDateAsc[0].date) : null;
  const effectiveEnd = sortedByDateAsc[sortedByDateAsc.length - 1] ? new Date(sortedByDateAsc[sortedByDateAsc.length - 1].date) : null;
  const periodDayCount = effectiveStart && effectiveEnd
    ? Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const averageDailySpend = periodDayCount > 0 ? totalSpend / periodDayCount : 0;
  
  const topWeekdayEntry = Object.entries(weekdayTotals).sort((a, b) => b[1] - a[1])[0];
  
  // Resolve account labels
  const localAccounts = await db.getAllAsync<LocalAccount>('SELECT * FROM accounts');
  const accountNameMap = new Map<string, string>();
  localAccounts.forEach(acc => {
    accountNameMap.set(acc.name, acc.name);
    if (acc.id) accountNameMap.set(acc.id.toString(), acc.name);
  });

  const accountBreakdown = Object.entries(accountTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([key, amount]) => ({
      key,
      label: accountNameMap.get(key) || key,
      amount: Number(amount.toFixed(2)),
      percentage: totalSpend > 0 ? Number(((amount / totalSpend) * 100).toFixed(2)) : 0
    }));

  const topAccountEntry = accountBreakdown[0];

  return {
    summary: {
      totalSpend: Number(totalSpend.toFixed(2)),
      totalTransactions,
      averageDailySpend: Number(averageDailySpend.toFixed(2)),
      activeDays: activeDates.size
    },
    categoryBreakdown,
    accountBreakdown,
    insights: {
      largestExpense: largestExpense ? {
        amount: Number(largestExpense.amount.toFixed(2)),
        details: largestExpense.details,
        category: largestExpense.category || 'Other',
        date: largestExpense.date
      } : null,
      topWeekday: topWeekdayEntry && topWeekdayEntry[1] > 0
        ? { day: topWeekdayEntry[0], amount: Number(topWeekdayEntry[1].toFixed(2)) }
        : null,
      highestCategory: categoryBreakdown[0] || null,
      topAccount: topAccountEntry ? { label: topAccountEntry.label, amount: topAccountEntry.amount, percentage: topAccountEntry.percentage } : null
    }
  };
};

export const getLocalMonthlyStats = async (sourceId?: string | null, range = 'all_time') => {
  const db = await getDatabase();

  let targetAccountName: string | null = null;
  if (sourceId) {
    const account = await db.getFirstAsync<LocalAccount>(
      'SELECT * FROM accounts WHERE id = ? OR name = ?',
      [sourceId, sourceId]
    );
    if (account) {
      targetAccountName = account.name;
    }
  }

  const allExpenses = await db.getAllAsync<LocalExpense>(
    'SELECT * FROM expenses ORDER BY date DESC'
  );

  const expenses = allExpenses.filter((exp) => {
    if (sourceId) {
      const matchSource = exp.sourceId === sourceId || (targetAccountName && exp.sourceId === targetAccountName);
      if (!matchSource) return false;
    }
    if (range && range !== 'all_time') {
      return isExpenseInRange(exp.date, range);
    }
    return true;
  });
  
  const last12Months: Array<{
    monthLabel: string;
    year: number;
    monthIndex: number;
    credit: number;
    debit: number;
  }> = [];
  const today = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthName = d.toLocaleString('default', { month: 'short' });
    last12Months.push({
      monthLabel: monthName,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      credit: 0,
      debit: 0
    });
  }
  
  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    if (isNaN(expDate.getTime())) return;
    
    const match = last12Months.find(m =>
      m.monthIndex === expDate.getMonth() &&
      m.year === expDate.getFullYear()
    );
    
    if (match) {
      const type = exp.type.toLowerCase();
      if (type === 'credit' || type === 'assign') {
        match.credit += exp.amount;
      } else if (type === 'debit') {
        match.debit += exp.amount;
      }
    }
  });
  
  const activeMonths = last12Months.filter(m => m.credit > 0 || m.debit > 0);
  
  return {
    labels: activeMonths.map(m => m.monthLabel),
    datasets: [
      { data: activeMonths.map(m => m.credit) },
      { data: activeMonths.map(m => m.debit) }
    ],
    raw: {
      credits: activeMonths.map(m => m.credit),
      debits: activeMonths.map(m => m.debit)
    }
  };
};

// Clear all local data (for logout/reset)
export const clearAllLocalData = async () => {
  const db = await getDatabase();

  // Clear all guest data
  await db.execAsync(`
    DELETE FROM expenses;
    DELETE FROM accounts;
  `);

  // Re-insert default settings
  await db.execAsync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES ('onboarding_completed', '0');
  `);
};