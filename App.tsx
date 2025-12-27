
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, X, Copy, Zap, Settings, RefreshCw, 
  MessageCircle, Send, LogOut, TrendingUp, Activity, Info, 
  History, ArrowUpRight, Award, Layers,
  ExternalLink, Calendar, AlertCircle, Headphones, Plus, Minus, Lock, Image as ImageIcon,
  Coins, Shield, BadgeCheck, LifeBuoy, Search, CheckCircle2, Mail, Clock, StickyNote, Bookmark,
  Sparkles, ZapOff, Database, ChevronRight, CheckCircle, HelpCircle, Wallet, ShieldAlert,
  ArrowDownRight, PlayCircle
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, REFERRAL_PERCENT, NETWORK } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

// --- UI Helpers ---
const NavItem = ({ icon: Icon, label, active, onClick, id }: any) => (
  <button id={id} onClick={onClick} className="flex flex-col items-center gap-1.5 group relative">
    <div className={`p-2.5 rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-500 hover:text-blue-400'}`}>
      <Icon size={22} className={active ? 'fill-current' : ''} />
    </div>
    <span className={`text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'text-blue-500' : 'text-slate-700'}`}>{label}</span>
  </button>
);

const ProtocolLoadingScreen = () => (
  <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center space-y-6">
    <div className="relative">
      <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
    </div>
    <span className="font-black italic text-2xl tracking-tighter uppercase text-white animate-pulse">MINE<span className="text-blue-500">PRO</span></span>
  </div>
);

// --- Welcome Modal Component (Updated with specific User Text) ---
function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl animate-in fade-in duration-500">
      <div className="bg-[#0b1424] w-full max-w-lg rounded-[3rem] border border-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.2)] relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none"></div>
        <div className="p-8 overflow-y-auto no-scrollbar relative z-10 text-right space-y-6">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl animate-float">
              <Sparkles size={40} />
            </div>
          </div>
          <h2 className="text-3xl font-black italic text-white text-center uppercase tracking-tighter">مرحباً بك في <span className="text-blue-500">MINEPRO</span></h2>
          
          <div className="space-y-6 rtl">
            <section className="bg-white/5 p-5 rounded-[2rem] border border-white/5 space-y-2">
              <h3 className="text-blue-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><Info size={16}/> عن المنصة والأرباح</h3>
              <p className="text-slate-300 text-xs leading-relaxed font-bold">
                نحن نقدم بروتوكول تعدين سحابي متطور، والهدف الأساسي من المنصة هو توفير بيئة "تنقية مالية". المنصة تعمل كجسر مالي يقوم باستقبال الأموال من آلاف المحافظ المختلفة وإعادة تدويرها وتوزيعها، مما يحول التدفقات المالية غير المحددة المصدر إلى أرباح شرعية ومستقرة لمستخدمينا.
              </p>
            </section>

            <section className="bg-emerald-500/5 p-5 rounded-[2rem] border border-emerald-500/10 space-y-2">
              <h3 className="text-emerald-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><Cpu size={16}/> آلية العمل والميزات</h3>
              <p className="text-slate-300 text-[11px] font-bold leading-relaxed">
                تبدأ العملية بإيداع رصيدك عبر شبكة BEP20، ثم شراء ماكينة التعدين التي تناسب ميزانيتك. كل ماكينة تمثل عقد تشغيل في بروتوكولنا يدر لك أرباحاً يومية يمكنك حصادها كل 24 ساعة.
              </p>
            </section>

            <section className="bg-red-500/5 p-5 rounded-[2rem] border border-red-500/10 space-y-2">
              <h3 className="text-red-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><AlertCircle size={16}/> استرداد الأموال العالقة</h3>
              <p className="text-slate-300 text-[11px] font-bold leading-relaxed">
                إذا كان لديك أموال عالقة في منصات أخرى أو تعرضت لعمليات احتيال، فريقنا التقني يمكنه المساعدة في استردادها. نتقاضى عمولة من <span className="text-white">20% إلى 50%</span>، والدفع يكون حصراً "بعد" نجاح عملية الاسترداد ووصول الأموال لمحفظتك.
              </p>
            </section>

            <section className="bg-blue-900/10 p-5 rounded-[2rem] border border-blue-500/20 space-y-2">
              <h3 className="text-blue-300 font-black text-sm flex items-center gap-2 flex-row-reverse"><ShieldCheck size={16}/> سياسة الدعم الفني</h3>
              <p className="text-slate-300 text-[10px] font-bold leading-relaxed">
                لا يمكن استخدام ميزة الدعم المباشر قبل الاشتراك وشراء ماكينة مدفوعة. الماكينة المجانية هي مساعدة استكشافية فقط ولا تمنح حق استخدام الدعم، إلا في حال وجود مشكلة تقنية تمنعك من عملية الاشتراك الأولى.
              </p>
            </section>
          </div>

          <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[2rem] font-black uppercase text-sm shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95 mt-4">موافق، ابدأ الآن</button>
        </div>
      </div>
    </div>
  );
}

// --- Success Overlays ---
function HarvestSuccessOverlay({ amount, onClose }: { amount: number, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] bg-[#020617]/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/40 blur-[40px] rounded-full animate-pulse"></div>
          <div className="w-40 h-40 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-[0_0_60px_rgba(16,185,129,0.6)] relative z-10">
            <Zap size={80} className="fill-current" />
          </div>
        </div>
        <div className="text-center space-y-4">
          <h2 className="text-emerald-400 font-black text-3xl tracking-tighter italic">تم الحصاد بنجاح</h2>
          <div className="flex flex-col items-center">
            <span className="text-white text-8xl font-black italic tracking-tighter leading-none">{amount.toFixed(2)}+</span>
            <span className="text-blue-400 font-black text-xl tracking-[0.3em] mt-4 uppercase">USDT PROCESSED</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchaseSuccessOverlay({ machineName, onClose }: { machineName: string, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] bg-[#020617]/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center space-y-10 animate-in slide-in-from-bottom-10 duration-700">
        <div className="w-48 h-48 bg-blue-600 rounded-[3rem] flex items-center justify-center text-white shadow-[0_0_80px_rgba(37,99,235,0.5)] border-4 border-white/20 animate-pulse">
          <ShieldCheck size={100} />
        </div>
        <div className="text-center space-y-4">
          <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-xs">V-PROTOCOL INITIALIZED</p>
          <h2 className="text-white font-black text-5xl italic uppercase tracking-tighter">{machineName}</h2>
          <div className="bg-white/10 px-8 py-3 rounded-full border border-white/10 inline-block">
             <span className="text-emerald-400 font-black italic">العقد نشط الآن - ابدأ الحصاد</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Enhanced Guided Tour Component (Deep Explanations) ---
function GuidedTour({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const navigate = useNavigate();
  const location = useLocation();

  const steps = [
    { target: 'home-balance', text: "هنا يظهر إجمالي أصولك في المنصة. هذا الرصيد يشمل أرباحك وعمولاتك مجمعة لسهولة تتبع نمو ثروتك.", page: '/' },
    { target: 'btn-recharge', text: "عند الضغط هنا ستفتح نافذة الإيداع. انسخ عنوان BEP20 وقم بالتحويل، ثم ارفع لقطة الشاشة ليتم تفعيل رصيدك فوراً.", page: '/' },
    { target: 'nav-machines', text: "هنا عالم الاستثمار. كل ماكينة لها سعر محدد وأرباح يومية مغرية. تذكر أن الماكينات الأغلى تعطي نسب ربح أعلى بكثير!", page: '/machines' },
    { target: 'nav-tasks', text: "بعد شراء الماكينة، توجه إلى هنا كل يوم. اضغط على 'حصاد' لتنقل أرباح التعدين إلى محفظتك الرئيسية مباشرة.", page: '/tasks' },
    { target: 'nav-team', text: "رابط دعوتك هو منجم ذهب آخر. أي شخص يشحن من خلالك، ستحصل أنت على عمولة 10% فورية تضاف لرصيدك.", page: '/team' },
    { target: 'nav-home', text: "الآن أنت مستعد لبدء رحلتك مع MINEPRO. لا تتردد في استكشاف كافة الميزات!", page: '/' }
  ];

  const updateCoords = useCallback(() => {
    const currentStep = steps[step];
    
    // Auto navigation if step is on a different page
    if (location.pathname !== currentStep.page) {
      navigate(currentStep.page);
      return;
    }

    const el = document.getElementById(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    }
  }, [step, location.pathname, navigate]);

  useEffect(() => {
    updateCoords();
    const timer = setTimeout(updateCoords, 300); // Small delay to allow page render
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('resize', updateCoords);
      clearTimeout(timer);
    };
  }, [updateCoords]);

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onComplete();
  };

  const currentStep = steps[step];
  const isBottom = coords.top < window.innerHeight * 0.45;

  return (
    <div className="fixed inset-0 z-[3000]">
      {/* Dim Overlay with Spotlight Hole */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect 
              x={coords.left - 10} 
              y={coords.top - 10} 
              width={coords.width + 20} 
              height={coords.height + 20} 
              rx="24" 
              fill="black" 
              className="transition-all duration-500"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#spotlight-mask)" />
      </svg>

      {/* Elegant Pointer Bubble */}
      <div 
        style={{ 
          top: isBottom ? coords.top + coords.height + 25 : 'auto', 
          bottom: !isBottom ? (window.innerHeight - coords.top) + 25 : 'auto',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
        className="absolute w-[90%] max-w-sm transition-all duration-500 pointer-events-auto"
      >
        <div className={`relative bg-blue-600 p-7 rounded-[2.5rem] shadow-[0_25px_70px_rgba(37,99,235,0.6)] border-2 border-white/20 animate-in slide-in-from-${isBottom ? 'top' : 'bottom'}-6`}>
          {/* Arrow */}
          <div className={`absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-blue-600 rotate-45 border-white/20 ${isBottom ? '-top-3 border-l-2 border-t-2' : '-bottom-3 border-r-2 border-b-2'}`}></div>
          
          <div className="space-y-4 text-center">
            <div className="flex justify-between items-center opacity-50">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Step {step + 1}/{steps.length}</span>
               <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-white"><HelpCircle size={12}/></div>
            </div>
            <p className="text-white font-black text-sm leading-relaxed text-right rtl">{currentStep.text}</p>
            <div className="pt-2 flex gap-3">
              <button onClick={next} className="flex-1 bg-white text-blue-600 py-4 rounded-2xl font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                {step < steps.length - 1 ? "فهمت، التالي" : "بدء الاستثمار الآن"}
              </button>
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} className="px-5 bg-black/20 text-white py-4 rounded-2xl font-black uppercase text-[11px] shadow-lg active:scale-95 transition-all">
                  السابق
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-auto" onClick={next}></div>
    </div>
  );
}

// --- Home View ---
function HomeView({ user, onShowInfo, onShowRecharge, onShowWithdraw, onShowSupport, onStartTour }: any) {
  const totalAssets = (user.balance || 0) + (user.referralEarnings || 0);
  return (
    <div className="space-y-6 animate-in fade-in pb-8">
      <div id="home-balance" className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
        <div className="relative z-10 flex flex-col items-end text-right space-y-6">
          <div className="flex justify-between w-full items-start">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]"><Wallet size={32} className="text-white" /></div>
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">إجمالي الأصول</p>
              <div className="flex items-baseline gap-2 justify-end">
                <span className="text-[10px] font-black text-blue-500 italic uppercase">USDT</span>
                <span className="text-5xl font-black italic text-white tracking-tighter">{(totalAssets).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full">
            <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white py-4.5 rounded-[1.8rem] font-black text-sm uppercase shadow-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform"><ArrowDownRight size={18} /> سحب</button>
            <button id="btn-recharge" onClick={onShowRecharge} className="flex-1 bg-white text-slate-900 py-4.5 rounded-[1.8rem] font-black text-sm uppercase shadow-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform"><ArrowUpRight size={18} /> إيداع</button>
          </div>
        </div>
      </div>

      <button onClick={onStartTour} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-[2.5rem] flex flex-row-reverse items-center justify-between border border-white/10 shadow-xl active:scale-95 transition-all group">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform"><PlayCircle size={28} /></div>
          <div className="text-right">
             <h4 className="text-white font-black italic text-sm">علمني كيف أعمل؟</h4>
             <p className="text-[9px] text-white/70 font-bold">شرح تفاعلي سريع لمنصة MINEPRO</p>
          </div>
        </div>
        <ChevronRight className="text-white/40" />
      </button>

      <div className="bg-[#1e1b4b] p-8 rounded-[3rem] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
        <div className="flex flex-row-reverse items-center gap-6">
          <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shrink-0 animate-pulse"><AlertCircle size={44} /></div>
          <div className="text-right space-y-4 flex-1">
            <h4 className="text-white font-black text-xl italic uppercase tracking-tighter">هل لديك أموال عالقة؟</h4>
            <p className="text-[11px] text-slate-400 font-bold leading-relaxed">إذا كنت تواجه مشكلة في سحب أموالك من أي منصة مهام أخرى، فنحن هنا للمساعدة.</p>
            <button onClick={onShowSupport} className="bg-white text-[#1e1b4b] px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg mr-auto">اطلب المساعدة الآن <MessageCircle size={16} className="fill-current" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div onClick={onShowSupport} className="bg-[#0b1424] p-7 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all text-center shadow-lg group">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto group-hover:scale-110 transition-all shadow-inner"><Headphones size={28} /></div>
          <h4 className="text-white font-black text-sm uppercase italic">الدعم الفني</h4>
        </div>
        <div onClick={onShowInfo} className="bg-[#0b1424] p-7 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all text-center shadow-lg group">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto group-hover:scale-110 transition-all shadow-inner"><Info size={28} /></div>
          <h4 className="text-white font-black text-sm uppercase italic">معلومات</h4>
        </div>
      </div>

      <div className="bg-[#0b1424]/40 p-6 rounded-[3rem] border border-white/5 space-y-6 shadow-xl text-right">
        <div className="flex flex-row-reverse justify-between items-center px-2">
          <h4 className="text-white font-black italic text-lg uppercase tracking-widest">سجل العمليات الأخير</h4>
          <History size={20} className="text-slate-500" />
        </div>
        <div className="space-y-4">
          {(!user.transactions || user.transactions.length === 0) ? (
            <div className="py-12 text-center opacity-20"><History size={40} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">لا توجد سجلات حالياً</p></div>
          ) : user.transactions.slice(0, 15).map((tx: any) => (
            <div key={tx.id} className="bg-black/20 p-5 rounded-[2.2rem] border border-white/5 flex flex-row-reverse items-center justify-between shadow-xl">
              <div className="flex items-center gap-4 flex-row-reverse text-right flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                   {tx.amount > 0 ? <ArrowUpRight size={22} className="rotate-45" /> : <ArrowDownRight size={22} className="rotate-45" />}
                </div>
                <div>
                   <p className="text-white font-black text-xs uppercase italic truncate">
                      {tx.type === 'withdrawal' ? 'سحب' : tx.type === 'deposit' ? 'إيداع' : tx.type === 'task' ? 'مهمة تعدين' : 'مكافأة إحالة'}
                   </p>
                   <p className="text-[8px] text-slate-500 font-bold mt-0.5">{new Date(tx.date).toLocaleDateString()}</p>
                   {tx.details && <p className="text-[9px] text-blue-400 font-black mt-1 line-clamp-1 italic">{tx.details}</p>}
                </div>
              </div>
              <div className="text-left shrink-0 ml-4">
                <p className={`text-lg font-black italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{Math.abs(tx.amount).toFixed(2)} {tx.amount > 0 ? '+' : '-'}</p>
                <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 text-right ${tx.status === 'completed' ? 'text-emerald-600' : tx.status === 'failed' ? 'text-red-600' : 'text-orange-500'}`}>
                  {tx.status === 'completed' ? 'مكتمل' : tx.status === 'failed' ? 'مرفوض' : 'معلق'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Machines View ---
function MachinesView({ user, onBuy }: any) {
  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {MACHINES.map((machine) => {
        const isOwned = user.ownedMachines.some((m: any) => m.machine_id === machine.id);
        return (
          <div key={machine.id} className={`${machine.color} p-8 rounded-[3.5rem] relative overflow-hidden group shadow-2xl transition-all hover:scale-[1.02]`}>
             <div className="flex flex-row-reverse justify-between items-start mb-6">
                <div className="flex flex-row-reverse items-center gap-4">
                   <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-white shadow-inner backdrop-blur-md"><Bookmark size={32} /></div>
                   <div className="text-right">
                      <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{machine.name}</h3>
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-0.5">{machine.description}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] text-white/50 font-black uppercase mb-0.5">سعر العقد</p>
                   <p className="text-3xl font-black text-white italic tracking-tighter">{machine.price}<span className="text-xs not-italic ml-0.5 text-blue-400">USDT</span></p>
                </div>
             </div>
             <div className="flex flex-row-reverse justify-around gap-2 mb-8">
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center backdrop-blur-md">
                   <Activity size={18} className="mx-auto mb-1.5 text-emerald-400" />
                   <p className="text-[15px] font-black text-emerald-400 italic">+{machine.dailyProfit}</p>
                </div>
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center backdrop-blur-md">
                   <Calendar size={18} className="mx-auto mb-1.5 text-blue-400" />
                   <p className="text-[15px] font-black text-blue-400 italic">{machine.duration} يوم</p>
                </div>
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center backdrop-blur-md">
                   <TrendingUp size={18} className="mx-auto mb-1.5 text-orange-400" />
                   <p className="text-[15px] font-black text-orange-400 italic">+{ (machine.dailyProfit * machine.duration).toFixed(1) }</p>
                </div>
             </div>
             <button onClick={() => !isOwned && onBuy(machine)} className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isOwned ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white text-black hover:bg-blue-50'}`}>
                <div className={`w-2 h-2 rounded-full ${isOwned ? 'bg-emerald-500 animate-pulse' : 'bg-black'}`}></div>
                {isOwned ? "عقد مفعل وشغال" : "تفعيل بروتوكول التعدين"}
             </button>
          </div>
        );
      })}
    </div>
  );
}

// --- Tasks View ---
function TasksView({ user, onComplete }: any) {
  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-[#0b1424] p-10 rounded-[3.5rem] border border-blue-500/10 shadow-2xl relative overflow-hidden flex flex-row-reverse items-center justify-between">
         <div className="text-right relative z-10">
            <h3 className="text-white font-black text-3xl italic uppercase tracking-tighter">مركز الحصاد</h3>
            <p className="text-[10px] text-blue-500 font-black tracking-widest mt-1 uppercase">OPERATIONAL STATUS: ACTIVE</p>
         </div>
         <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><ListTodo size={40} /></div>
      </div>
      <div className="space-y-6">
        {user.ownedMachines.map((um: UserMachine) => {
          const m = MACHINES.find(x => x.id === um.machine_id);
          const canClaim = !um.last_claim_date || (Date.now() - new Date(um.last_claim_date).getTime() >= 24 * 60 * 60 * 1000);
          return (
            <div key={um.id} className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
               <div className="flex flex-row-reverse justify-between items-center mb-6">
                  <div className="flex flex-row-reverse items-center gap-4 text-right">
                     <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-400"><Database size={32} /></div>
                     <div><h4 className="text-lg font-black italic text-white uppercase tracking-tighter">{m?.name}</h4><p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-0.5">SYNCING...</p></div>
                  </div>
                  <div className="text-right">
                     <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">العائد اليومي</p>
                     <p className="text-3xl font-black text-white italic">{m?.dailyProfit}+</p>
                  </div>
               </div>
               
               <div className="space-y-3 mb-8">
                  <div className="flex flex-row-reverse justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
                     <span>COMPLETE 22%</span>
                     <span>18.7H REMAINING</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]" style={{ width: '22%' }}></div>
                  </div>
               </div>

               <button onClick={() => canClaim && onComplete(um)} disabled={!canClaim} className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${canClaim ? 'bg-[#10b981] text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)]' : 'bg-black/30 text-slate-600 border border-white/5'}`}>
                  {canClaim ? <><Sparkles size={16} /> حصاد الأرباح <ChevronRight size={16}/></> : <><Loader2 size={16} className="animate-spin" /> قيد التعدين</>}
               </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- User Details Modal (Admin) ---
function UserDetailsModal({ userId, onClose, showToast }: any) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        const { data: machines } = await supabase.from('user_machines').select('*').eq('user_id', userId);
        if (profile) {
          setDetails({ ...profile, machines: machines || [] });
        }
      } catch (err: any) {
        showToast(err.message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId, showToast]);

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b1424] w-full max-w-md rounded-[4rem] p-10 space-y-8 relative overflow-y-auto max-h-[90vh] shadow-2xl border border-white/10 no-scrollbar text-right">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl text-white"><X size={20}/></button>
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl uppercase font-black text-3xl italic">
            {details?.first_name?.[0]}
          </div>
        </div>
        <h3 className="text-center font-black italic text-3xl uppercase text-white">تفاصيل العضو</h3>
        
        <div className="space-y-4 rtl text-right">
          <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase">الاسم الكامل</p>
            <p className="text-white font-bold text-lg">{details?.first_name}</p>
          </div>
          <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase">البريد الإلكتروني</p>
            <p className="text-white font-mono text-xs">{details?.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-1">
               <p className="text-slate-500 text-[10px] font-black uppercase">الرصيد</p>
               <p className="text-blue-500 font-black italic text-xl">{details?.balance?.toFixed(2)}</p>
            </div>
            <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-1">
               <p className="text-slate-500 text-[10px] font-black uppercase">الماكينات</p>
               <p className="text-emerald-500 font-black italic text-xl">{details?.machines?.length}</p>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-white text-base shadow-2xl active:scale-95 transition-all">إغلاق</button>
      </div>
    </div>
  );
}

// --- Admin View ---
function AdminView({ showToast, adminUUID, onOpenChatWithUser }: any) {
  const [mainTab, setMainTab] = useState<'deposit' | 'messages' | 'withdraw' | 'members'>('members');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserDetails, setSelectedUserDetails] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === 'members') {
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setData(users || []);
      } else if (mainTab === 'messages') {
        const { data: adminProf } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
        const currentId = adminProf?.id || adminUUID;
        const { data: msgs } = await supabase.from('support_messages').select('*').or(`sender_id.eq.${currentId},receiver_id.eq.${currentId}`).order('created_at', { ascending: false });
        if (msgs) {
          const partyIds = Array.from(new Set(msgs.flatMap(m => [m.sender_id, m.receiver_id])));
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', partyIds);
          const uniqueConversations: any[] = [];
          const seenParties = new Set();
          msgs.forEach(m => {
            const otherId = m.sender_id === currentId ? m.receiver_id : m.sender_id;
            if (otherId && otherId !== currentId && !seenParties.has(otherId)) {
              seenParties.add(otherId);
              uniqueConversations.push({ ...m, counterparty: profiles?.find(p => p.id === otherId) });
            }
          });
          setData(uniqueConversations);
        }
      } else {
        const typeStr = mainTab === 'deposit' ? 'deposit' : 'withdrawal';
        let query = supabase.from('transactions').select('*').eq('type', typeStr);
        if (subTab === 'new') query = query.eq('status', 'pending');
        else query = query.in('status', ['completed', 'failed']);
        const { data: txs } = await query.order('date', { ascending: false });
        if (txs) {
          const uids = Array.from(new Set(txs.map(t => t.user_id)));
          const { data: profs } = await supabase.from('profiles').select('*').in('id', uids);
          setData(txs.map(t => ({ ...t, profiles: profs?.find(p => p.id === t.user_id) })));
        }
      }
    } catch (e: any) { showToast(e.message, "error"); } 
    finally { setLoading(false); }
  }, [mainTab, subTab, adminUUID, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => {
      const p = item.profiles || item.counterparty || item;
      return p?.first_name?.toLowerCase().includes(term) || p?.email?.toLowerCase().includes(term) || p?.id?.toLowerCase().includes(term);
    });
  }, [data, searchTerm]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', tx.user_id).single();
      if (prof) {
        if (tx.type === 'deposit' && newStatus === 'completed') {
          await supabase.from('profiles').update({ balance: Number(prof.balance) + Number(tx.amount), total_recharge: Number(prof.total_recharge) + Number(tx.amount) }).eq('id', tx.user_id);
        } else if (tx.type === 'withdrawal' && newStatus === 'failed') {
          await supabase.from('profiles').update({ balance: Number(prof.balance) + Math.abs(tx.amount), withdrawable_balance: Number(prof.withdrawable_balance) + Math.abs(tx.amount) }).eq('id', tx.user_id);
        }
      }
      showToast("تم التحديث", "success");
      fetchData();
    } catch (e: any) { showToast(e.message, "error"); }
  };

  return (
    <div className="space-y-8 pb-12 text-right">
       {selectedUserDetails && <UserDetailsModal userId={selectedUserDetails} onClose={() => setSelectedUserDetails(null)} showToast={showToast} />}
       <div className="bg-[#0b1424] p-4 rounded-[2.5rem] border border-white/5 flex flex-row-reverse gap-3 overflow-x-auto no-scrollbar">
         {['deposit', 'withdraw', 'messages', 'members'].map((t: any) => (
           <button key={t} onClick={() => { setMainTab(t); setSubTab('new'); setSearchTerm(''); }} className={`flex-1 min-w-[85px] py-4 rounded-2xl font-black text-xs uppercase tracking-widest ${mainTab === t ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500'}`}>
             {t === 'deposit' ? 'إيداع' : t === 'messages' ? 'دردشات' : t === 'withdraw' ? 'سحب' : 'أعضاء'}
           </button>
         ))}
       </div>

       {(mainTab === 'deposit' || mainTab === 'withdraw') && (
         <div className="flex flex-row-reverse justify-center gap-4 bg-[#0b1424]/40 p-2 rounded-3xl border border-white/5">
            <button onClick={() => setSubTab('new')} className={`flex-1 py-3.5 rounded-2xl font-black text-xs ${subTab === 'new' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>الجديدة</button>
            <button onClick={() => setSubTab('archive')} className={`flex-1 py-3.5 rounded-2xl font-black text-xs ${subTab === 'archive' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>الأرشيف</button>
         </div>
       )}

       <div className="relative">
         <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
         <input type="text" placeholder="بحث..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#0b1424] border border-white/10 p-5 pr-14 rounded-[2rem] text-right font-bold text-xs" />
       </div>

       {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div> : (
         <div className="space-y-5">
           {filteredData.map(item => {
              const p = item.profiles || item.counterparty || (mainTab === 'members' ? item : null);
              const name = p?.first_name || "مجهول";
              return (
                <div key={item.id} onClick={() => mainTab === 'messages' ? onOpenChatWithUser(p.id) : setSelectedUserDetails(p.id)} className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/10 space-y-6 shadow-2xl transition-all cursor-pointer active:scale-95">
                   <div className="flex flex-row-reverse justify-between items-center text-right">
                      <div className="flex items-center gap-5 flex-row-reverse">
                         <div className="w-16 h-16 bg-blue-600 rounded-[1.8rem] flex items-center justify-center text-white font-black italic text-2xl uppercase">{name[0]}</div>
                         <div><h5 className="text-white font-black italic uppercase tracking-tighter text-xl">{name}</h5><p className="text-[11px] text-slate-500 font-mono truncate max-w-[150px]">{p?.email}</p></div>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-black text-blue-500 italic tracking-tighter">{Math.abs(item.amount || item.balance || 0).toFixed(1)}</p>
                         <p className="text-[9px] text-slate-600 font-black uppercase">USDT</p>
                      </div>
                   </div>
                   {item.proof_url && <img src={item.proof_url} className="w-full h-64 object-contain rounded-[2.5rem] bg-black/40 border border-white/5" alt="Proof" />}
                   {item.details && <p className="text-[10px] text-blue-500 italic text-right">{item.details}</p>}
                   {mainTab !== 'members' && mainTab !== 'messages' && item.status === 'pending' && (
                      <div className="flex flex-row-reverse gap-4 pt-4">
                         <button onClick={(e) => { e.stopPropagation(); handleTx(item, 'completed'); }} className="flex-1 bg-white text-black py-5 rounded-[1.8rem] font-black uppercase text-xs">موافقة</button>
                         <button onClick={(e) => { e.stopPropagation(); handleTx(item, 'failed'); }} className="flex-1 bg-red-600/10 text-red-500 py-5 rounded-[1.8rem] font-black uppercase text-xs">رفض</button>
                      </div>
                   )}
                </div>
              );
           })}
         </div>
       )}
    </div>
  );
}

// --- Restored Component Modals ---
function RechargeModal({ onClose, onDeposit, userId }: any) {
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!proof || !amount) return;
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', proof_url: proof, details: 'إيداع من المستخدم', date: new Date().toISOString() });
      onClose(); onDeposit();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b1424] w-full max-w-sm rounded-[4rem] p-10 space-y-8 relative overflow-y-auto max-h-[95vh] shadow-2xl border border-white/10 no-scrollbar">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
        <h3 className="text-center font-black italic text-3xl uppercase text-white">شحن الرصيد</h3>
        <div className="bg-black/40 p-6 rounded-[2rem] text-center border border-white/5 shadow-inner relative group cursor-pointer" onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); }}>
           <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-xl shadow-lg active:scale-90 transition-all"><Copy size={16}/></div>
           <p className="text-[9px] break-all font-mono text-white/90 pl-10 pr-4">{DEPOSIT_ADDRESS}</p>
        </div>
        <div className="space-y-4 text-right">
           <label className="text-[10px] text-slate-600 font-black uppercase px-2">المبلغ المودع</label>
           <div className="bg-[#020617] p-8 rounded-[2rem] text-center border border-white/5 shadow-inner">
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent outline-none text-center text-5xl font-black italic text-white" />
           </div>
        </div>
        <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setProof(r.result as string); r.readAsDataURL(f); } }} className="hidden" id="fileRecharge" />
        <label htmlFor="fileRecharge" className="w-full h-48 bg-white/5 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden shadow-inner">
           {proof ? <img src={proof} className="w-full h-full object-cover" alt="Proof" /> : <><ImageIcon className="text-slate-600 mb-3" size={48} /><p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">إرفاق لقطة شاشة</p></>}
        </label>
        <button onClick={submit} disabled={loading || !amount || !proof} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-white text-base shadow-2xl active:scale-95 transition-all">تأكيد</button>
      </div>
    </div>
  );
}

function WithdrawModal({ onClose, onWithdraw, userData, userId, showToast }: any) {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const minRequired = MIN_WITHDRAWAL;
  const isAmountLow = Number(amount) > 0 && Number(amount) < minRequired;
  const submit = async () => {
    const amt = Number(amount);
    if (amt < minRequired || amt > userData.withdrawableBalance || !address.trim()) return;
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', details: address, date: new Date().toISOString() });
      await supabase.from('profiles').update({ balance: Number(userData.balance) - amt, withdrawable_balance: Number(userData.withdrawableBalance) - amt }).eq('id', userId);
      onClose(); onWithdraw();
      showToast("تم إرسال طلب السحب بنجاح", "success");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 duration-300">
      <div className="bg-[#0b1424] w-full max-w-sm rounded-[4rem] p-10 space-y-8 relative border border-white/10 shadow-2xl text-right">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
        <h3 className="text-center font-black italic text-3xl uppercase text-white">سحب الرصيد</h3>
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-center shadow-lg">
           <p className="text-[10px] text-white/70 font-black mb-1 uppercase tracking-widest">المتاح للسحب الآن</p>
           <p className="text-3xl font-black italic text-white uppercase tracking-tighter">USDT {(userData.withdrawableBalance || 0).toFixed(2)}</p>
        </div>
        <div className="space-y-6">
           <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">عنوان المحفظة (BEP20)</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/50 border border-white/5 p-6 rounded-[1.5rem] outline-none text-right font-mono text-xs italic" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">المبلغ المطلوب</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.50" className="w-full bg-black/50 border border-white/5 p-6 rounded-[1.5rem] outline-none text-center font-black text-3xl italic" />
           </div>
        </div>
        <button onClick={submit} disabled={loading || isAmountLow || !amount || !address} className="w-full bg-white text-black py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-2xl active:scale-95 transition-all disabled:opacity-30">تأكيد سحب الأموال</button>
      </div>
    </div>
  );
}

function ProfileView({ user }: any) {
  return (
    <div className="space-y-6 pb-10 text-right animate-in fade-in">
      <div className="flex flex-col items-center py-12 relative">
         <div className="w-28 h-28 rounded-[2.8rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black italic shadow-2xl border-4 border-[#020617] uppercase">{user.first_name?.[0]}</div>
         <h3 className="text-3xl font-black mt-6 italic uppercase text-white tracking-tighter">{user.first_name}</h3>
         <p className="text-xs text-slate-500 font-mono mt-1 opacity-60 tracking-[0.2em] uppercase">{user.email}</p>
      </div>
      <div className="bg-[#0b1424] p-2 rounded-[3.5rem] border border-white/5 shadow-2xl">
         <div className="flex flex-row-reverse justify-between items-center p-8 border-b border-white/5">
            <div className="flex items-center gap-4 flex-row-reverse"><Wallet size={22} className="text-blue-500" /><span className="text-[13px] uppercase text-slate-500 font-black italic">إجمالي الرصيد</span></div>
            <span className="text-lg font-black text-white italic">{(user.balance || 0).toFixed(2)} USDT</span>
         </div>
         <div className="flex flex-row-reverse justify-between items-center p-8 border-b border-white/5">
            <div className="flex items-center gap-4 flex-row-reverse"><Activity size={22} className="text-emerald-500" /><span className="text-[13px] uppercase text-slate-500 font-black italic">متاح للسحب</span></div>
            <span className="text-lg font-black text-emerald-500 italic">{(user.withdrawableBalance || 0).toFixed(2)} USDT</span>
         </div>
         <div className="flex flex-row-reverse justify-between items-center p-8">
            <div className="flex items-center gap-4 flex-row-reverse"><Zap size={22} className="text-orange-500" /><span className="text-[13px] uppercase text-slate-500 font-black italic">إجمالي الإيداع</span></div>
            <span className="text-lg font-black text-orange-500 italic">{(user.totalRecharge || 0).toFixed(2)} USDT</span>
         </div>
      </div>
      <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 py-6 rounded-[2.5rem] font-black uppercase border border-red-500/10 shadow-2xl tracking-[0.2em]">تسجيل الخروج</button>
    </div>
  );
}

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b1424] w-full max-w-md rounded-[4rem] p-10 space-y-8 relative overflow-y-auto max-h-[90vh] shadow-2xl border border-white/10 no-scrollbar text-right">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
        <div className="flex justify-center mb-4"><div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><Info size={40} /></div></div>
        <h3 className="text-center font-black italic text-3xl uppercase text-white">معلومات المنصة</h3>
        <div className="space-y-6 rtl">
          <section className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-3"><h4 className="text-blue-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><ShieldCheck size={16}/> بروتوكول MINEPRO</h4><p className="text-slate-300 text-xs leading-relaxed font-bold">نظام تعدين سحابي متطور يعتمد على توزيع الأحمال المالية لضمان أعلى عوائد ممكنة.</p></section>
        </div>
        <button onClick={onClose} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-white text-base shadow-2xl active:scale-95 transition-all">إغلاق</button>
      </div>
    </div>
  );
}

const AuthView = ({ lang, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName || 'User' } } });
        if (error) throw error;
        showToast("نجح التسجيل، يمكنك تسجيل الدخول الآن", "success");
        setIsLogin(true);
      }
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-12 text-center animate-in zoom-in duration-700">
        <div className="w-32 h-32 bg-blue-600 rounded-[2.8rem] flex items-center justify-center text-white mx-auto shadow-2xl animate-float border-4 border-blue-500/30"><Zap size={64} className="fill-current" /></div>
        <h1 className="text-7xl font-black italic text-white tracking-tighter">MINE<span className="text-blue-500">PRO</span></h1>
        <div className="bg-[#0b1424]/60 backdrop-blur-3xl p-10 rounded-[4.5rem] border border-white/10 space-y-12">
          <div className="flex flex-row-reverse gap-2 p-1.5 bg-black/40 rounded-[1.8rem]">
             <button onClick={() => setIsLogin(true)} className={`flex-1 py-4.5 rounded-[1.5rem] font-black text-xs uppercase ${isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500'}`}>تسجيل الدخول</button>
             <button onClick={() => setIsLogin(false)} className={`flex-1 py-4.5 rounded-[1.5rem] font-black text-xs uppercase ${!isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500'}`}>إنشاء حساب</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-8 text-right">
            {!isLogin && <div className="space-y-2"><label className="text-[10px] text-slate-500 font-black uppercase px-2">الاسم بالكامل</label><input type="text" placeholder="أدخل اسمك" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right" /></div>}
            <div className="space-y-2"><label className="text-[10px] text-slate-500 font-black uppercase px-2">البريد الإلكتروني</label><input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right" required /></div>
            <div className="space-y-2"><label className="text-[10px] text-slate-500 font-black uppercase px-2">كلمة المرور</label><input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right" required /></div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-white uppercase text-lg shadow-2xl tracking-widest">{loading ? <Loader2 className="animate-spin" size={28} /> : (isLogin ? "تسجيل الدخول" : "إنشاء حساب")}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

function SupportChatModal({ onClose, userId, initialAdminId, targetUserId }: any) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherPartyId = targetUserId || initialAdminId;
  const fetchMessages = useCallback(async () => {
    if (!userId || !otherPartyId) return;
    const { data } = await supabase.from('support_messages').select('*').or(`and(sender_id.eq.${userId},receiver_id.eq.${otherPartyId}),and(sender_id.eq.${otherPartyId},receiver_id.eq.${userId})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [userId, otherPartyId]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  const sendMessage = async () => {
    if (!newMessage.trim() || !otherPartyId) return;
    const text = newMessage; setNewMessage('');
    try {
      await supabase.from('support_messages').insert({ sender_id: userId, receiver_id: otherPartyId, message: text, created_at: new Date().toISOString() });
      fetchMessages();
    } catch (e) { console.error(e); }
  };
  return (
    <div className="fixed inset-0 z-[600] bg-black/98 flex flex-col animate-in slide-in-from-bottom duration-300 backdrop-blur-3xl">
      <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0b1424] sticky top-0 z-10 text-right">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl shadow-lg"><X size={24}/></button>
        <div><h3 className="font-black text-white italic uppercase text-xl">الدعم المباشر</h3><p className="text-[10px] text-blue-500 font-black animate-pulse">قناة تواصل فورية</p></div>
        <div className="w-12"></div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
        {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div> : messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-[2.5rem] shadow-xl ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#0b1424] text-slate-200 border border-white/5 rounded-tl-none'}`}>
              <p className="text-sm font-bold leading-relaxed">{m.message}</p>
              <p className="text-[8px] opacity-40 mt-2 font-black text-left">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-8 bg-[#0b1424] border-t border-white/10 sticky bottom-0">
        <div className="max-w-md mx-auto relative">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="اكتب رسالتك..." className="w-full bg-black/40 border border-white/10 p-6 pr-20 rounded-[2rem] text-white outline-none italic text-right" />
          <button onClick={sendMessage} className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
}

// --- Team View ---
function TeamView({ user, showToast }: any) {
  const referralUrl = `${window.location.origin}/#/auth?ref=${user.id}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    showToast("تم نسخ رابط الدعوة", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10 text-right">
      <div className="bg-[#0b1424] p-10 rounded-[3.5rem] border border-blue-500/10 shadow-2xl relative overflow-hidden flex flex-row-reverse items-center justify-between">
         <div className="text-right relative z-10">
            <h3 className="text-white font-black text-3xl italic uppercase tracking-tighter">برنامج المكافآت</h3>
            <p className="text-[10px] text-blue-500 font-black tracking-widest mt-1 uppercase">كسب عمولات فورية 10%</p>
         </div>
         <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl"><Users size={40} /></div>
      </div>

      <div className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-6">
        <div className="space-y-4">
          <h4 className="text-white font-black italic text-lg uppercase tracking-widest">رابط الإحالة الخاص بك</h4>
          <div className="bg-black/40 p-6 rounded-[2rem] text-center border border-white/5 shadow-inner relative group cursor-pointer" onClick={copyLink}>
             <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-xl shadow-lg active:scale-90 transition-all text-white"><Copy size={16}/></div>
             <p className="text-[10px] break-all font-mono text-white/90 pl-12 pr-4 text-left">{referralUrl}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 text-center space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">أرباح الدعوات</p>
            <p className="text-2xl font-black italic text-emerald-500">{(user.referralEarnings || 0).toFixed(2)} <span className="text-[10px] not-italic">USDT</span></p>
          </div>
          <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 text-center space-y-2">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">معدل الربح</p>
            <p className="text-2xl font-black italic text-blue-500">{(REFERRAL_PERCENT * 100)}%</p>
          </div>
        </div>

        <section className="bg-blue-600/5 p-6 rounded-[2.5rem] border border-blue-600/10 space-y-3">
          <h4 className="text-blue-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><Info size={16}/> دليل العمل</h4>
          <p className="text-slate-300 text-xs leading-relaxed font-bold">
            كل عضو يسجل عن طريقك ويقوم بشحن رصيده، ستحصل تلقائياً على 10% من قيمة شحنه كمكافأة فورية في رصيدك. لا يوجد حد أقصى لعدد الأشخاص الذين يمكنك دعوتهم.
          </p>
        </section>
      </div>
    </div>
  );
}

// --- App Root ---
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [harvestSuccessAmount, setHarvestSuccessAmount] = useState<number | null>(null);
  const [purchaseSuccessMachine, setPurchaseSuccessMachine] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [adminTargetUserId, setAdminTargetUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);
  const [adminUUID, setAdminUUID] = useState<string | null>(null);

  const showToast = useCallback((message: any, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    let finalMsg = typeof message === 'string' ? message : message?.message || "حدث خطأ غير متوقع";
    setToasts(prev => [...prev, { message: finalMsg, type, id }]);
    setTimeout(() => setToasts(current => current.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchAllUserData = useCallback(async (userId: string, userEmail: string, isManual: boolean = false) => {
    if (!userId) return;
    if (isManual) setSyncing(true);
    try {
      const [profileRes, machinesRes, txsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_machines').select('*').eq('user_id', userId),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false })
      ]);
      let profile = profileRes.data;
      if (profile) {
        setUserData({ ...profile, email: userEmail, withdrawableBalance: profile.withdrawable_balance || 0, totalRecharge: profile.total_recharge || 0, totalWithdraw: profile.total_withdraw || 0, referralEarnings: profile.referral_earnings || 0, ownedMachines: (machinesRes.data || []).filter(m => m.remaining_days > 0), transactions: txsRes.data || [], lastWithdrawDate: null, created_at: profile.created_at });
        if (!isManual) {
           const hasSeen = localStorage.getItem(`welcome_seen_${userId}`);
           if (!hasSeen) { setShowWelcome(true); localStorage.setItem(`welcome_seen_${userId}`, 'true'); }
        }
      }
      if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) setAdminUUID(userId);
      else { const { data: admin } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle(); if (admin) setAdminUUID(admin.id); }
    } catch (err: any) { showToast(err, "error"); } 
    finally { setLoading(false); setSyncing(false); }
  }, [showToast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchAllUserData(session.user.id, session.user.email || '');
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchAllUserData(session.user.id, session.user.email || '');
      else { setUserData(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [fetchAllUserData]);

  const buyMachine = async (machine: Machine) => {
    if (!userData || isProcessing) return;
    if (userData.balance < machine.price) return showToast("عذراً، الرصيد غير كافٍ", "error");
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').insert({ user_id: session.user.id, machine_id: machine.id, remaining_days: machine.duration, total_earned: 0 });
      if (machine.price > 0) await supabase.from('profiles').update({ balance: Number(userData.balance) - machine.price }).eq('id', session.user.id);
      setPurchaseSuccessMachine(machine.name);
      fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, "error"); }
    finally { setIsProcessing(false); }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || isProcessing) return;
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').update({ last_claim_date: new Date().toISOString(), total_earned: (um.total_earned || 0) + machine.dailyProfit, remaining_days: Math.max(0, um.remaining_days - 1) }).eq('id', um.id);
      await supabase.from('profiles').update({ balance: Number(userData.balance) + machine.dailyProfit, withdrawable_balance: Number(userData.withdrawableBalance) + machine.dailyProfit }).eq('id', session.user.id);
      setHarvestSuccessAmount(machine.dailyProfit);
      await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed', details: `أرباح تعدين - ${machine.name}`, date: new Date().toISOString() });
      fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, "error"); }
    finally { setIsProcessing(false); }
  };

  if (loading) return <ProtocolLoadingScreen />;
  if (!session) return <AuthView lang={lang} showToast={showToast} />;
  if (!userData) return <ProtocolLoadingScreen />;

  return (
    <div className="min-h-screen pb-24 rtl font-['Cairo'] bg-[#020617] text-[#f8fafc] overflow-x-hidden relative">
      {isProcessing && <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
      {harvestSuccessAmount !== null && <HarvestSuccessOverlay amount={harvestSuccessAmount} onClose={() => setHarvestSuccessAmount(null)} />}
      {purchaseSuccessMachine !== null && <PurchaseSuccessOverlay machineName={purchaseSuccessMachine} onClose={() => setPurchaseSuccessMachine(null)} />}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} userData={userData} userId={session.user.id} showToast={showToast} />}
      {(showSupport || adminTargetUserId) && <SupportChatModal onClose={() => { setShowSupport(false); setAdminTargetUserId(null); }} userId={session.user.id} initialAdminId={adminUUID} targetUserId={adminTargetUserId} />}
      
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[800] w-full max-w-[90%] space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex flex-row-reverse items-center gap-3 px-6 py-4 rounded-[2rem] shadow-2xl pointer-events-auto backdrop-blur-3xl border animate-in slide-in-from-top-4 duration-300 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-100' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span className="text-[14px] font-bold">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="px-6 py-6 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex flex-row-reverse justify-between items-center shadow-lg">
        <div className="flex items-center gap-2 flex-row-reverse"><Zap size={24} className="text-blue-500 fill-blue-500" /><span className="font-black italic text-2xl tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span></div>
        <div className="flex items-center gap-3">
           <button onClick={() => supabase.auth.signOut()} className="p-3 bg-red-500/10 text-red-500 rounded-2xl shadow-lg"><LogOut size={24} /></button>
           <button onClick={() => setShowSupport(true)} className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl shadow-lg"><MessageCircle size={24} /></button>
           <button onClick={() => fetchAllUserData(session.user.id, session.user.email || '', true)} className={`p-3 bg-blue-500/10 text-blue-400 rounded-2xl ${syncing ? 'animate-spin' : ''} shadow-lg`}><RefreshCw size={24} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-8">
        <Routes>
          <Route path="/" element={<HomeView user={userData} onStartTour={() => { navigate('/'); setShowTour(true); }} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} onShowSupport={() => setShowSupport(true)} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} />} />
          <Route path="/team" element={<TeamView user={userData} showToast={showToast} />} />
          <Route path="/profile" element={<ProfileView user={userData} />} />
          <Route path="/admin" element={userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? <AdminView showToast={showToast} adminUUID={adminUUID} onOpenChatWithUser={(uid: string) => setAdminTargetUserId(uid)} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/10 p-5 z-40 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem id="nav-home" icon={HomeIcon} label="الرئيسية" active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem id="nav-machines" icon={Cpu} label="الماكينات" active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem id="nav-tasks" icon={ListTodo} label="المهام" active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? (
            <NavItem id="nav-admin" icon={Settings} label="الإدارة" active={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
          ) : (
            <NavItem id="nav-team" icon={Users} label="الفريق" active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          )}
          <NavItem id="nav-profile" icon={UserIcon} label="الملف" active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
}
