
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
    description: "TIER STATUS: OPTIMIZED",
    color: "tier-bronze-fx"
  });

  const prices: number[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 10000, 900000, 1000000];

  prices.forEach((price, index) => {
    // New tempting profit logic: 10 -> 1.02, 20 -> 2.1, 30 -> 3.2, 40 -> 4.4...
    let dailyProfit = 0;
    if (price === 10) dailyProfit = 1.02;
    else if (price === 20) dailyProfit = 2.10;
    else if (price === 30) dailyProfit = 3.20;
    else {
      // Escalating profit percentage for higher tiers
      const basePercent = 0.105 + (index * 0.002); 
      dailyProfit = Number((price * basePercent).toFixed(2));
    }
    
    const duration = 20; 

    let name = "";
    let color = "";
    if (price <= 100) {
      name = `BRONZE CORE V${Math.floor(price/10)}`;
      color = "tier-bronze-fx";
    } else if (price <= 1000) {
      name = `SILVER TITAN X${Math.floor(price/12.5)}`;
      color = "tier-gold-fx";
    } else if (price >= 900000) {
      name = "DIAMOND SUPREME";
      color = "tier-diamond-fx";
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
      description: "TIER STATUS: OPTIMIZED",
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
  needHelp: { en: "Need Help?", ar: "هل تحتاج إلى مساعدة؟" },
  stuckFundsDesc: { 
    en: "If you face trouble withdrawing from any platform, we are here for consultation.", 
    ar: "إذا كنت تواجه مشكلة في سحب أموالك من أي منصة مهام أخرى، فنحن هنا للمساعدة فريقنا المتخصص يمكنه تقديم الدعم والمشورة لاستعادة حقوقك." 
  },
  secureSystemDesc: { 
    en: "Your data is encrypted with military-grade protocols", 
    ar: "أموالك وأرباحك مؤمنة بالكامل عبر بروتوكول التعدين الموزع الخاص بنا، نضمن لك سيولة مستمرة وعمليات سحب فورية." 
  },
  needHelpDesc: { 
    en: "Talk to our team 24/7 for any inquiries", 
    ar: "فريق الدعم متاح للرد على استفساراتكم 24/7" 
  },
  requestHelpBtn: { en: "Request Help Now", ar: "اطلب المساعدة الآن" },
  talkToUsBtn: { en: "Talk to Us", ar: "تحدث معنا" },
  historyTitle: { en: "History", ar: "السجل" }
};
