
export type Language = 'en' | 'ar';

export interface Machine {
  id: number;
  name: string;
  price: number;
  dailyProfit: number;
  duration: number; // in days
}

export interface UserMachine {
  id: number;
  machineId: number;
  purchaseDate: string;
  lastClaimDate: string | null;
  totalEarned: number;
  remainingDays: number;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'task' | 'referral';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  date: string;
  details?: string;
}

export interface UserState {
  balance: number;
  withdrawableBalance: number; // Only profits/earnings can be withdrawn
  totalRecharge: number;
  totalWithdraw: number;
  referralEarnings: number;
  ownedMachines: UserMachine[];
  transactions: Transaction[];
  lastWithdrawDate: string | null;
}

export interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}
