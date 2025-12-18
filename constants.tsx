
import { Machine, Translations } from './types';

export const ADMIN_EMAIL = "rwanatiya3@gmail.com";
export const DEPOSIT_ADDRESS = "0xad24e7fcbbde3ca422d58d739c3f628fd7b0e03d";
export const NETWORK = "BEP20 (BSC)";
export const MIN_WITHDRAWAL = 8;
export const REFERRAL_PERCENT = 0.10;

const generateMachines = (): Machine[] => {
  const machines: Machine[] = [];
  const prices: number[] = [];

  // من 10 إلى 100 بفرق 10
  for (let i = 10; i <= 100; i += 10) prices.push(i);
  // من 100 إلى 200 بفرق 25
  for (let i = 125; i <= 200; i += 25) prices.push(i);
  // من 200 إلى 500 بفرق 50
  for (let i = 250; i <= 500; i += 50) prices.push(i);
  // من 500 إلى 1000 بفرق 100
  for (let i = 600; i <= 1000; i += 100) prices.push(i);
  // من 1000 إلى 10000 بفرق 1000
  for (let i = 2000; i <= 10000; i += 1000) prices.push(i);
  // من 10000 إلى 100000 بفرق 10000
  for (let i = 20000; i <= 100000; i += 10000) prices.push(i);
  // من 100000 إلى 1000000 بفرق 100000
  for (let i = 200000; i <= 1000000; i += 100000) prices.push(i);

  prices.forEach((price, index) => {
    // نسبة الربح تزداد بشكل مغري مع زيادة السعر لجذب المستثمرين
    const dailyRate = 0.08 + (Math.log10(price) * 0.015); 
    const dailyProfit = Number((price * dailyRate).toFixed(2));
    const duration = 20; 

    let name = "";
    let color = "";
    if (price <= 100) {
      name = `BASIC CORE v${index + 1}`;
      color = "from-blue-500 to-cyan-500";
    } else if (price <= 1000) {
      name = `TITAN STREAM x${index}`;
      color = "from-emerald-500 to-teal-500";
    } else if (price <= 10000) {
      name = `QUANTUM FORCE`;
      color = "from-purple-600 to-pink-600";
    } else if (price <= 100000) {
      name = `NEBULA OVERLORD`;
      color = "from-amber-500 to-orange-600";
    } else {
      name = `SUPREME OMNI-GOD`;
      color = "from-rose-600 to-red-800";
    }

    machines.push({
      id: index + 1,
      name: name,
      price: price,
      dailyProfit: dailyProfit,
      duration: duration,
      description: "نظام التعدين الموزع عالي الكثافة",
      color: color // خاصية لونية للتصميم المغري
    } as any);
  });

  return machines;
};

export const MACHINES: Machine[] = generateMachines();

export const TRANSLATIONS: Translations = {
  home: { en: "Home", ar: "الرئيسية" },
  machines: { en: "Machines", ar: "الماكينات" },
  tasks: { en: "Tasks", ar: "المهام" },
  team: { en: "Team", ar: "الفريق" },
  profile: { en: "Profile", ar: "الملف" },
  adminTool: { en: "Admin", ar: "المسؤول" },
  balanceTitle: { en: "Total Assets", ar: "إجمالي الأصول" },
  recharge: { en: "Deposit", ar: "إيداع" },
  withdraw: { en: "Withdraw", ar: "سحب" },
  history: { en: "Ledger", ar: "السجل" },
  buyNow: { en: "Buy Now", ar: "شراء الآن" },
  owned: { en: "Running", ar: "نشط" },
  completeTask: { en: "Claim", ar: "استلام" },
  supportChat: { en: "Support", ar: "الدعم الفني" },
  typeMessage: { en: "Type...", ar: "اكتب رسالتك..." },
  confirmDeposit: { en: "Verify", ar: "تأكيد" },
  clickToUpload: { en: "Attach Proof", ar: "رفع الإثبات" },
  minWithdrawalError: { en: "Min 8 USDT", ar: "أقل سحب 8 عملات" },
  verificationPending: { en: "Verifying...", ar: "قيد المراجعة..." },
  transactionCompleted: { en: "Confirmed", ar: "تم بنجاح" }
};
