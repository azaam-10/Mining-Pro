
import { Machine, Translations } from './types';

export const ADMIN_EMAIL = "rwanatiya3@gmail.com";
export const DEPOSIT_ADDRESS = "0xad24e7fcbbde3ca422d58d739c3f628fd7b0e03d";
export const NETWORK = "BEP20 (BSC)";
export const MIN_WITHDRAWAL = 8;
export const REFERRAL_PERCENT = 0.10;

const generateMachines = (): Machine[] => {
  const machines: Machine[] = [];
  
  // Add Free Machine first
  machines.push({
    id: 0,
    name: "FREE STARTER NODE",
    price: 0,
    dailyProfit: 0.5,
    duration: 15,
    description: "ماكينة تجريبية مجانية لجميع المستخدمين لبدء رحلة التعدين",
    color: "from-slate-500/20 to-slate-600/40"
  });

  const prices: number[] = [];

  // Steps requested by user:
  // 10-100 (diff 10)
  for (let i = 10; i <= 100; i += 10) prices.push(i);
  // 100-200 (diff 25) - start from 125 to avoid duplicate 100
  for (let i = 125; i <= 200; i += 25) prices.push(i);
  // 200-500 (diff 50) - start from 250
  for (let i = 250; i <= 500; i += 50) prices.push(i);
  // 500-1000 (diff 100) - start from 600
  for (let i = 600; i <= 1000; i += 100) prices.push(i);
  // 1000-10000 (diff 1000) - start from 2000
  for (let i = 2000; i <= 10000; i += 1000) prices.push(i);
  // 10000-100000 (diff 10000) - start from 20000
  for (let i = 20000; i <= 100000; i += 10000) prices.push(i);
  // 100000-1000000 (diff 100000) - start from 200000
  for (let i = 200000; i <= 1000000; i += 100000) prices.push(i);

  prices.forEach((price, index) => {
    // Attractive ROI
    const dailyRate = 0.09 + (Math.log10(price) * 0.012); 
    const dailyProfit = Number((price * dailyRate).toFixed(2));
    const duration = 20; 

    let name = "";
    let color = "";
    let desc = "تحويل الأصول الرقمية إلى سيولة مشروعة عبر شبكتنا الموزعة";

    if (price <= 100) {
      name = `BRONZE CORE v${index + 1}`;
      color = "from-blue-500/20 to-blue-600/40";
    } else if (price <= 1000) {
      name = `SILVER TITAN x${index}`;
      color = "from-emerald-500/20 to-emerald-600/40";
    } else if (price <= 10000) {
      name = `GOLDEN QUANTUM`;
      color = "from-purple-500/20 to-purple-600/40";
    } else if (price <= 100000) {
      name = `PLATINUM NEBULA`;
      color = "from-orange-500/20 to-orange-600/40";
    } else {
      name = `DIAMOND SUPREME`;
      color = "from-rose-500/20 to-rose-600/40";
    }

    machines.push({
      id: index + 1,
      name: name,
      price: price,
      dailyProfit: dailyProfit,
      duration: duration,
      description: desc,
      color: color 
    });
  });

  return machines;
};

export const MACHINES: Machine[] = generateMachines();

export const TRANSLATIONS: Translations = {
  home: { en: "Home", ar: "الرئيسية" },
  machines: { en: "Mining", ar: "الماكينات" },
  tasks: { en: "Collect", ar: "المهام" },
  team: { en: "Network", ar: "الفريق" },
  profile: { en: "Account", ar: "الملف" },
  adminTool: { en: "Control", ar: "المسؤول" },
  balanceTitle: { en: "Wallet Balance", ar: "رصيد المحفظة" },
  recharge: { en: "Recharge", ar: "إيداع" },
  withdraw: { en: "Withdraw", ar: "سحب" },
  history: { en: "Recent Transactions", ar: "السجل" },
  buyNow: { en: "Activate", ar: "تفعيل" },
  owned: { en: "Running", ar: "نشط" },
  completeTask: { en: "Harvest", ar: "استلام" },
  supportChat: { en: "Support", ar: "الدعم الفني" },
  typeMessage: { en: "Message...", ar: "اكتب رسالتك..." },
  confirmDeposit: { en: "Confirm", ar: "تأكيد" },
  clickToUpload: { en: "Add Image", ar: "رفع الإثبات" },
  minWithdrawalError: { en: "Min 8 USDT", ar: "أقل سحب 8 عملات" },
  verificationPending: { en: "Pending Review", ar: "قيد المراجعة..." },
  transactionCompleted: { en: "Success", ar: "تم بنجاح" }
};
