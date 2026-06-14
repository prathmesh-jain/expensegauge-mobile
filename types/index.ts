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