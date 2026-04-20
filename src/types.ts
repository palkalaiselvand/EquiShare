export interface User {
  email: string;
  displayName: string;
  avatarUrl: string;
}

export interface Split {
  email: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // email
  groupId: string;
  groupMembers: string[];
  date: any; // Firestore Timestamp
  splits: Split[];
}

export interface Group {
  id: string;
  name: string;
  members: string[]; // emails
  createdBy: string;
  createdAt: any;
}

export interface Balance {
  email: string;
  amount: number; // positive = they owe you, negative = you owe them
}
