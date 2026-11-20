// pending: added by name, not joined; invited: added by email, hasn't accepted
export type GroupMemberStatus = 'active' | 'pending' | 'invited' | 'left';

export type EmailLookupUser = { name: string; maskedEmail: string; isYou: boolean };

export type GroupInvitation = {
  groupId: string;
  groupName: string;
  currencySymbol: string;
  invitedBy: string | null;
  memberCount: number;
};

export type GroupMember = {
  _id: string;
  name: string;
  status: GroupMemberStatus;
  isYou: boolean;
  isRegistered: boolean;
  addedByYou: boolean;
  joinedAt: string | null;
};

export type MemberBalance = {
  memberId: string;
  // positive: the group owes them; negative: they owe the group
  net: number;
};

// weight: the percent or number of shares, for splits made that way
export type Portion = { memberId: string; amount: number; weight?: number };

export type SplitType = 'equal' | 'exact' | 'percent' | 'shares';

// Values come as text: amounts like "1500.00", dates "2026-11-10", payer as a memberId
export type ExpenseChange = {
  field: 'details' | 'amount' | 'date' | 'category' | 'paidBy' | 'splitType' | 'share';
  memberId: string | null;
  from: string | null;
  to: string | null;
};

export type ExpenseEdit = { at: string; byMemberId: string; changes: ExpenseChange[] };

export type GroupExpense = {
  _id: string;
  clientId: string | null;
  details: string;
  amount: number;
  category: string;
  date: string;
  splitType: SplitType;
  paidBy: Portion[];
  splits: Portion[];
  createdByMemberId: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  addedToPersonal: boolean;
  myShare: number;
  myPaid: number;
  // Every edit, oldest first: who changed what, from → to
  edits?: ExpenseEdit[];
  // Set on entries saved offline that haven't reached the server yet
  pendingSync?: boolean;
};

export type Transfer = { from: string; to: string; amount: number };

export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'other';

export type GroupSettlement = {
  kind: 'settlement';
  _id: string;
  clientId: string | null;
  fromMemberId: string;
  toMemberId: string;
  // cash handed over
  amount: number;
  // debt it cleared
  settledAmount: number;
  // positive: payer rounded up; negative: receiver rounded down
  roundOff: number;
  method: PaymentMethod;
  note: string | null;
  date: string;
  source: 'smart' | 'manual';
  route: { before: Transfer[]; after: Transfer[]; nets: MemberBalance[]; computedAt: string } | null;
  createdByMemberId: string;
  createdAt: string;
  canDelete: boolean;
  addedToPersonal: boolean;
};

export type ActivityItem = (GroupExpense & { kind: 'expense' }) | GroupSettlement;

export type SettlePlan = {
  simplifyDebts: boolean;
  transfers: Transfer[];
  before: Transfer[];
  nets: MemberBalance[];
};

// One person's totals over the whole group
export type MemberSummary = {
  memberId: string;
  // put down for expenses
  paid: number;
  // their part of expenses: what they actually spent
  share: number;
  // settle-up cash out and in
  sent: number;
  received: number;
  net: number;
};

export type GroupSummary = {
  totalSpent: number;
  expenseCount: number;
  paymentCount: number;
  members: MemberSummary[];
  // what each person still owes whom after payments
  debts: Transfer[];
  simplifyDebts: boolean;
  smartPlan: Transfer[] | null;
};

export type SettlementInput = {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  settledAmount?: number;
  method: PaymentMethod;
  note?: string;
  date: string;
  source: 'smart' | 'manual';
  addToPersonal: boolean;
  sourceId?: string | null;
  clientId: string;
};

export type GroupExpenseInput = {
  details: string;
  amount: number;
  date: string;
  category: string;
  paidByMemberId: string;
  splitType: SplitType;
  participantIds?: string[];
  // exact: amount per person; percent/shares: weight per person
  splits?: { memberId: string; amount?: number; weight?: number }[];
  addToPersonal: boolean;
  sourceId?: string | null;
  clientId?: string;
};

export type Group = {
  // true when the latest change in the group was yours (not shown as new)
  lastActivityByYou?: boolean;
  // Your push setting for this group; null until you choose
  myNotify?: boolean | null;
  myNet: number;
  balances: MemberBalance[];
  _id: string;
  name: string;
  currencySymbol: string;
  simplifyDebts: boolean;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  isCreator: boolean;
  myMemberId: string | null;
  members: GroupMember[];
};

export type InvitePreview = {
  groupId: string;
  groupName: string;
  currencySymbol: string;
  invitedBy: string | null;
  alreadyMember: boolean;
  members: { _id: string; name: string }[];
  claimable: { _id: string; name: string }[];
};
