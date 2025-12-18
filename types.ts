
export type Language = 'en' | 'ar';

export interface Machine {
  id: number;
  name: string;
  price: number;
  dailyProfit: number;
  duration: number; // in days
  description: string;
  color: string;
}

export interface UserMachine {
  id: number;
  machine_id: number;
  purchase_date: string;
  last_claim_date: string | null;
  total_earned: number;
  remaining_days: number;
  user_id?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'task' | 'referral';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  date: string;
  details?: string;
  proof_url?: string;
}

export interface SupportMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_email?: string; // Virtual field
}

export interface UserState {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  balance: number;
  withdrawableBalance: number;
  totalRecharge: number;
  totalWithdraw: number;
  referralEarnings: number;
  referral_code: string;
  ownedMachines: UserMachine[];
  transactions: Transaction[];
  lastWithdrawDate: string | null;
  created_at: string;
}

export interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}
