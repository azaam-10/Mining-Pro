
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
  ArrowDownRight
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, REFERRAL_PERCENT, NETWORK } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

// --- UI Helpers ---
const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 group relative">
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

// --- New Welcome Modal Component ---
function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-2xl animate-in fade-in duration-500">
      <div className="bg-[#0b1424] w-full max-w-lg rounded-[3rem] border border-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.2)] relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Decor */}
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
                نحن نقدم بروتوكول تعدين سحابي متطور، ولكن الحقيقة التقنية تكمن في أننا نعمل كجسر مالي متطور. تقوم المنصة بعملية "تنقية مالي" حيث يتم استقبال أموال من آلاف المحافظ المختلفة وإعادة توزيعها، مما يحول التدفقات المالية غير المحددة إلى أرباح شرعية ومستقرة لمستخدمينا عبر عقود التعدين.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-emerald-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><Cpu size={16}/> آلية العمل والماكينات</h3>
              <ul className="text-slate-400 text-[11px] space-y-2 pr-2 font-bold list-disc list-inside">
                <li><span className="text-white">الإيداع:</span> يتم عبر شبكة BEP20 لضمان السرية والسرعة.</li>
                <li><span className="text-white">شراء الماكينة:</span> كل ماكينة تمثل قوة معالجة في بروتوكولنا الموزع.</li>
                <li><span className="text-white">الحصاد:</span> يمكنك استلام أرباحك كل 24 ساعة بمجرد ضغطة زر.</li>
              </ul>
            </section>

            <section className="bg-red-500/10 p-5 rounded-[2rem] border border-red-500/20 space-y-2">
              <h3 className="text-red-400 font-black text-sm flex items-center gap-2 flex-row-reverse"><AlertCircle size={16}/> خدمة استرداد الأموال العالقة</h3>
              <p className="text-slate-300 text-xs leading-relaxed font-bold">
                إذا كان لديك رصيد عالق في منصات أخرى (scam platforms)، فريقنا المتخصص يمكنه التدخل تقنياً للمساعدة في سحبها. نحن نتقاضى عمولة تتراوح بين <span className="text-white">20% إلى 50%</span> من المبلغ المسترد، ويتم الدفع حصراً "بعد" نجاح عملية السحب.
              </p>
            </section>

            <section className="bg-blue-900/20 p-5 rounded-[2rem] border border-blue-500/30 space-y-2 text-center">
              <h3 className="text-blue-300 font-black text-sm"><Headphones size={16} className="inline ml-2"/> سياسة الدعم الفني</h3>
              <p className="text-slate-300 text-[10px] leading-relaxed font-bold">
                لا يمكن استخدام ميزة الدعم المباشر قبل الاشتراك وشراء أحد العقود المدفوعة. الماكينة المجانية هي مساعدة لبدء الاستكشاف ولا تعتبر اشتراكاً يمنح حق الوصول للدعم الفني، إلا في حال وجود مشكلة تقنية تعيق عملية الاشتراك الأولية.
              </p>
            </section>
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-[2rem] font-black uppercase text-sm shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all active:scale-95 mt-4"
          >
            موافق، ابدأ الآن
          </button>
        </div>
      </div>
    </div>
  );
}

// --- View Components ---

function HomeView({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, onShowSupport }: any) {
  return (
    <div className="space-y-6 animate-in fade-in pb-8">
      {/* Balance Card */}
      <div className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
        <div className="relative z-10 flex flex-col items-end text-right space-y-6">
          <div className="flex justify-between w-full items-start">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Coins size={32} className="text-white" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest">{t('balanceTitle')}</p>
              <div className="flex items-baseline gap-2 justify-end">
                <span className="text-[10px] font-black text-blue-500 italic uppercase">USDT</span>
                <span className="text-5xl font-black italic text-white tracking-tighter">{(user.balance || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full">
            <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white py-4.5 rounded-[1.8rem] font-black text-sm uppercase shadow-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform">
              <X size={18} className="rotate-45" /> سحب
            </button>
            <button onClick={onShowRecharge} className="flex-1 bg-white text-slate-900 py-4.5 rounded-[1.8rem] font-black text-sm uppercase shadow-xl flex items-center justify-center gap-2 hover:scale-105 transition-transform">
              <ArrowUpRight size={18} /> إيداع
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#1e1b4b] p-8 rounded-[3rem] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
        <div className="flex flex-row-reverse items-center gap-6">
          <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shrink-0 animate-pulse">
            <AlertCircle size={44} />
          </div>
          <div className="text-right space-y-4 flex-1">
            <h4 className="text-white font-black text-xl italic uppercase tracking-tighter">هل لديك أموال عالقة؟</h4>
            <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
              إذا كنت تواجه مشكلة في سحب أموالك من أي منصة مهام أخرى، فنحن هنا للمساعدة. فريقنا المتخصص يمكنه تقديم الدعم والمشورة لاستعادة حقوقك.
            </p>
            <button onClick={onShowSupport} className="bg-white text-[#1e1b4b] px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg mr-auto">
              اطلب المساعدة الآن
              <MessageCircle size={16} className="fill-current" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div onClick={onShowSupport} className="bg-[#0b1424] p-7 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all text-center shadow-lg group">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto group-hover:scale-110 transition-all shadow-inner"><Headphones size={28} /></div>
          <div>
            <h4 className="text-white font-black text-sm uppercase italic">الدعم الفني</h4>
            <p className="text-[9px] text-slate-500 font-bold mt-1">هل تحتاج إلى مساعدة؟</p>
          </div>
        </div>
        <div onClick={onShowInfo} className="bg-[#0b1424] p-7 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all text-center shadow-lg group">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto group-hover:scale-110 transition-all shadow-inner"><Info size={28} /></div>
          <div>
            <h4 className="text-white font-black text-sm uppercase italic">معلومات</h4>
            <p className="text-[9px] text-slate-500 font-bold mt-1">MINEPRO PROTOCOL</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0b1424]/40 p-6 rounded-[3rem] border border-white/5 space-y-6 shadow-xl">
        <div className="flex flex-row-reverse justify-between items-center px-2">
          <h4 className="text-white font-black italic text-lg uppercase tracking-widest">سجل العمليات الأخير</h4>
          <History size={20} className="text-slate-500" />
        </div>
        <div className="space-y-4">
          {(!user.transactions || user.transactions.length === 0) ? (
            <div className="py-12 text-center opacity-20"><History size={40} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">لا توجد سجلات حالياً</p></div>
          ) : user.transactions.slice(0, 10).map((tx: any) => (
            <div key={tx.id} className="bg-black/20 p-5 rounded-[2.2rem] border border-white/5 flex flex-row-reverse items-center justify-between shadow-xl transition-all hover:bg-black/30">
              <div className="flex items-center gap-4 flex-row-reverse text-right flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                   {tx.amount > 0 ? <ArrowUpRight size={22} className="rotate-45" /> : <ArrowDownRight size={22} className="rotate-45" />}
                </div>
                <div className="overflow-hidden">
                   <p className="text-white font-black text-xs uppercase italic tracking-wider truncate">{String(tx.type).toUpperCase() === 'WITHDRAWAL' ? 'سحب' : String(tx.type).toUpperCase() === 'DEPOSIT' ? 'إيداع' : 'مهمة'}</p>
                   <p className="text-[8px] text-slate-500 font-bold mt-0.5">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                   {tx.details && <p className="text-[9px] text-blue-400 font-black mt-1 line-clamp-1 italic">{tx.details}</p>}
                </div>
              </div>
              <div className="text-left shrink-0 ml-4">
                <p className={`text-lg font-black italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                   {Math.abs(tx.amount).toFixed(2)} {tx.amount > 0 ? '+' : '-'}
                </p>
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

function InfoModal({ onClose }: any) {
  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b1424] w-full max-w-sm rounded-[4rem] p-10 space-y-8 relative overflow-y-auto max-h-[90vh] shadow-2xl border border-white/10 no-scrollbar text-right">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
        <div className="text-center space-y-4">
           <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl border-4 border-blue-500/30">
             <Zap size={40} className="fill-current" />
           </div>
           <h3 className="font-black italic text-3xl uppercase text-white tracking-tighter">MINE<span className="text-blue-500">PRO</span> PROTOCOL</h3>
        </div>
        <div className="space-y-6 text-right">
           <p className="text-slate-400 text-xs leading-relaxed font-bold">MINEPRO هو بروتوكول متقدم للتعدين السحابي يوفر حلولاً آمنة ومستقرة للمستثمرين. نضمن لك عائدات يومية من خلال عقود تعدين موزعة ونظام أمني مشفر بالكامل.</p>
        </div>
        <button onClick={onClose} className="w-full bg-blue-600 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-lg">إغلاق</button>
      </div>
    </div>
  );
}

function MachinesView({ user, onBuy }: any) {
  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      {MACHINES.map((machine) => {
        const isOwned = user.ownedMachines.some((m: any) => m.machine_id === machine.id);
        return (
          <div key={machine.id} className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 relative overflow-hidden group shadow-2xl transition-all">
             <div className="flex flex-row-reverse justify-between items-start mb-6">
                <div className="flex flex-row-reverse items-center gap-4">
                   <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-400">
                      <Bookmark size={32} />
                   </div>
                   <div className="text-right">
                      <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{machine.name}</h3>
                      <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-0.5">TIER STATUS: OPTIMIZED</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] text-slate-600 font-black uppercase mb-0.5">السعر</p>
                   <p className="text-3xl font-black text-white italic tracking-tighter">{machine.price}<span className="text-xs not-italic ml-0.5">U</span></p>
                </div>
             </div>

             <div className="flex flex-row-reverse justify-around gap-2 mb-8">
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center">
                   <Activity size={18} className="mx-auto mb-1.5 text-emerald-500" />
                   <p className="text-[8px] text-slate-600 font-black uppercase mb-0.5">الربح اليومي</p>
                   <p className="text-[13px] font-black text-emerald-500">+{machine.dailyProfit}</p>
                </div>
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center">
                   <Calendar size={18} className="mx-auto mb-1.5 text-blue-500" />
                   <p className="text-[8px] text-slate-600 font-black uppercase mb-0.5">المدة</p>
                   <p className="text-[13px] font-black text-blue-500 italic">{machine.duration} يوم</p>
                </div>
                <div className="flex-1 bg-black/40 p-4 rounded-[2rem] border border-white/5 text-center">
                   <TrendingUp size={18} className="mx-auto mb-1.5 text-red-500" />
                   <p className="text-[8px] text-slate-600 font-black uppercase mb-0.5">الإجمالي</p>
                   <p className="text-[13px] font-black text-red-500">+{ (machine.dailyProfit * machine.duration).toFixed(2) }</p>
                </div>
             </div>

             <button 
                onClick={() => !isOwned && onBuy(machine)}
                className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${isOwned ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-[#0f2e3a] text-emerald-400 border border-emerald-500/30'}`}
             >
                <div className={`w-2 h-2 rounded-full ${isOwned ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`}></div>
                {isOwned ? "NODE STABLE" : "INITIALIZE PROTOCOL"}
             </button>
          </div>
        );
      })}
    </div>
  );
}

function TasksView({ user, onComplete }: any) {
  const dailyProfitSum = user.ownedMachines.reduce((acc: number, um: any) => {
    const m = MACHINES.find(x => x.id === um.machine_id);
    return acc + (m?.dailyProfit || 0);
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-[#0b1424] p-10 rounded-[3.5rem] border border-blue-500/10 shadow-2xl relative overflow-hidden flex flex-row-reverse items-center justify-between">
         <div className="text-right relative z-10">
            <h3 className="text-white font-black text-3xl italic uppercase tracking-tighter">مركز الحصاد</h3>
            <p className="text-[10px] text-blue-500 font-black tracking-widest mt-1 uppercase">OPERATIONAL STATUS: ACTIVE</p>
         </div>
         <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
            <ListTodo size={40} />
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-[#0b1424] p-8 rounded-[2.5rem] border border-white/5 text-center shadow-lg">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">العقد النشط</p>
            <p className="text-2xl font-black text-blue-500 italic uppercase">NODES {user.ownedMachines.length}</p>
         </div>
         <div className="bg-[#0b1424] p-8 rounded-[2.5rem] border border-white/5 text-center shadow-lg">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">أرباح اليوم</p>
            <p className="text-2xl font-black text-emerald-500 italic uppercase">USDT 0.00</p>
         </div>
      </div>

      <div className="space-y-6">
        {user.ownedMachines.map((um: UserMachine) => {
          const m = MACHINES.find(x => x.id === um.machine_id);
          const canClaim = !um.last_claim_date || (Date.now() - new Date(um.last_claim_date).getTime() >= 24 * 60 * 60 * 1000);
          return (
            <div key={um.id} className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
               <div className="flex flex-row-reverse justify-between items-center mb-6">
                  <div className="flex flex-row-reverse items-center gap-4">
                     <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-slate-400">
                        <Database size={32} />
                     </div>
                     <div className="text-right">
                        <h4 className="text-lg font-black italic text-white uppercase tracking-tighter">{m?.name}</h4>
                        <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-0.5">حالة التزامن: SYNCING...</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[9px] text-slate-600 font-black uppercase">العائد</p>
                     <p className="text-3xl font-black text-white italic">{m?.dailyProfit}+</p>
                  </div>
               </div>

               <div className="space-y-3 mb-8">
                  <div className="flex flex-row-reverse justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
                     <span>COMPLETE 21%</span>
                     <span>18.9H REMAINING</span>
                  </div>
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.8)]" style={{ width: '21%' }}></div>
                  </div>
               </div>

               <button 
                  onClick={() => canClaim && onComplete(um)}
                  disabled={!canClaim}
                  className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${canClaim ? 'bg-blue-600 text-white' : 'bg-black/30 text-slate-600 border border-white/5'}`}
               >
                  {!canClaim && <Loader2 size={16} className="animate-spin" />}
                  {canClaim ? 'استلام العائد' : 'قيد التعدين'}
               </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RechargeModal({ onClose, onDeposit, userId }: any) {
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!proof || !amount) return;
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'deposit', 
        amount: Number(amount), 
        status: 'pending', 
        proof_url: proof,
        details: 'إيداع من المستخدم',
        date: new Date().toISOString()
      });
      onClose(); onDeposit();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0b1424] w-full max-w-sm rounded-[4rem] p-10 space-y-8 relative overflow-y-auto max-h-[95vh] shadow-2xl border border-white/10 no-scrollbar">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl"><X size={20}/></button>
        <div className="text-center space-y-2">
           <h3 className="font-black italic text-3xl uppercase text-white">شحن الرصيد</h3>
           <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">NETWORK: {NETWORK}</p>
        </div>
        
        <div className="bg-black/40 p-6 rounded-[2rem] text-center border border-white/5 shadow-inner relative group cursor-pointer" onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); }}>
           <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-xl shadow-lg active:scale-90 transition-all"><Copy size={16}/></div>
           <p className="text-[9px] break-all font-mono text-white/90 pl-10 pr-4">{DEPOSIT_ADDRESS}</p>
        </div>

        <div className="space-y-4 text-right">
           <label className="text-[10px] text-slate-600 font-black uppercase px-2 text-right block">المبلغ المودع</label>
           <div className="bg-[#020617] p-8 rounded-[2rem] text-center border border-white/5 shadow-inner">
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent outline-none text-center text-5xl font-black italic text-white placeholder-slate-800" />
           </div>
        </div>

        <div className="space-y-4">
           <p className="text-[10px] text-slate-600 font-black uppercase px-2 text-right block">إرفاق لقطة شاشة للإثبات</p>
           <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-[1.5rem] flex flex-row-reverse items-center justify-between text-right gap-4">
              <Info size={18} className="text-blue-500 shrink-0" />
              <p className="text-[11px] text-blue-200 font-bold leading-tight">يجب إرفاق لقطة شاشة واضحة من محفظتك توضح تفاصيل عملية التحويل (مكتملة) لضمان سرعة معالجة الطلب.</p>
           </div>
           
           <input type="file" accept="image/*" onChange={e => {
              const f = e.target.files?.[0];
              if (f) { const r = new FileReader(); r.onloadend = () => setProof(r.result as string); r.readAsDataURL(f); }
           }} className="hidden" id="fileRecharge" />
           <label htmlFor="fileRecharge" className="w-full h-48 bg-white/5 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer overflow-hidden group shadow-inner">
              {proof ? <img src={proof} className="w-full h-full object-cover" alt="Proof" /> : <>
                <ImageIcon className="text-slate-600 mb-3" size={48} />
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-widest">اضغط لاختيار صورة</p>
              </>}
           </label>
        </div>

        <div className="flex flex-row-reverse items-center justify-center gap-2 text-emerald-500 opacity-80">
           <Lock size={12} />
           <p className="text-[9px] font-black uppercase tracking-widest">بروتوكول تشفير الإيداع نشط ومؤمن بالكامل</p>
        </div>

        <button onClick={submit} disabled={loading || !amount || !proof} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black text-white text-base shadow-[0_15px_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all">تأكيد</button>
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
    if (amt < minRequired) return; 
    if (amt > userData.withdrawableBalance) return showToast("الرصيد المتاح غير كافٍ", "error");
    if (!address.trim()) return showToast("يرجى إدخال عنوان المحفظة", "error");
    
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'withdrawal', 
        amount: -amt, 
        status: 'pending', 
        details: address,
        date: new Date().toISOString()
      });
      await supabase.from('profiles').update({ 
        balance: Number(userData.balance) - amt, 
        withdrawable_balance: Number(userData.withdrawableBalance) - amt 
      }).eq('id', userId);
      onClose(); onWithdraw();
      showToast("تم إرسال طلب السحب بنجاح", "success");
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl animate-in zoom-in-95 duration-300">
      <div className="bg-[#0b1424] w-full max-w-sm rounded-[4rem] p-10 space-y-8 relative border border-white/10 shadow-2xl">
        <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><X size={20}/></button>
        <h3 className="text-center font-black italic text-3xl uppercase text-white">سحب الرصيد</h3>
        
        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-center border border-white/10 shadow-[0_10px_30px_rgba(37,99,235,0.3)]">
           <p className="text-[10px] text-white/70 font-black mb-1 uppercase tracking-widest">المتاح للسحب</p>
           <p className="text-3xl font-black italic text-white uppercase tracking-tighter">USDT {(userData.withdrawableBalance || 0).toFixed(2)}</p>
        </div>

        <div className={`p-5 rounded-[1.5rem] flex flex-row-reverse items-center justify-between border transition-all ${isAmountLow ? 'bg-red-500/20 border-red-500/40 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${isAmountLow ? 'bg-red-600' : 'bg-emerald-600'}`}>
             {isAmountLow ? <AlertCircle size={18}/> : <CheckCircle size={18}/>}
           </div>
           <p className={`text-[11px] font-bold text-right ${isAmountLow ? 'text-red-200' : 'text-emerald-200'}`}>
             الحد الأدنى للسحب هو {minRequired} USDT
           </p>
        </div>

        <div className="space-y-6 text-right">
           <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">عنوان المحفظة (BEP20)</label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/50 border border-white/5 p-6 rounded-[1.5rem] outline-none text-right font-mono text-xs italic shadow-inner focus:border-blue-500/50 transition-all" />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">المبلغ المطلوب</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.50" className="w-full bg-black/50 border border-white/5 p-6 rounded-[1.5rem] outline-none text-center font-black text-3xl italic shadow-inner focus:border-blue-500/50 transition-all" />
           </div>
        </div>

        <button onClick={submit} disabled={loading || isAmountLow || !amount || !address} className="w-full bg-white text-black py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-2xl active:scale-95 transition-all disabled:opacity-30">تأكيد سحب الأموال</button>
      </div>
    </div>
  );
}

function UserDetailsModal({ userId, onClose, showToast }: any) {
  const [data, setData] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendAmount, setSendAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    const [pRes, txRes, mRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('user_machines').select('*').eq('user_id', userId)
    ]);
    if (pRes.data) setData(pRes.data);
    if (txRes.data) setTxs(txRes.data);
    if (mRes.data) setMachines(mRes.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  const handleManualAction = async (type: 'deposit' | 'withdrawal') => {
    const amt = type === 'deposit' ? Number(sendAmount) : Number(withdrawAmount);
    const note = type === 'deposit' ? depositNote : withdrawNote;
    if (!amt || amt <= 0) return showToast("أدخل مبلغاً صحيحاً", "error");
    
    setIsProcessingLocal(true);
    try {
      const newBalance = type === 'deposit' ? Number(data.balance) + amt : Math.max(0, Number(data.balance) - amt);
      const newWithdrawable = type === 'deposit' ? Number(data.withdrawable_balance) + amt : Math.max(0, Number(data.withdrawable_balance) - amt);
      
      const { error: updErr } = await supabase.from('profiles').update({ 
        balance: newBalance,
        withdrawable_balance: newWithdrawable,
        total_recharge: type === 'deposit' ? Number(data.total_recharge) + amt : data.total_recharge
      }).eq('id', userId);
      
      if (updErr) throw updErr;

      await supabase.from('transactions').insert({
        user_id: userId,
        type: type,
        amount: type === 'deposit' ? amt : -amt,
        status: 'completed',
        details: note || (type === 'deposit' ? 'إيداع يدوي' : 'خصم يدوي'),
        date: new Date().toISOString()
      });

      showToast("تم تحديث الرصيد بنجاح", "success");
      if (type === 'deposit') { setSendAmount(''); setDepositNote(''); } else { setWithdrawAmount(''); setWithdrawNote(''); }
      fetchDetails();
    } catch (e: any) { showToast(e, "error"); }
    finally { setIsProcessingLocal(false); }
  };

  if (loading) return <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-md flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="fixed inset-0 z-[700] bg-black/98 flex flex-col animate-in slide-in-from-bottom duration-300 backdrop-blur-3xl overflow-y-auto no-scrollbar">
       <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0b1424] sticky top-0 z-10">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl shadow-lg hover:bg-white/10 transition-all"><X size={28}/></button>
          <div className="text-center">
             <h3 className="font-black text-white italic tracking-[0.2em] uppercase text-xl">إدارة الحساب</h3>
             <p className="text-[10px] text-blue-500 font-mono mt-1">{data?.email}</p>
          </div>
          <div className="w-12"></div>
       </div>

       <div className="max-w-md mx-auto w-full p-8 space-y-10 pb-20">
          <div className="bg-gradient-to-br from-blue-600/10 to-transparent p-10 rounded-[4rem] border border-blue-500/20 space-y-8 relative overflow-hidden text-right shadow-2xl">
             <div className="flex gap-8 items-center flex-row-reverse">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-4xl font-black italic shadow-2xl border-2 border-white/20 uppercase">{data.first_name?.[0]}</div>
                <div className="text-right">
                   <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{data.first_name}</h2>
                   <p className="text-xs text-slate-500 font-mono mt-2 tracking-widest">{data.id.slice(0, 12)}...</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-5 pt-6">
                <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 text-center shadow-inner">
                   <p className="text-[9px] text-slate-500 font-black uppercase mb-2 tracking-widest">إجمالي الرصيد</p>
                   <p className="text-2xl font-black text-white italic tracking-tighter">{data.balance.toFixed(2)}</p>
                </div>
                <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 text-center shadow-inner">
                   <p className="text-[9px] text-slate-500 font-black uppercase mb-2 tracking-widest">متاح للسحب</p>
                   <p className="text-2xl font-black text-blue-500 italic tracking-tighter">{data.withdrawable_balance.toFixed(2)}</p>
                </div>
             </div>
          </div>

          <div className="space-y-10">
             <div className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-blue-500/20 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 px-1 flex-row-reverse">
                   <Coins size={20} className="text-blue-500" />
                   <h4 className="text-sm font-black text-white uppercase italic text-right">إرسال رصيد يدوي</h4>
                </div>
                <div className="space-y-4">
                  <input type="number" placeholder="المبلغ" value={sendAmount} onChange={e => setSendAmount(e.target.value)} className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl text-white font-black outline-none text-center text-xl" />
                  <input type="text" placeholder="ملاحظة العملية" value={depositNote} onChange={e => setDepositNote(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white text-right font-bold text-xs" />
                  <button onClick={() => handleManualAction('deposit')} disabled={isProcessingLocal} className="w-full bg-blue-600 py-5 rounded-[1.5rem] text-white font-black uppercase text-xs shadow-lg active:scale-95 transition-all">تأكيد الإرسال</button>
                </div>
             </div>

             <div className="bg-[#0b1424] p-8 rounded-[3.5rem] border border-red-500/20 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 px-1 flex-row-reverse">
                   <ShieldAlert size={20} className="text-red-500" />
                   <h4 className="text-sm font-black text-white uppercase italic text-right">خصم رصيد يدوي</h4>
                </div>
                <div className="space-y-4">
                  <input type="number" placeholder="المبلغ" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl text-white font-black outline-none text-center text-xl" />
                  <input type="text" placeholder="ملاحظة الخصم" value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 rounded-xl text-white text-right font-bold text-xs" />
                  <button onClick={() => handleManualAction('withdrawal')} disabled={isProcessingLocal} className="w-full bg-red-600 py-5 rounded-[1.5rem] text-white font-black uppercase text-xs shadow-lg active:scale-95 transition-all">تأكيد الخصم</button>
                </div>
             </div>
          </div>
          
          <div className="space-y-6 pb-12">
            <h4 className="text-white font-black italic text-lg uppercase tracking-widest text-right">سجل العمليات</h4>
            <div className="space-y-4">
              {txs.length === 0 ? <p className="text-slate-600 text-xs text-right opacity-40">لا توجد سجلات</p> : txs.map(t => (
                <div key={t.id} className="bg-black/40 p-5 rounded-[2.2rem] border border-white/5 flex flex-row-reverse items-center justify-between shadow-xl">
                   <div className="flex items-center gap-4 flex-row-reverse text-right flex-1">
                      <div>
                         <p className="text-white font-black text-xs uppercase italic truncate">{t.type === 'deposit' ? 'إيداع' : t.type === 'withdrawal' ? 'سحب' : 'مهمة'}</p>
                         <p className="text-[8px] text-slate-500 font-bold mt-0.5">{new Date(t.date).toLocaleDateString()}</p>
                         {t.details && <p className="text-[9px] text-blue-400 font-black mt-1 line-clamp-2 italic">{t.details}</p>}
                      </div>
                   </div>
                   <div className="text-left shrink-0 ml-4">
                      <p className={`text-sm font-black italic ${t.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {Math.abs(t.amount).toFixed(2)} {t.amount > 0 ? '+' : '-'}
                      </p>
                      <p className={`text-[7px] font-black uppercase tracking-widest mt-0.5 text-right opacity-60`}>{t.status}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
       </div>
    </div>
  );
}

function AdminView({ showToast, adminUUID, onOpenChatWithUser }: any) {
  const [mainTab, setMainTab] = useState<'deposit' | 'messages' | 'withdraw' | 'members'>('members');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserDetails, setSelectedUserDetails] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === 'members') {
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setData(users || []);
      } else if (mainTab === 'messages') {
        const { data: adminProf } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
        const currentId = adminProf?.id || adminUUID;
        if (!currentId) { setLoading(false); return; }

        const { data: msgs, error: mErr } = await supabase
          .from('support_messages')
          .select('*')
          .or(`sender_id.eq.${currentId},receiver_id.eq.${currentId}`)
          .order('created_at', { ascending: false });
        
        if (mErr) throw mErr;

        if (msgs && msgs.length > 0) {
          const partyIds = Array.from(new Set(msgs.flatMap(m => [m.sender_id, m.receiver_id])));
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', partyIds);
          const uniqueConversations: any[] = [];
          const seenParties = new Set();
          msgs.forEach(m => {
            const otherPartyId = m.sender_id === currentId ? m.receiver_id : m.sender_id;
            if (otherPartyId && otherPartyId !== currentId && !seenParties.has(otherPartyId)) {
              seenParties.add(otherPartyId);
              const counterparty = profiles?.find(p => p.id === otherPartyId);
              uniqueConversations.push({ ...m, counterparty });
            }
          });
          setData(uniqueConversations);
        } else { setData([]); }
      } else {
        const typeStr = mainTab === 'deposit' ? 'deposit' : 'withdrawal';
        let query = supabase.from('transactions').select('*').eq('type', typeStr);
        if (subTab === 'new') query = query.eq('status', 'pending');
        else query = query.in('status', ['completed', 'failed']);
        
        const { data: txs, error: txErr } = await query.order('date', { ascending: false });
        if (txErr) throw txErr;

        if (txs && txs.length > 0) {
          const userIds = Array.from(new Set(txs.map(t => t.user_id)));
          const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
          const enriched = txs.map(t => ({
            ...t,
            profiles: profiles?.find(p => p.id === t.user_id) || null
          }));
          setData(enriched);
        } else { setData([]); }
      }
    } catch (e: any) { 
      console.error(`Admin ${mainTab} Error:`, e);
      showToast(e.message || "خطأ في التحميل", "error"); 
    } 
    finally { setLoading(false); }
  }, [mainTab, subTab, showToast, adminUUID]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('admin-updates-main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item => {
      const profile = item.profiles || item.counterparty || item;
      return (
        profile?.first_name?.toLowerCase().includes(term) ||
        profile?.email?.toLowerCase().includes(term) ||
        profile?.id?.toLowerCase().includes(term)
      );
    });
  }, [data, searchTerm]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      const { error: txErr } = await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      if (txErr) throw txErr;
      const { data: profile } = await supabase.from('profiles').select('balance, withdrawable_balance, total_recharge').eq('id', tx.user_id).single();
      if (profile) {
        if (tx.type === 'deposit' && newStatus === 'completed') {
          await supabase.from('profiles').update({ 
            balance: Number(profile.balance) + Number(tx.amount),
            total_recharge: Number(profile.total_recharge) + Number(tx.amount)
          }).eq('id', tx.user_id);
        } else if (tx.type === 'withdrawal' && newStatus === 'failed') {
          const refundAmt = Math.abs(Number(tx.amount));
          await supabase.from('profiles').update({ 
            balance: Number(profile.balance) + refundAmt,
            withdrawable_balance: Number(profile.withdrawable_balance) + refundAmt
          }).eq('id', tx.user_id);
        }
      }
      showToast("تم التحديث بنجاح", "success");
      fetchData();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
       {selectedUserDetails && <UserDetailsModal userId={selectedUserDetails} onClose={() => setSelectedUserDetails(null)} showToast={showToast} />}
       
       <div className="bg-[#0b1424] p-4 rounded-[2.5rem] border border-white/5 flex flex-row-reverse gap-3 shadow-2xl overflow-x-auto no-scrollbar">
         {['deposit', 'withdraw', 'messages', 'members'].map((tab: any) => (
           <button key={tab} onClick={() => { setMainTab(tab as any); setSubTab('new'); setSearchTerm(''); }} className={`flex-1 min-w-[85px] py-4 rounded-2xl font-black text-[12px] uppercase transition-all tracking-widest ${mainTab === tab ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-400'}`}>
             {tab === 'deposit' ? 'إيداع' : tab === 'messages' ? 'دردشات' : tab === 'withdraw' ? 'سحب' : 'أعضاء'}
           </button>
         ))}
       </div>

       <div className="relative group px-1">
         <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
         <input 
            type="text" 
            placeholder="بحث بالاسم، الإيميل أو المعرف..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b1424] border border-white/5 p-5 pr-14 rounded-[2rem] text-right font-bold text-xs text-white outline-none focus:border-blue-500/50 shadow-inner"
         />
       </div>

       {(mainTab === 'deposit' || mainTab === 'withdraw') && (
         <div className="flex flex-row-reverse justify-center gap-4 bg-[#0b1424]/40 p-2 rounded-3xl border border-white/5 mx-1">
            <button onClick={() => setSubTab('new')} className={`flex-1 py-3.5 rounded-2xl font-black text-xs transition-all ${subTab === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'bg-black/30 text-slate-500'}`}>الجديدة</button>
            <button onClick={() => setSubTab('archive')} className={`flex-1 py-3.5 rounded-2xl font-black text-xs transition-all ${subTab === 'archive' ? 'bg-blue-600 text-white shadow-lg' : 'bg-black/30 text-slate-500'}`}>الأرشيف</button>
         </div>
       )}

       {loading ? <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div> : (
         <div className="space-y-5">
           {filteredData.length === 0 ? <p className="text-center text-slate-600 text-xs py-10 italic">لا توجد نتائج مطابقة</p> : filteredData.map(item => {
              const profile = item.profiles || item.counterparty || (mainTab === 'members' ? item : null);
              const displayName = profile?.first_name || "مستخدم مجهول";
              const currentUserId = profile?.id || item.id || item.user_id;

              return (
                <div key={item.id} onClick={() => {
                  if (mainTab !== 'messages') setSelectedUserDetails(currentUserId);
                  if (mainTab === 'messages') onOpenChatWithUser(currentUserId);
                }} className={`bg-[#0b1424] p-8 rounded-[3.5rem] border border-white/10 space-y-6 shadow-2xl transition-all cursor-pointer active:scale-95 mx-1`}>
                   <div className="flex flex-row-reverse justify-between items-center text-right">
                      <div className="flex items-center gap-5 flex-row-reverse">
                         <div className="w-16 h-16 bg-blue-600 rounded-[1.8rem] flex items-center justify-center text-white font-black italic text-2xl shadow-inner border border-white/10 uppercase">{displayName[0]}</div>
                         <div className="text-right">
                            <h5 className="text-white font-black italic uppercase tracking-tighter text-xl">{displayName}</h5>
                            <p className="text-[11px] text-slate-500 font-mono tracking-wider truncate max-w-[150px]">{profile?.email}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         {mainTab !== 'messages' ? (
                           <>
                             <p className="text-2xl font-black text-blue-500 italic tracking-tighter uppercase">{Math.abs(item.amount || item.balance || 0).toFixed(1)}</p>
                             <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">USDT</p>
                           </>
                         ) : (
                           <div className="flex flex-col items-end gap-1">
                             <p className="text-[10px] text-slate-500 font-bold">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                             {(item.receiver_id === adminUUID && !item.is_read) && <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>}
                           </div>
                         )}
                      </div>
                   </div>
                   {mainTab === 'messages' && <p className="text-slate-400 text-xs text-right opacity-80 italic line-clamp-1">{item.message}</p>}
                   {item.details && <p className="text-[10px] text-blue-500 text-right italic font-black">{item.details}</p>}
                   {item.proof_url && <img src={item.proof_url} className="w-full h-64 object-contain rounded-[2.5rem] bg-black/40 border border-white/5 shadow-2xl" alt="Proof" />}
                   {mainTab !== 'members' && mainTab !== 'messages' && item.status === 'pending' && (
                      <div className="flex flex-row-reverse gap-4 pt-4">
                         <button onClick={(e) => { e.stopPropagation(); handleTx(item, 'completed'); }} className="flex-1 bg-white text-black py-5 rounded-[1.8rem] font-black uppercase text-xs hover:bg-slate-100">موافقة</button>
                         <button onClick={(e) => { e.stopPropagation(); handleTx(item, 'failed'); }} className="flex-1 bg-red-600/10 text-red-500 py-5 rounded-[1.8rem] font-black uppercase text-xs hover:bg-red-500/20">رفض</button>
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

// --- Team Network View ---
function TeamView({ user, showToast }: any) {
  const referralLink = `${window.location.origin}${window.location.pathname}#/auth?ref=${user.referral_code}`;

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="bg-[#0b1424] p-10 rounded-[3.5rem] border border-blue-500/10 shadow-2xl relative overflow-hidden flex flex-row-reverse items-center justify-between">
         <div className="text-right relative z-10">
            <h3 className="text-white font-black text-3xl italic uppercase tracking-tighter">شبكة الفريق</h3>
            <p className="text-[10px] text-blue-500 font-black tracking-widest mt-1 uppercase">REFERRAL NETWORK: ACTIVE</p>
         </div>
         <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
            <Users size={40} />
         </div>
      </div>

      <div className="bg-[#0b1424] p-8 rounded-[3rem] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl">
        <div className="text-right space-y-3">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">كود الإحالة الخاص بك</p>
          <div className="bg-black/40 p-6 rounded-[2rem] text-center border border-white/5 flex flex-row-reverse items-center justify-between shadow-inner">
            <span className="text-2xl font-black text-white italic tracking-[0.2em]">{user.referral_code || '---'}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(user.referral_code);
                showToast("تم نسخ كود الإحالة", "success");
              }}
              className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg active:scale-90 transition-all hover:bg-blue-500"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        <div className="text-right space-y-3">
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">رابط الدعوة السريع</p>
          <div className="bg-black/40 p-6 rounded-[2rem] text-right border border-white/5 flex flex-row-reverse items-center justify-between gap-4 shadow-inner">
            <p className="text-[10px] font-mono text-slate-400 truncate flex-1">{referralLink}</p>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                showToast("تم نسخ رابط الدعوة", "success");
              }}
              className="p-4 bg-white/10 text-white rounded-2xl shadow-lg active:scale-90 transition-all shrink-0 hover:bg-white/20"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-[#0b1424] p-8 rounded-[2.5rem] border border-white/5 text-center shadow-lg">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">أرباح الفريق</p>
            <p className="text-2xl font-black text-emerald-500 italic uppercase">USDT {(user.referralEarnings || 0).toFixed(2)}</p>
         </div>
         <div className="bg-[#0b1424] p-8 rounded-[2.5rem] border border-white/5 text-center shadow-lg">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">نسبة المكافأة</p>
            <p className="text-2xl font-black text-blue-500 italic uppercase">%{REFERRAL_PERCENT * 100}</p>
         </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 p-8 rounded-[3.5rem] text-right space-y-4 shadow-2xl">
        <div className="flex items-center gap-3 flex-row-reverse">
          <Award size={20} className="text-blue-500" />
          <h4 className="text-white font-black italic text-lg uppercase tracking-tighter">نظام المكافآت التراكمي</h4>
        </div>
        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
          عند دعوة أعضاء جدد للتسجيل عبر رابطك، ستحصل على مكافأة فورية قدرها {REFERRAL_PERCENT * 100}% من قيمة كل إيداع يقومون به. تُضاف الأرباح مباشرة إلى رصيدك القابل للسحب دون أي شروط إضافية. ابدأ ببناء فريقك الآن وزد أرباحك اليومية.
        </p>
      </div>
    </div>
  );
}

const ProfileView = ({ user }: any) => (
  <div className="space-y-6 pb-10 text-right animate-in fade-in">
    <div className="flex flex-col items-center py-12 relative">
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-600/5 blur-3xl rounded-full"></div>
       <div className="w-28 h-28 rounded-[2.8rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black italic shadow-2xl border-4 border-[#020617] uppercase">{user.first_name?.[0]}</div>
       <h3 className="text-3xl font-black mt-6 italic uppercase text-white tracking-tighter">{user.first_name}</h3>
       <p className="text-xs text-slate-500 font-mono mt-1 opacity-60 tracking-[0.2em] uppercase">{user.email}</p>
    </div>
    <div className="bg-[#0b1424] p-2 rounded-[3.5rem] border border-white/5 shadow-2xl">
       <div className="flex flex-row-reverse justify-between items-center p-8 border-b border-white/5">
          <div className="flex items-center gap-4 flex-row-reverse">
            <Wallet size={22} className="text-blue-500" />
            <span className="text-[13px] uppercase text-slate-500 font-black tracking-widest italic">الرصيد الكلي</span>
          </div>
          <span className="text-lg font-black text-white italic">{(user.balance || 0).toFixed(2)} USDT</span>
       </div>
       <div className="flex flex-row-reverse justify-between items-center p-8 border-b border-white/5">
          <div className="flex items-center gap-4 flex-row-reverse">
            <Zap size={22} className="text-emerald-500" />
            <span className="text-[13px] uppercase text-slate-500 font-black tracking-widest italic">إجمالي الإيداع</span>
          </div>
          <span className="text-lg font-black text-emerald-500 italic">{(user.totalRecharge || 0).toFixed(2)} USDT</span>
       </div>
    </div>
    <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 py-6 rounded-[2.5rem] font-black uppercase border border-red-500/10 shadow-2xl active:scale-95 transition-all tracking-[0.2em]">تسجيل الخروج</button>
  </div>
);

const AuthView = ({ lang, showToast }: any) => {
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref') || '';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState(refFromUrl);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, password, options: { data: { first_name: firstName || 'User', referral_code_input: referralCodeInput } }
        });
        if (error) throw error;
        showToast("نجح التسجيل، يمكنك تسجيل الدخول الآن", "success");
        setIsLogin(true);
      }
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-16 animate-in zoom-in duration-700 relative z-10 text-center">
        <div className="space-y-8">
          <div className="w-32 h-32 bg-blue-600 rounded-[2.8rem] flex items-center justify-center text-white mx-auto shadow-2xl animate-float border-4 border-blue-500/30">
            <Zap size={64} className="fill-current" />
          </div>
          <h1 className="text-7xl font-black italic text-white tracking-tighter">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em]">نظام التعدين الذكي والمتطور</p>
        </div>

        <div className="bg-[#0b1424]/60 backdrop-blur-3xl p-10 rounded-[4.5rem] border border-white/10 space-y-12 shadow-2xl">
          <div className="flex flex-row-reverse gap-2 p-1.5 bg-black/40 rounded-[1.8rem] shadow-inner">
             <button onClick={() => setIsLogin(true)} className={`flex-1 py-4.5 rounded-[1.5rem] font-black text-xs transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-400'}`}>تسجيل الدخول</button>
             <button onClick={() => setIsLogin(false)} className={`flex-1 py-4.5 rounded-[1.5rem] font-black text-xs transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-400'}`}>إنشاء حساب</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-8 text-right">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase px-2">الاسم بالكامل</label>
                  <input type="text" placeholder="أدخل اسمك" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right shadow-inner" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-black uppercase px-2">كود الإحالة</label>
                  <input type="text" placeholder="كود الإحالة" value={referralCodeInput} onChange={e => setReferralCodeInput(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right shadow-inner" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">البريد الإلكتروني</label>
              <input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right shadow-inner" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-black uppercase px-2">كلمة المرور</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2.2rem] text-white outline-none text-right shadow-inner" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 py-7 rounded-[2.5rem] font-black text-white uppercase text-lg shadow-2xl active:scale-95 transition-all tracking-widest">
              {loading ? <Loader2 className="animate-spin" size={28} /> : (isLogin ? "تسجيل الدخول" : "إنشاء حساب")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- Support Chat Modal ---
function SupportChatModal({ onClose, userId, initialAdminId, targetUserId }: any) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const otherPartyId = targetUserId || initialAdminId;

  const fetchMessages = useCallback(async () => {
    if (!userId || !otherPartyId) return;
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherPartyId}),and(sender_id.eq.${otherPartyId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }, [userId, otherPartyId]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase.channel(`chat-v2-${[userId, otherPartyId].sort().join('-')}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages'
      }, (payload) => {
        const msg = payload.new as SupportMessage;
        if (
          (msg.sender_id === userId && msg.receiver_id === otherPartyId) ||
          (msg.sender_id === otherPartyId && msg.receiver_id === userId)
        ) {
          setMessages(prev => {
             if (prev.find(m => m.id === msg.id)) return prev;
             return [...prev, msg];
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchMessages, userId, otherPartyId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !otherPartyId) return;
    const text = newMessage;
    setNewMessage('');
    try {
      await supabase.from('support_messages').insert({
        sender_id: userId,
        receiver_id: otherPartyId,
        message: text,
        created_at: new Date().toISOString()
      });
      fetchMessages();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/98 flex flex-col animate-in slide-in-from-bottom duration-300 backdrop-blur-3xl">
      <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0b1424] sticky top-0 z-10">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl shadow-lg hover:bg-white/10 transition-all"><X size={24}/></button>
        <div className="text-center">
          <h3 className="font-black text-white italic tracking-widest uppercase text-xl">الدعم المباشر</h3>
          <p className="text-[10px] text-blue-500 font-black animate-pulse">قناة تواصل فورية مشفرة</p>
        </div>
        <div className="w-12"></div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20"><MessageCircle size={64} className="mb-4" /><p className="font-black uppercase text-xs">ابدأ المحادثة الآن</p></div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-[2.5rem] shadow-xl ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#0b1424] text-slate-200 border border-white/5 rounded-tl-none'}`}>
                <p className="text-sm font-bold leading-relaxed">{m.message}</p>
                <p className="text-[8px] opacity-40 mt-2 font-black text-left">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-8 bg-[#0b1424] border-t border-white/10 sticky bottom-0">
        <div className="max-w-md mx-auto relative">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="اكتب رسالتك..." className="w-full bg-black/40 border border-white/10 p-6 pr-20 rounded-[2rem] text-white outline-none focus:border-blue-500/50 shadow-inner italic text-right" />
          <button onClick={sendMessage} className="absolute right-3 top-1/2 -translate-y-1/2 p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all hover:bg-blue-500"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
}

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
        setUserData({
          ...profile,
          email: userEmail,
          withdrawableBalance: profile.withdrawable_balance || 0,
          totalRecharge: profile.total_recharge || 0,
          totalWithdraw: profile.total_withdraw || 0,
          referralEarnings: profile.referral_earnings || 0,
          ownedMachines: (machinesRes.data || []).filter(m => m.remaining_days > 0),
          transactions: txsRes.data || [],
          lastWithdrawDate: null,
          created_at: profile.created_at
        });
        
        // Show welcome modal once session data is loaded
        if (!isManual) {
           const hasSeen = localStorage.getItem(`welcome_seen_${userId}`);
           if (!hasSeen) {
             setShowWelcome(true);
             localStorage.setItem(`welcome_seen_${userId}`, 'true');
           }
        }
      }
      if (userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) setAdminUUID(userId);
      else {
         const { data: admin } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
         if (admin) setAdminUUID(admin.id);
      }
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
    if (userData.balance < machine.price) return showToast("عذراً، الرصيد غير كافٍ لتفعيل هذا العقد", "error");
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').insert({ user_id: session.user.id, machine_id: machine.id, remaining_days: machine.duration, total_earned: 0 });
      if (machine.price > 0) await supabase.from('profiles').update({ balance: Number(userData.balance) - machine.price }).eq('id', session.user.id);
      showToast("تم تفعيل بروتوكول التعدين بنجاح", "success");
      fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, "error"); }
    finally { setIsProcessing(false); }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || isProcessing) return;
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    if (Date.now() - lastClaim < 24 * 60 * 60 * 1000) return showToast("الحصاد متاح مرة كل 24 ساعة فقط", "error");
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').update({ last_claim_date: new Date().toISOString(), total_earned: (um.total_earned || 0) + machine.dailyProfit, remaining_days: Math.max(0, um.remaining_days - 1) }).eq('id', um.id);
      await supabase.from('profiles').update({ balance: Number(userData.balance) + machine.dailyProfit, withdrawable_balance: Number(userData.withdrawableBalance) + machine.dailyProfit }).eq('id', session.user.id);
      showToast("تم حصاد أرباح اليوم بنجاح", "success");
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
      
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} userData={userData} userId={session.user.id} showToast={showToast} />}
      {(showSupport || adminTargetUserId) && <SupportChatModal onClose={() => { setShowSupport(false); setAdminTargetUserId(null); }} userId={session.user.id} initialAdminId={adminUUID} targetUserId={adminTargetUserId} />}
      
      {/* Toast System */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[800] w-full max-w-[90%] space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.5)] pointer-events-auto backdrop-blur-3xl border animate-in slide-in-from-top-4 duration-300 ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-100' : toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100' : 'bg-blue-600/20 border-blue-500/30 text-blue-50'}`}>
            {toast.type === 'error' ? <AlertCircle size={20} /> : toast.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
            <span className="text-[14px] font-bold">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="px-6 py-6 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex flex-row-reverse justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-blue-500 fill-blue-500" />
          <span className="font-black italic text-2xl tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => supabase.auth.signOut()} className="p-3 bg-red-500/10 text-red-500 rounded-2xl shadow-lg hover:bg-red-500/20 transition-all"><LogOut size={24} /></button>
           <button onClick={() => setShowSupport(true)} className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl shadow-lg relative"><MessageCircle size={24} /></button>
           <button onClick={() => fetchAllUserData(session.user.id, session.user.email || '', true)} className={`p-3 bg-blue-500/10 text-blue-400 rounded-2xl ${syncing ? 'animate-spin' : ''} shadow-lg`}><RefreshCw size={24} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-8">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={(k: string) => TRANSLATIONS[k]?.[lang] || k} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} onShowSupport={() => setShowSupport(true)} />} />
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
          <NavItem icon={HomeIcon} label="الرئيسية" active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label="الماكينات" active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label="المهام" active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? (
            <NavItem icon={Settings} label="الإدارة" active={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
          ) : (
            <NavItem icon={Users} label="الفريق" active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          )}
          <NavItem icon={UserIcon} label="الملف" active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
}
