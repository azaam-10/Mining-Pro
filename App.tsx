
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, X, Copy, Zap, Settings, RefreshCw, 
  MessageCircle, Send, LogOut, TrendingUp, Activity, Info, 
  History, ArrowUpRight, Award, Layers,
  ExternalLink, Calendar, AlertCircle, Headphones, Plus, Minus, Lock, Image as ImageIcon,
  Coins, Shield, BadgeCheck, LifeBuoy
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, REFERRAL_PERCENT, NETWORK } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>(() => {
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ar' ? 'ar' : 'en';
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);
  const [adminUUID, setAdminUUID] = useState<string | null>(null);

  const showToast = useCallback((message: any, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    let finalMsg = typeof message === 'string' ? message : message?.message || "Error";
    setToasts(prev => [...prev, { message: finalMsg, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchAdminUUID = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('id').eq('email', ADMIN_EMAIL).maybeSingle();
      if (data) setAdminUUID(data.id);
    } catch (e) {}
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
      if (!profile) {
        const { data: newProfile, error } = await supabase.from('profiles').insert([{ id: userId, balance: 0, withdrawable_balance: 0, referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(), first_name: 'User', email: userEmail }]).select().single();
        if (error) throw error;
        profile = newProfile;
      }
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
        await fetchAdminUUID();
      }
    } catch (err: any) { showToast(err, "error"); } 
    finally { setLoading(false); setSyncing(false); }
  }, [showToast, fetchAdminUUID]);

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
    const activeSame = userData.ownedMachines.some(m => m.machine_id === machine.id);
    if (activeSame) return showToast(lang === 'ar' ? "تملك هذه الماكينة بالفعل، انتظر انتهاء العقد" : "Contract active, wait for expiry", "error");
    if (userData.balance < machine.price) return showToast(lang === 'ar' ? "الرصيد غير كافٍ" : "Insufficient funds", "error");
    
    setIsProcessing(true);
    try {
      const { error: buyErr } = await supabase.from('user_machines').insert({ user_id: session.user.id, machine_id: machine.id, remaining_days: machine.duration, total_earned: 0 });
      if (buyErr) throw buyErr;
      await supabase.from('profiles').update({ balance: Number(userData.balance) - machine.price }).eq('id', session.user.id);
      showToast(lang === 'ar' ? "تم التفعيل بنجاح" : "Activated", "success");
      fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, "error"); }
    finally { setIsProcessing(false); }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || isProcessing) return;
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    if (Date.now() - lastClaim < 24 * 60 * 60 * 1000) return showToast(lang === 'ar' ? "متاح مرة كل 24 ساعة" : "Claim once every 24h", "error");
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    setIsProcessing(true);
    try {
      await supabase.from('user_machines').update({ last_claim_date: new Date().toISOString(), total_earned: (um.total_earned || 0) + machine.dailyProfit, remaining_days: Math.max(0, um.remaining_days - 1) }).eq('id', um.id);
      await supabase.from('profiles').update({ balance: Number(userData.balance) + machine.dailyProfit, withdrawable_balance: Number(userData.withdrawableBalance) + machine.dailyProfit }).eq('id', session.user.id);
      showToast("Success", "success");
      fetchAllUserData(session.user.id, session.user.email!);
    } catch (e) { showToast(e, "error"); }
    finally { setIsProcessing(false); }
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  if (loading) return <ProtocolLoadingScreen />;
  if (!session) return <AuthView lang={lang} t={t} showToast={showToast} />;
  if (!userData) return <ProtocolLoadingScreen />;

  return (
    <div className={`min-h-screen pb-24 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {isProcessing && <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>}
      
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} lang={lang} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} userData={userData} userId={session.user.id} showToast={showToast} lang={lang} />}
      {showSupport && <SupportChatModal lang={lang} onClose={() => setShowSupport(false)} userId={session.user.id} initialAdminId={adminUUID} showToast={showToast} />}
      
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-[90%] space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-3xl border border-white/10 animate-in slide-in-from-top duration-300 ${toast.type === 'error' ? 'bg-red-500/30 text-red-100 border-red-500/20' : 'bg-blue-600/30 text-blue-50 border-blue-500/20'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
               {toast.type === 'error' ? <AlertCircle size={16} /> : <BadgeCheck size={16} />}
            </div>
            <span className="text-[13px] font-bold leading-tight">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="px-4 py-5 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-red-500/10 text-red-500 rounded-2xl transition-all"><LogOut size={22} /></button>
           <button onClick={() => setShowSupport(true)} className="flex items-center gap-2 p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl group relative">
             <MessageCircle size={22} />
             <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#020617] animate-bounce"></div>
           </button>
           <button onClick={() => fetchAllUserData(session.user.id, session.user.email || '', true)} className={`p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl ${syncing ? 'animate-spin' : ''}`}><RefreshCw size={22} /></button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-black italic text-xl tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span>
          <Zap size={20} className="text-blue-500 fill-blue-500" />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} onShowSupport={() => setShowSupport(true)} lang={lang} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} lang={lang} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} lang={lang} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} lang={lang} showToast={showToast} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} lang={lang} />} />
          <Route path="/admin" element={userData.email === ADMIN_EMAIL ? <AdminView adminId={session.user.id} t={t} showToast={showToast} lang={lang} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-xl border-t border-white/5 p-4 z-40 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          {userData.email === ADMIN_EMAIL ? (
            <NavItem icon={Settings} label={t('adminTool')} active={location.pathname === '/admin'} onClick={() => navigate('/admin')} />
          ) : (
            <NavItem icon={Users} label={t('team')} active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          )}
          <NavItem icon={UserIcon} label={t('profile')} active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
};

// --- View Components ---

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, onShowSupport, lang }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Card for Balance with 2 main buttons */}
      <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/10 p-8 rounded-[2.5rem] text-white border border-white/5 shadow-2xl relative overflow-hidden group">
         <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 italic">{t('balanceTitle')}</p>
                  <h2 className="text-4xl font-black italic tracking-tight">{(user.balance || 0).toFixed(2)} <span className="text-xl opacity-50 not-italic uppercase ml-1">USDT</span></h2>
               </div>
               <TrendingUp size={28} className="opacity-50" />
            </div>
            <div className="flex gap-4 pt-2">
               <button onClick={onShowRecharge} className="flex-1 bg-white text-blue-700 py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all">{t('recharge')}</button>
               <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all">{t('withdraw')}</button>
            </div>
         </div>
      </div>

      {/* Stuck Funds Card - matches the dark purple/red design in screenshot */}
      <div className="w-full bg-[#1e143b] p-7 rounded-[2.5rem] border border-white/5 flex flex-col gap-5 relative group overflow-hidden">
        <div className="flex justify-between items-start">
           <div className="flex-1 space-y-2">
              <h4 className="text-white font-black text-lg uppercase italic tracking-tight">{t('stuckFunds')}</h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{t('stuckFundsDesc')}</p>
           </div>
           <div className="w-14 h-14 bg-red-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
              <AlertCircle size={32} />
           </div>
        </div>
        <button onClick={onShowSupport} className="w-fit bg-white text-[#1e143b] px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all">
           {t('requestHelpBtn')}
           <MessageCircle size={14} className="fill-current opacity-30" />
        </button>
      </div>

      {/* Secure System Card - matches the green design in screenshot */}
      <div className="w-full bg-[#064e3b]/30 p-7 rounded-[2.5rem] border border-emerald-500/20 flex flex-col gap-4 relative group">
        <div className="flex justify-between items-start">
           <div className="flex-1 space-y-2">
              <h4 className="text-emerald-400 font-black text-lg uppercase italic tracking-tight">{t('secureSystem')}</h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{t('secureSystemDesc')}</p>
           </div>
           <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <ShieldCheck size={28} />
           </div>
        </div>
      </div>

      {/* Need Help Card - matches the blue card with headphone icon in screenshot */}
      <div className="w-full bg-[#0f172a] p-7 rounded-[2.5rem] border border-blue-500/10 flex flex-col gap-5 relative group">
        <div className="flex justify-between items-start">
           <div className="flex-1 space-y-2">
              <h4 className="text-white font-black text-lg uppercase italic tracking-tight">{t('needHelp')}</h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{t('needHelpDesc')}</p>
           </div>
           <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Headphones size={32} />
           </div>
        </div>
        <button onClick={onShowSupport} className="w-fit bg-white text-[#0f172a] px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all">
           {t('talkToUsBtn')}
        </button>
      </div>

      {/* History Section */}
      <div className="space-y-4 pt-2">
         <div className="flex justify-between items-center px-1">
            <h4 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.2em] italic">{t('historyTitle')}</h4>
            <History size={16} className="text-slate-600" />
         </div>
         <div className="space-y-3">
            {user.transactions.slice(0, 3).map((tx: any) => (
               <div key={tx.id} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-4">
                     <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'deposit' ? <Zap size={20} /> : tx.type === 'withdrawal' ? <ExternalLink size={20} /> : <TrendingUp size={20} />}
                     </div>
                     <div>
                        <p className="text-white font-black text-xs uppercase italic">{String(tx.type)}</p>
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">{new Date(tx.date).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={`font-black text-lg italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}</p>
                     <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${tx.status === 'completed' ? 'text-emerald-600' : 'text-orange-500'}`}>{tx.status}</p>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const RechargeModal = ({ onClose, onDeposit, showToast, userId, lang }: any) => {
  const [amount, setAmount] = useState('0.00');
  const [txid, setTxid] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProof(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!txid || !proof) return showToast(lang === 'ar' ? 'يرجى إدخال تفاصيل الدفع وإرفاق الصورة' : 'Enter ID and attach proof', 'error');
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', details: txid, proof_url: proof });
      showToast(lang === 'ar' ? "تم إرسال الطلب بنجاح" : "Deposit protocol initiated", "success");
      onDeposit();
      onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in">
       <div className="bg-[#111827] w-full max-w-md rounded-[3rem] border border-white/10 p-8 space-y-7 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <button onClick={onClose} className="absolute top-6 right-6 p-2.5 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20}/></button>
          
          <div className="text-center space-y-1">
             <h3 className="text-2xl font-black italic tracking-widest text-white uppercase">{lang === 'ar' ? 'شحن الرصيد' : 'RECHARGE'}</h3>
             <p className="text-[10px] text-blue-500 font-black tracking-widest uppercase opacity-70">NETWORK: {NETWORK}</p>
          </div>

          <div className="bg-[#1f2937]/50 p-5 rounded-3xl border border-white/5 flex items-center justify-between gap-3 group">
             <p className="text-[11px] font-mono text-blue-400 break-all select-all flex-1">{DEPOSIT_ADDRESS}</p>
             <button onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('Address Copied', 'success'); }} className="p-2.5 bg-blue-600/20 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Copy size={16}/></button>
          </div>

          <div className="space-y-2 text-center">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{lang === 'ar' ? 'المبلغ المودع' : 'DEPOSITED AMOUNT'}</p>
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border-none outline-none text-4xl font-black italic text-center py-6 rounded-3xl text-white placeholder-white/20" placeholder="0.00" />
          </div>

          <div className="bg-blue-600/10 p-5 rounded-3xl border border-blue-500/20 flex items-start gap-4">
             <Info size={24} className="text-blue-500 shrink-0 mt-1" />
             <p className="text-[10px] text-blue-100 font-bold leading-relaxed">{lang === 'ar' ? 'يجب إرفاق لقطة شاشة واضحة من محفظتك توضح تفاصيل عملية التحويل (مكتملة) لضمان سرعة معالجة الطلب.' : 'A clear screenshot showing transfer details (Completed) is mandatory for processing.'}</p>
          </div>

          <div className="space-y-3">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest text-center">{lang === 'ar' ? 'إرفاق لقطة شاشة للإثبات' : 'ATTACH SCREENSHOT FOR PROOF'}</p>
             <div onClick={() => fileRef.current?.click()} className="w-full h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer group hover:border-blue-500/50 transition-all overflow-hidden relative">
                {proof ? <img src={proof} className="w-full h-full object-cover" /> : <>
                  <ImageIcon size={32} className="text-slate-600 mb-2 group-hover:text-blue-500" />
                  <p className="text-[11px] text-slate-500 font-black uppercase group-hover:text-blue-400">{lang === 'ar' ? 'اضغط لاختيار صورة' : 'Click to select image'}</p>
                </>}
             </div>
             <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          <div className="flex items-center justify-center gap-2 py-3 border-t border-white/5 opacity-50">
             <Lock size={12} className="text-emerald-500" />
             <p className="text-[9px] font-black uppercase text-emerald-500 tracking-tighter">{lang === 'ar' ? 'بروتوكول تشفير الإيداع نشط ومؤمن بالكامل' : 'Deposit encryption protocol fully active and secure'}</p>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-blue-600 py-5 rounded-[2rem] font-black text-white uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all">
             {loading ? <Loader2 className="animate-spin mx-auto" /> : (lang === 'ar' ? 'تأكيد' : 'CONFIRM PROTOCOL')}
          </button>
       </div>
    </div>
  );
};

const UserDetailsModal = ({ userId, onClose, lang, showToast }: any) => {
  const [u, setU] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amountInput, setAmountInput] = useState('');

  const fetchUser = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setU(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const modifyBalance = async (op: 'add' | 'sub') => {
    const val = Number(amountInput);
    if (isNaN(val) || val <= 0) return showToast("Invalid amount", "error");
    try {
      const newBal = op === 'add' ? Number(u.balance) + val : Number(u.balance) - val;
      const { error } = await supabase.from('profiles').update({ balance: newBal, withdrawable_balance: Math.max(0, op === 'add' ? Number(u.withdrawable_balance) + val : Number(u.withdrawable_balance) - val) }).eq('id', userId);
      if (error) throw error;
      showToast("Protocol updated", "success");
      setAmountInput('');
      fetchUser();
    } catch (e: any) { showToast(e, "error"); }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in">
       <div className="bg-[#0b0f1a] w-full max-w-md rounded-[3rem] border border-white/10 p-8 space-y-6 relative overflow-y-auto max-h-[90vh] shadow-2xl">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-2xl text-slate-400"><X size={20}/></button>
          
          <div className="text-center space-y-2">
             <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-3xl font-black italic mx-auto shadow-xl">{u.first_name[0]}</div>
             <h4 className="text-white font-black uppercase italic text-lg">{u.first_name}</h4>
             <p className="text-[10px] text-slate-500 font-mono tracking-widest">{u.email}</p>
          </div>

          <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 space-y-4">
             <InfoRow label="Balance" value={`${u.balance.toFixed(2)} USDT`} />
             <InfoRow label="Withdrawable" value={`${u.withdrawable_balance.toFixed(2)} USDT`} />
             <InfoRow label="Total Deposits" value={`${u.total_recharge.toFixed(2)} USDT`} />
             <InfoRow label="Total Withdrawals" value={`${u.total_withdraw.toFixed(2)} USDT`} />
             <InfoRow label="Referral Earn" value={`${u.referral_earnings.toFixed(2)} USDT`} />
             <InfoRow label="Registration" value={new Date(u.created_at).toLocaleDateString()} />
          </div>

          <div className="space-y-4 pt-2">
             <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none text-2xl font-black italic text-center" />
             <div className="flex gap-4">
                <button onClick={() => modifyBalance('add')} className="flex-1 bg-emerald-600 py-4.5 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Plus size={16}/> ADD FUNDS</button>
                <button onClick={() => modifyBalance('sub')} className="flex-1 bg-red-600 py-4.5 rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Minus size={16}/> SUBTRACT</button>
             </div>
          </div>
       </div>
    </div>
  );
};

const InfoRow = ({ label, value }: any) => (
  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-2">
     <span className="text-slate-500">{label}</span>
     <span className="text-blue-500">{value}</span>
  </div>
);

const AdminView = ({ adminId, t, showToast, lang }: any) => {
  const [mainTab, setMainTab] = useState<'deposit' | 'withdraw' | 'members' | 'messages'>('withdraw');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserDetails, setSelectedUserDetails] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === 'members') {
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setData(users || []);
      } else if (mainTab === 'messages') {
        const { data: msgs } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
        setData(msgs || []);
      } else {
        const typeStr = mainTab === 'deposit' ? 'deposit' : 'withdrawal';
        let txQuery = supabase.from('transactions').select('*').eq('type', typeStr);
        if (subTab === 'new') txQuery = txQuery.eq('status', 'pending');
        else txQuery = txQuery.in('status', ['completed', 'failed']);
        const { data: txs } = await txQuery.order('date', { ascending: false });
        if (txs) {
          const uids = txs.map(t => t.user_id);
          const { data: profs } = await supabase.from('profiles').select('id, first_name, email').in('id', uids);
          setData(txs.map(tx => ({ ...tx, profiles: profs?.find(p => p.id === tx.user_id) })));
        } else setData([]);
      }
    } catch (e: any) { showToast(e, "error"); } 
    finally { setLoading(false); }
  }, [mainTab, subTab, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      if (newStatus === 'completed' && tx.type === 'deposit') {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', tx.user_id).single();
        await supabase.from('profiles').update({ balance: Number(p.balance) + Number(tx.amount), total_recharge: Number(p.total_recharge) + Number(tx.amount) }).eq('id', tx.user_id);
      }
      showToast("Success", "success");
      fetchData();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="space-y-6">
       {selectedUserDetails && <UserDetailsModal userId={selectedUserDetails} onClose={() => setSelectedUserDetails(null)} lang={lang} showToast={showToast} />}
       <div className="bg-[#0b0f1a] p-2 rounded-2xl flex gap-1 shadow-2xl">
         {['deposit', 'withdraw', 'members'].map((tab: any) => (
           <button key={tab} onClick={() => setMainTab(tab as any)} className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider ${mainTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{tab}</button>
         ))}
       </div>
       <div className="space-y-4">
         {loading ? <Loader2 className="animate-spin mx-auto text-blue-500" /> : data.map(item => (
           <div key={item.id} onClick={() => mainTab === 'members' ? setSelectedUserDetails(item.id) : null} className="bg-[#0b0f1a] p-5 rounded-[2rem] border border-white/5 space-y-4 shadow-xl">
             <div className="flex justify-between items-start">
               <div>
                 <h5 className="text-white font-black text-xs uppercase italic">{item.profiles?.first_name || item.first_name || 'User'}</h5>
                 <p className="text-[9px] text-slate-600 font-mono truncate max-w-[150px]">{item.profiles?.email || item.email}</p>
               </div>
               <p className="text-lg font-black text-blue-500 italic">{item.amount || item.balance || 0} <span className="text-[8px] opacity-40">USDT</span></p>
             </div>
             {item.proof_url && (
               <div className="w-full h-48 rounded-2xl overflow-hidden border border-white/10"><img src={item.proof_url} className="w-full h-full object-cover" /></div>
             )}
             {item.status === 'pending' && (
               <div className="flex gap-2">
                 <button onClick={() => handleTx(item, 'completed')} className="flex-1 bg-emerald-600 py-3 rounded-xl text-[9px] font-black uppercase">Approve</button>
                 <button onClick={() => handleTx(item, 'failed')} className="flex-1 bg-red-600/10 text-red-500 py-3 rounded-xl text-[9px] font-black uppercase">Reject</button>
               </div>
             )}
           </div>
         ))}
       </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t, lang }: any) => {
  return (
    <div className="space-y-6 pb-10">
      {MACHINES.map(m => (
        <div key={m.id} className={`bg-gradient-to-br ${m.color === 'tier-bronze-fx' ? 'from-blue-900/40 to-black/80' : m.color === 'tier-gold-fx' ? 'from-purple-900/40 to-black/80' : 'from-rose-900/40 to-black/80'} p-8 rounded-[2.5rem] border border-white/10 space-y-5 shadow-2xl relative overflow-hidden`}>
           <div className="flex justify-between items-start relative z-10">
              <div>
                 <h4 className="text-white font-black text-xl italic uppercase tracking-tighter">{m.name}</h4>
                 <p className="text-[9px] text-emerald-400 font-black uppercase mt-1 tracking-widest">Yield: {m.dailyProfit} USDT / Day</p>
              </div>
              <p className="text-3xl font-black text-white italic">{m.price} <span className="text-xs opacity-40">USDT</span></p>
           </div>
           <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                 <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Total Earn</p>
                 <p className="text-lg font-black text-emerald-500 italic">{(m.dailyProfit * m.duration).toFixed(1)} <span className="text-[10px]">USDT</span></p>
              </div>
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                 <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Duration</p>
                 <p className="text-lg font-black text-blue-500 italic">{m.duration} <span className="text-[10px]">Days</span></p>
              </div>
           </div>
           <button onClick={() => onBuy(m)} className="w-full bg-white text-slate-900 py-4.5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-xl relative z-10">
              {t('buyNow')}
           </button>
        </div>
      ))}
    </div>
  );
};

const TasksView = ({ user, onComplete, t, lang }: any) => {
  return (
    <div className="space-y-4 pb-10">
      {user.ownedMachines.length === 0 ? (
        <div className="bg-[#0b0f1a] p-10 rounded-[2rem] border border-white/5 text-center">
           <p className="text-slate-700 font-black uppercase text-[10px] tracking-widest">No nodes connected</p>
        </div>
      ) : user.ownedMachines.map((um: UserMachine) => {
        const m = MACHINES.find(mach => mach.id === um.machine_id);
        const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
        const canClaim = Date.now() - lastClaim >= 24 * 60 * 60 * 1000;
        return (
          <div key={um.id} className="bg-[#0b0f1a] p-6 rounded-[2rem] border border-white/5 flex justify-between items-center shadow-xl">
             <div>
                <h4 className="text-white font-black text-xs uppercase italic">{m?.name}</h4>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Remaining: {um.remaining_days} days</p>
             </div>
             <button onClick={() => onComplete(um)} disabled={!canClaim} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase transition-all shadow-xl ${canClaim ? 'bg-emerald-600 text-white active:scale-95' : 'bg-white/5 text-slate-700'}`}>
                {canClaim ? t('completeTask') : 'Wait'}
             </button>
          </div>
        );
      })}
    </div>
  );
};

const TeamView = ({ user, t, lang, showToast }: any) => {
  return (
    <div className="space-y-6 pb-10">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-800 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
         <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Referral ID</p>
         <div className="flex items-center justify-between bg-white/10 p-5 rounded-[2rem] border border-white/20 mt-4 backdrop-blur-sm">
            <span className="text-2xl font-black italic tracking-widest">{user.referral_code}</span>
            <button onClick={() => { navigator.clipboard.writeText(user.referral_code); showToast("Copied", "success"); }} className="p-2.5 bg-white text-purple-700 rounded-xl"><Copy size={18}/></button>
         </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
         <StatCard icon={Award} label="Commission" value={user.referralEarnings} color="text-purple-500" bg="bg-purple-500/10" />
         <StatCard icon={Users} label="Team Members" value={0} color="text-blue-500" bg="bg-blue-500/10" />
      </div>
    </div>
  );
};

const ProfileView = ({ user, t, lang }: any) => {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col items-center py-8">
         <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-3xl font-black italic mb-4 shadow-2xl">{user.first_name[0]}</div>
         <h3 className="text-xl font-black italic uppercase tracking-tighter">{user.first_name}</h3>
         <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{user.email}</p>
      </div>
      <div className="bg-[#0b0f1a] p-4 rounded-[2.5rem] border border-white/5 space-y-4">
         <ProfileItem label="Deposits" value={`${user.totalRecharge.toFixed(2)} USDT`} icon={Zap} color="text-emerald-500" />
         <ProfileItem label="Total Withdraw" value={`${user.totalWithdraw.toFixed(2)} USDT`} icon={ExternalLink} color="text-red-500" />
         <ProfileItem label="Joined" value={new Date(user.created_at).toLocaleDateString()} icon={Calendar} color="text-blue-500" />
      </div>
      <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest border border-red-500/10 active:scale-95 transition-all">LOGOUT</button>
    </div>
  );
};

const ProfileItem = ({ label, value, icon: Icon, color }: any) => (
  <div className="flex justify-between items-center p-3 border-b border-white/5 last:border-none">
     <div className="flex items-center gap-3">
        <Icon size={18} className={color} />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
     </div>
     <span className="text-xs font-black italic text-white">{value}</span>
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 group">
    <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-500 hover:text-blue-400'}`}>
      <Icon size={22} className={active ? 'fill-current' : ''} />
    </div>
    <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${active ? 'text-blue-500' : 'text-slate-700'}`}>{label}</span>
  </button>
);

const StatCard = ({ icon: Icon, label, value, color, bg }: any) => (
  <div className={`${bg} p-6 rounded-[2.5rem] border border-white/5 space-y-3 shadow-xl`}>
     <div className={`w-11 h-11 rounded-2xl bg-black/20 flex items-center justify-center ${color}`}><Icon size={20}/></div>
     <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black italic ${color}`}>{typeof value === 'number' ? value.toFixed(2) : value}</p>
     </div>
  </div>
);

const ProtocolLoadingScreen = () => (
  <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center space-y-6">
    <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin shadow-[0_0_20px_rgba(37,99,235,0.3)]"></div>
    <span className="font-black italic text-2xl tracking-tighter uppercase text-white animate-pulse">MINE<span className="text-blue-500">PRO</span></span>
  </div>
);

const WithdrawModal = ({ onClose, onWithdraw, userData, userId, showToast, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const handleWithdraw = async () => {
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(lang === 'ar' ? `الحد الأدنى للسحب هو ${MIN_WITHDRAWAL} USDT` : `Min: ${MIN_WITHDRAWAL} USDT`, 'error');
    if (amt > userData.withdrawableBalance) return showToast(lang === 'ar' ? 'الرصيد غير كافٍ' : 'Insufficient funds', 'error');
    if (!address) return showToast(lang === 'ar' ? 'عنوان المحفظة مطلوب' : 'Address required', 'error');
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', details: address });
      await supabase.from('profiles').update({ balance: Number(userData.balance) - amt, withdrawable_balance: Number(userData.withdrawableBalance) - amt }).eq('id', userId);
      showToast(lang === 'ar' ? "تم تقديم طلب السحب بنجاح" : "Protocol Sent", "success");
      onWithdraw(); onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
       <div className="bg-[#111827] w-full max-w-md rounded-[3rem] border border-white/10 p-8 space-y-6 relative shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20}/></button>
          
          <h3 className="text-2xl font-black italic text-white uppercase text-center tracking-widest">{lang === 'ar' ? 'سحب الرصيد' : 'WITHDRAW'}</h3>
          
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 rounded-[2rem] border border-white/10 text-center shadow-lg">
             <p className="text-[11px] text-blue-200 font-black uppercase mb-1 tracking-widest">{lang === 'ar' ? 'المتاح للسحب' : 'AVAILABLE TO WITHDRAW'}</p>
             <p className="text-2xl font-black text-white italic tracking-tighter">USDT {userData.withdrawableBalance.toFixed(2)}</p>
          </div>

          <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                <AlertCircle size={18} />
             </div>
             <p className="text-[11px] text-red-200 font-bold leading-tight">{lang === 'ar' ? `الحد الأدنى للسحب هو ${MIN_WITHDRAWAL} USDT` : `Min withdrawal is ${MIN_WITHDRAWAL} USDT`}</p>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">{lang === 'ar' ? 'عنوان محفظة (BEP20)' : 'WALLET ADDRESS (BEP20)'}</p>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="1uytretdtfyguh" className="w-full bg-[#020617]/60 border border-white/5 p-5 rounded-2xl text-white outline-none font-mono text-sm placeholder-white/10 focus:border-blue-500/30 transition-all" />
             </div>

             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">{lang === 'ar' ? 'الكمية' : 'AMOUNT'}</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.50" className="w-full bg-[#020617]/60 border border-red-500/20 p-5 rounded-2xl text-white outline-none font-black italic text-xl placeholder-white/10 focus:border-red-500/50 transition-all" />
             </div>
          </div>

          <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/10 flex items-start gap-4">
             <Shield size={24} className="text-blue-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-blue-100/60 font-bold leading-relaxed">{lang === 'ar' ? 'عمليات السحب تتم مراجعتها بدقة لضمان أمان حسابك وأموالك. يتم المعالجة عادة في غضون وقت قصير' : 'Withdrawals are meticulously reviewed to ensure account security. Processing usually occurs shortly.'}</p>
          </div>

          <button onClick={handleWithdraw} disabled={loading} className="w-full bg-white text-slate-900 py-5 rounded-[2rem] font-black text-[13px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">
             {loading ? <Loader2 className="animate-spin mx-auto" /> : (lang === 'ar' ? 'تأكيد السحب' : 'CONFIRM WITHDRAWAL')}
          </button>
       </div>
    </div>
  );
};

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast("Access Granted", "success");
      }
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-[0_0_30px_rgba(37,99,235,0.4)]"><Zap size={40} className="fill-current" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white pt-4">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-slate-600 text-[10px] uppercase tracking-[0.4em] font-black">Digital Asset Factory</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all" required />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-[2rem] font-black text-white uppercase tracking-widest active:scale-95 transition-all shadow-xl">
            {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-slate-500 text-xs font-black uppercase tracking-widest">{isLogin ? 'New Node? Join Network' : 'Existing Node? Connect'}</button>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
    <div className="bg-[#0b0f1a] w-full max-w-sm rounded-[3rem] border border-white/10 p-10 space-y-6 relative text-center">
      <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-2xl text-slate-400"><X size={20}/></button>
      <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto"><Info size={32}/></div>
      <h3 className="text-white font-black text-xl uppercase italic">About MINEPRO</h3>
      <p className="text-slate-400 text-sm leading-relaxed">نظام متقدم لتعدين العملات الرقمية يعتمد على بروتوكولات الذكاء الاصطناعي لضمان أفضل عوائد يومية واستقرار مالي عالمي.</p>
    </div>
  </div>
);

const SupportChatModal = ({ lang, onClose, userId, initialAdminId, showToast, isAdminReply }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('support_messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 100);
  }, [userId]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('msgs').on('postgres_changes', { event: '*', table: 'support_messages' }, () => fetchMessages()).subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !initialAdminId) return;
    try {
      await supabase.from('support_messages').insert({ sender_id: isAdminReply ? initialAdminId : userId, receiver_id: isAdminReply ? userId : initialAdminId, message: newMessage.trim() });
      setNewMessage('');
      fetchMessages();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a]">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400"><X size={24}/></button>
        <h3 className="text-white font-black italic uppercase tracking-widest">{lang === 'ar' ? 'الدعم الفني' : 'SUPPORT'}</h3>
        <div className="w-12"></div>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {loading ? <Loader2 className="animate-spin mx-auto text-blue-500" /> : messages.map(m => {
          const isMe = isAdminReply ? m.sender_id === initialAdminId : m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-5 rounded-[2rem] text-sm font-bold ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none'}`}>{m.message}</div>
            </div>
          );
        })}
      </div>
      <div className="p-6 bg-[#0b0f1a] border-t border-white/5 flex gap-4">
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type message..." className="flex-1 bg-black/40 p-5 rounded-[2rem] outline-none text-white text-sm border border-white/5" />
        <button onClick={sendMessage} className="p-5 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Send size={20}/></button>
      </div>
    </div>
  );
};

export default App;
