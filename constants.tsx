
import { Machine, Translations } from './types';

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
  balanceTitle: { en: "Total Available Balance", ar: "الرصيد الكلي المتاح" },
  recharge: { en: "Deposit Balance", ar: "إيداع الرصيد" },
  withdraw: { en: "Withdraw Profit", ar: "سحب الأرباح" },
  history: { en: "Transaction History", ar: "سجل العمليات" },
  rechargeWallet: { en: "Recharge Wallet", ar: "تعبئة المحفظة" },
  securityWarningTitle: { en: "Strict Security Warning", ar: "تحذير أمني صارم" },
  securityWarningText: { 
    en: "Fraud attempts or fake screenshots lead to immediate permanent ban and loss of all earnings.",
    ar: "محاولة الخداع أو إرسال لقطات شاشة مزيفة ستؤدي إلى حظر حسابك نهائياً وفقدان جميع الأرباح." 
  },
  supportedNetwork: { en: "Supported Network: ", ar: "شبكة الإرسال المعتمدة: " },
  amountToDeposit: { en: "Amount to Deposit", ar: "المبلغ المراد إيداعه" },
  paymentProof: { en: "Transfer Notification Screenshot", ar: "لقطة شاشة لإشعار التحويل" },
  paymentProofDesc: {
    en: "Please take a screenshot of your wallet's successful transfer notification and upload it here.",
    ar: "يرجى التقاط صورة لشاشة إشعار نجاح عملية التحويل من محفظتك ورفعها هنا للتحقق."
  },
  clickToUpload: { en: "Upload Transfer Proof", ar: "رفع إثبات التحويل" },
  maxFileSize: { en: "PNG, JPG only", ar: "PNG, JPG فقط" },
  confirmDeposit: { en: "Verify Deposit", ar: "تأكيد الإيداع" },
  dailyProfit: { en: "Daily Profit", ar: "الربح اليومي" },
  totalProfit: { en: "Total Profit", ar: "إجمالي الربح" },
  buyNow: { en: "Activate Miner", ar: "تفعيل الماكينة" },
  owned: { en: "Active", ar: "نشط" },
  completeTask: { en: "Harvest Profit", ar: "حصاد الأرباح" },
  transactionCompleted: { en: "Success", ar: "تم بنجاح" },
  withdrawableBalance: { en: "Withdrawable Profit", ar: "الأرباح القابلة للسحب" },
  machineEarnings: { en: "Mining Profits", ar: "أرباح التعدين" },
  activeContracts: { en: "Active Nodes", ar: "العقود النشطة" },
  nextTaskIn: { en: "Next task in", ar: "المهمة القادمة خلال" },
  securityTitle: { en: "Protocol & Legal Safety", ar: "البروتوكول والأمان القانوني" },
  securityText: { 
    en: "Our platform acts as a secure intermediary for asset purification. We process non-legitimate funds through a massive network of thousands of individual accounts like yours to convert them into clean, official assets. This complex, military-grade encrypted process ensures that funds always arrive from official and legitimate wallets, making them completely untraceable by any regulatory body. Your information is 100% encrypted and invisible to any device, ensuring you are fully safe from any legal accountability or questioning.",
    ar: "تعمل منصتنا كوسيط آمن لتنقية الأصول. نقوم بمعالجة الأموال غير المشروعة من خلال شبكة ضخمة تضم آلاف الحسابات الفردية مثل حسابك لتحويلها إلى أصول نظيفة ورسمية. هذه العملية المعقدة والمشفرة بتشفير عسكري تضمن وصول الأموال دائماً من محافظ رسمية ومشروعة، مما يجعل تتبعها مستحيلاً من قبل أي جهة رقابية. معلوماتك مشفرة بنسبة 100٪ وغير مرئية لأي جهاز، مما يضمن لك الأمان التام بعيداً عن أي مساءلة قانونية أو استفسار." 
  },
  ourProfit: {
    en: "Our Profit: We receive illicit assets and redistribute them through a wide network of accounts to purify them into legitimate funds. You earn a high commission for being a secure node in this chain.",
    ar: "مكسبنا من هذه العملية هي أن نقوم باستلام الأصول غير المشروعة وتوزيعها عبر شبكة واسعة من الحسابات لتنقيتها وتصبح أموالاً مشروعة ونظيفة. أنت تحصل على عمولة عالية مقابل كونك عقدة آمنة في هذه السلسلة."
  },
  maxMachinesReached: { en: "Limit Reached: You can only have 3 active contracts. Please wait for one to end.", ar: "وصلت للحد الأقصى: يُسمح فقط بامتلاك 3 عقود نشطة. يرجى انتظار انتهاء أحد العقود الحالية لشراء عقد جديد." },
  insufficientBalance: { en: "Insufficient funds in your account.", ar: "رصيدك غير كافٍ لإتمام هذه العملية." },
  insufficientProfit: { en: "You can only withdraw earned profits. Initial deposits are locked.", ar: "لا يمكن سحب المبلغ الذي تم ايداعه؛ يمكنك فقط سحب الأرباح المحققة." },
  minWithdrawalError: { en: "Minimum withdrawal is 8 USDT.", ar: "الحد الأدنى للسحب هو 8 عملات." },
  oncePerDayError: { en: "Only one withdrawal permitted every 24 hours.", ar: "يُسمح بعملية سحب واحدة فقط يومياً." },
  contractDuration: { en: "Contract Duration", ar: "مدة العقد" },
  days: { en: "Days", ar: "يوم" },
  recommended: { en: "Recommended", ar: "ينصح به" },
  godMode: { en: "GOD MODE", ar: "نمط الآلهة" },
  legendary: { en: "Legendary", ar: "أسطوري" },
  limited: { en: "LIMITED EDITION", ar: "إصدار محدود" },
  depositNote: { en: "Deposits cannot be withdrawn.", ar: "المبالغ المودعة غير قابلة للسحب." },
  welcomeTitle: { en: "Protocol: ACTIVE & SECURE", ar: "البروتوكول: نشط وآمن" },
  welcomeMessage: {
    en: "Welcome back. The purification protocol is ACTIVE. Our goal is to receive illicit funds and redistribute them through thousands of accounts to become legitimate assets. Your participation is fully anonymous and legally protected.",
    ar: "أهلاً بك مجدداً. بروتوكول التنقية الخاص بنا نشط حالياً. هدفنا ومكسبنا من هذه العملية هو استقبال الأصول غير المشروعة وتوزيعها عبر آلاف الحسابات لتصبح أموالاً مشروعة. مشاركتك مجهولة الهوية بالكامل ومحمية قانونياً."
  },
  howItWorksBtn: { en: "Why these profits?", ar: "كيف يتم كسب المال؟" },
  walletAddress: { en: "Wallet Address", ar: "عنوان المحفظة" },
  amount: { en: "Amount", ar: "المبلغ" },
  confirm: { en: "Confirm", ar: "تأكيد" },
  referralEarnings: { en: "Total Referral Commissions", ar: "إجمالي عمولات الإحالة" },
  referralLink: { en: "Your Referral Identifier", ar: "رابط الإحالة الخاص بك" },
  deposit: { en: "Deposit", ar: "إيداع" },
  withdrawal: { en: "Withdrawal", ar: "سحب" },
  howToEarn: { en: "How it works?", ar: "كيف تعمل المنصة؟" }
};
