
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
    description: "ماكينة تجريبية مجانية لبدء رحلة التعدين",
    color: "tier-bronze-fx"
  });

  const prices: number[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 10000];

  prices.forEach((price, index) => {
    const dailyProfit = price === 10 ? 1.2 : Number((price * 0.12).toFixed(2));
    const duration = 20; 

    let name = "";
    let color = "";
    if (price <= 100) {
      name = `BRONZE CORE v${index + 1}`;
      color = "tier-bronze-fx";
    } else if (price <= 1000) {
      name = `SILVER TITAN x${index}`;
      color = "tier-gold-fx";
    } else {
      name = `GOLDEN QUANTUM`;
      color = "tier-platinum-fx";
    }

    machines.push({
      id: index + 1,
      name: name,
      price: price,
      dailyProfit: dailyProfit,
      duration: duration,
      description: "تحويل الأصول الرقمية إلى سيولة مشروعة عبر شبكتنا الموزعة",
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
  stuckFunds: { en: "Stuck Funds?", ar: "هل لديك أموال عالقه؟" },
  secureSystem: { en: "Secure System", ar: "نظام آمن ومستقر" },
  needHelp: { en: "Need Help?", ar: "هل تحتاج مساعدة؟" },
  stuckFundsDesc: { 
    en: "If you face trouble withdrawing from any platform, we are here for consultation.", 
    ar: "إذا كنت تواجه مشكله في سحب اموالك من أي منصه مهام أخرى فنحن هنا للمساعده فريقنا المتخصص يمكنه تقديم الدعم والمشورة لاستعادة حقوقك" 
  },
  secureSystemDesc: { en: "Your data is encrypted with military-grade protocols", ar: "بياناتك مشفرة بالكامل بأعلى معايير الأمان العالمية" },
  needHelpDesc: { en: "Talk to our team 24/7 for any inquiries", ar: "تواصل مع فريقنا على مدار الساعة لأي استفسار" }
};
