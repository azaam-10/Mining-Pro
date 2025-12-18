
import { Machine, Translations } from './types';

export const ADMIN_EMAIL = "rwanatiya3@gmail.com";
export const DEPOSIT_ADDRESS = "0xad24e7fcbbde3ca422d58d739c3f628fd7b0e03d";
export const NETWORK = "BEP20 (BSC)";
export const MIN_WITHDRAWAL = 8;
export const REFERRAL_PERCENT = 0.10;

const generateMachines = (): Machine[] => {
  const machines: Machine[] = [];
  const prices: number[] = [];

  for (let i = 10; i <= 100; i += 10) prices.push(i);
  for (let i = 125; i <= 200; i += 25) prices.push(i);
  for (let i = 250; i <= 500; i += 50) prices.push(i);
  for (let i = 600; i <= 1000; i += 100) prices.push(i);
  for (let i = 2000; i <= 10000; i += 1000) prices.push(i);
  for (let i = 20000; i <= 100000; i += 10000) prices.push(i);
  for (let i = 200000; i <= 1000000; i += 100000) prices.push(i);

  prices.forEach((price, index) => {
    const dailyRate = 0.10 + (index * 0.005);
    const dailyProfit = Number((price * dailyRate).toFixed(2));
    const totalTargetReturn = price * 2;
    const duration = Math.ceil(totalTargetReturn / dailyProfit);

    let name = "";
    if (price < 100) name = `V1-STARTER UNIT`;
    else if (price < 1000) name = `ALPHA PRO MINER`;
    else if (price < 10000) name = `TITAN RACK V4`;
    else if (price < 100000) name = `GLOBAL MAINFRAME`;
    else if (price < 500000) name = `QUANTUM SOVEREIGN`;
    else name = `GALACTIC OMNI-NODE`;

    machines.push({
      id: index + 1,
      name: name,
      price: price,
      dailyProfit: dailyProfit,
      duration: duration
    });
  });

  return machines;
};

export const MACHINES: Machine[] = generateMachines();

export const TRANSLATIONS: Translations = {
  home: { en: "Home", ar: "الرئيسية" },
  machines: { en: "Machines", ar: "الماكينات" },
  tasks: { en: "Tasks", ar: "المهام" },
  team: { en: "Team", ar: "الفريق" },
  profile: { en: "Profile", ar: "الملف الشخصي" },
  adminTool: { en: "Admin Panel", ar: "أداة المسؤول" },
  balanceTitle: { en: "Total Available Balance", ar: "الرصيد الكلي المتاح" },
  recharge: { en: "Deposit Balance", ar: "إيداع الرصيد" },
  withdraw: { en: "Withdraw Profit", ar: "سحب الأرباح" },
  history: { en: "Transaction History", ar: "سجل العمليات" },
  amountToDeposit: { en: "Amount to Deposit", ar: "المبلغ المراد إيداعه" },
  confirmDeposit: { en: "Verify Deposit", ar: "تأكيد الإيداع" },
  buyNow: { en: "Activate Miner", ar: "تفعيل الماكينة" },
  owned: { en: "Active", ar: "نشط" },
  completeTask: { en: "Harvest Profit", ar: "حصاد الأرباح" },
  transactionCompleted: { en: "Success", ar: "تم بنجاح" },
  verificationPending: { en: "Verification in progress...", ar: "جاري التحقق من المعاملة..." },
  minWithdrawalError: { en: "Minimum withdrawal is 8 USDT.", ar: "الحد الأدنى للسحب هو 8 عملات." },
  securityTitle: { en: "Protocol & Legal Safety", ar: "البروتوكول والأمان القانوني" },
  securityText: { 
    en: "Our platform acts as a secure intermediary for asset purification.",
    ar: "تعمل منصتنا كوسيط آمن لتنقية الأصول. معلوماتك مشفرة بنسبة 100٪ وغير مرئية لأي جهاز." 
  },
  clickToUpload: { en: "Upload Transfer Proof", ar: "رفع إثبات التحويل" }
};
