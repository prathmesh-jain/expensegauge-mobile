export type Transaction = {
    _id: string;
    amount: number;
    date: string;
    details: string;
    type: string;
    category: string;
    afterBalance?: number;
    isSynced: boolean;
    clientId?: string;
    createdAt?: string;
    updatedAt?: string;
    sourceId?: string | null;
};

export type User = {
    _id: string;
    netBalance: number;
    name: string;
    createdAt: string;
    expenses: Transaction[];
};

export type AnalyticsBreakdownItem = {
    key: string;
    label: string;
    amount: number;
    percentage: number;
};

export type ExpenseAnalytics = {
    summary: {
        totalSpend: number;
        totalTransactions: number;
        averageDailySpend: number;
        activeDays: number;
    };
    categoryBreakdown: AnalyticsBreakdownItem[];
    accountBreakdown: AnalyticsBreakdownItem[];
    insights: {
        largestExpense: {
            amount: number;
            details: string;
            category: string;
            date: string;
        } | null;
        topWeekday: {
            day: string;
            amount: number;
        } | null;
        highestCategory: {
            label: string;
            amount: number;
            percentage: number;
        } | null;
        topAccount: {
            label: string;
            amount: number;
            percentage: number;
        } | null;
    };
};
