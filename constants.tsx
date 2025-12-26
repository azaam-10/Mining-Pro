
import { Machine, Translations } from './types';

export const ADMIN_EMAIL = "rwanatiya3@gmail.com";
export const DEPOSIT_ADDRESS = "0xa24769407ae6635466dae7e6f2c2cee08b181158";
export const NETWORK = "BEP20 (BSC)";
export const MIN_WITHDRAWAL = 8;
export const REFERRAL_PERCENT = 0.10;

const generateMachines = (): Machine[] => {
  const machines: Machine[] = [];
  
  // Add Free Machine
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

  // Sequence: 10, 20, 30... 100, 125, 150...
  for (let i = 10; i <= 100; i += 10) prices.push(i);
  for (let i = 125; i <= 200; i += 25) prices.push(i);
  for (let i = 250; i <= 500; i += 50) prices.push(i);
  for (let i = 600; i <= 1000; i += 100) prices.push(i);
  for (let i = 2000; i <= 10000; i += 1000) prices.push(i);
  for (let i = 20000; i <= 100000; i += 10000) prices.push(i);
  for (let i = 200000; i <= 1000000; i += 100000) prices.push(i);

  prices.forEach((price, index) => {
    // Machine ROI logic
    const dailyProfit = price === 10 ? 1.2 : Number((price * 0.12).toFixed(2));
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
  stuckFunds: { en: "Stuck Funds?", ar: "هل لديك أموال عالقة؟" },
  secureSystem: { en: "Secure System", ar: "نظام آمن ومستقر" },
  needHelp: { en: "Need Help?", ar: "هل تحتاج مساعدة؟" },
  stuckFundsDesc: { en: "Click here to solve deposit or withdrawal issues", ar: "اضغط هنا لحل مشاكل الإيداع أو السحب فوراً" },
  secureSystemDesc: { en: "Your data is encrypted with military-grade protocols", ar: "بياناتك مشفرة بالكامل بأعلى معايير الأمان العالمية" },
  needHelpDesc: { en: "Talk to our team 24/7 for any inquiries", ar: "تواصل مع فريقنا على مدار الساعة لأي استفسار" }
};
