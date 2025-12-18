
import { Machine, Translations } from './types';

export const ADMIN_EMAIL = "rwanatiya3@gmail.com";
export const DEPOSIT_ADDRESS = "0xad24e7fcbbde3ca422d58d739c3f628fd7b0e03d";
export const NETWORK = "BEP20 (BSC)";
export const MIN_WITHDRAWAL = 8;
export const REFERRAL_PERCENT = 0.10;

const generateMachines = (): Machine[] => {
  const machines: Machine[] = [];
  const prices: number[] = [10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

  prices.forEach((price, index) => {
    // نسبة الربح تزداد بشكل مغري مع زيادة السعر
    const dailyRate = 0.10 + (index * 0.008); 
    const dailyProfit = Number((price * dailyRate).toFixed(2));
    const duration = 20; // دورة عمل ثابتة ومغرية (200% ربح في 20 يوم)

    let name = "";
    let desc = "";
    if (price <= 50) {
      name = `CORE-NODE V1`;
      desc = "مثالية للمبتدئين لبدء رحلة التعدين الرقمي";
    } else if (price <= 500) {
      name = `ALPHA-STREAM X`;
      desc = "قوة معالجة مضاعفة مع استقرار عالي في الأرباح";
    } else if (price <= 5000) {
      name = `TITAN-RACK PRO`;
      desc = "خوادم احترافية مخصصة لكبار المستثمرين";
    } else if (price <= 50000) {
      name = `QUANTUM OVERLORD`;
      desc = "تقنية الكوانتوم لتوليد أقصى عائد ممكن يومياً";
    } else if (price <= 250000) {
      name = `NEBULA SUPERIOR`;
      desc = "تحكم كامل في شبكة التعدين العالمية بعوائد ضخمة";
    } else {
      name = `SUPREME OMNI-GOD`;
      desc = "قمة الهرم الاستثماري - سيطرة كاملة على البروتوكول";
    }

    machines.push({
      id: index + 1,
      name: name,
      price: price,
      dailyProfit: dailyProfit,
      duration: duration,
      description: desc // أضفنا الوصف للإغراء
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
  balanceTitle: { en: "Available Balance", ar: "الرصيد المتاح" },
  recharge: { en: "Recharge", ar: "إيداع" },
  withdraw: { en: "Withdraw", ar: "سحب" },
  history: { en: "History", ar: "السجل" },
  buyNow: { en: "Buy Now", ar: "شراء الآن" },
  owned: { en: "Active", ar: "نشط" },
  completeTask: { en: "Claim Profit", ar: "استلام الربح" },
  supportChat: { en: "Support", ar: "الدعم الفني" },
  typeMessage: { en: "Type here...", ar: "اكتب رسالتك..." },
  confirmDeposit: { en: "Confirm", ar: "تأكيد" },
  clickToUpload: { en: "Upload Proof", ar: "رفع الإثبات" },
  minWithdrawalError: { en: "Min 8 USDT", ar: "أقل سحب 8 عملات" },
  verificationPending: { en: "Pending...", ar: "قيد المراجعة..." },
  transactionCompleted: { en: "Success", ar: "تم بنجاح" }
};
