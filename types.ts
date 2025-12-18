
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
  machine_id: number;
  purchase_date: string;
  last_claim_date: string | null;
  total_earned: number;
  remaining_days: number;
  user_id?: string; // Added for admin view
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'task' | 'referral';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  date: string;
  details?: string;
  proof_url?: string; // For deposit evidence
}

export interface UserState {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  balance: number;
  withdrawable_balance: number; // Use exact DB field name
  withdrawableBalance: number; // For app state
  total_recharge: number;
  totalRecharge: number;
  total_withdraw: number;
  totalWithdraw: number;
  referral_earnings: number;
  referralEarnings: number;
  referral_code: string;
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
