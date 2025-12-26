import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, X, Copy, Zap, Settings, RefreshCw, 
  MessageCircle, Send, LogOut, TrendingUp, Activity, Info, 
  History, ArrowUpRight, Award, Layers,
  ExternalLink, Calendar, AlertCircle, Headphones, Plus, Minus, Lock, Image as ImageIcon,
  Coins, Shield, BadgeCheck, LifeBuoy, Search, CheckCircle2, Mail, Clock, StickyNote, Bookmark,
  Sparkles, ZapOff, Database, ChevronRight, CheckCircle, HelpCircle, Wallet
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, REFERRAL_PERCENT, NETWORK } from './constants';
import { supabase } from './supabase';

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

// --- Shared Helper Components ---

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 group">
    <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-500 hover:text-blue-400'}`}>
      <Icon size={22} className={active ? 'fill-current' : ''} />
    </div>
    <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${active ? 'text-blue-500' : 'text-slate-700'}`}>{label}</span>
  </button>
);

const ProfileStatCard = ({ label, value, color }: any) => (
  <div className="bg-[#020617]/60 p-5 rounded-[1.8rem] border border-white/5 text-center space-y-2">
     <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">{label}</p>
     <p className={`text-xl font-black italic tracking-tight ${color}`}>{value}</p>
  </div>
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

// --- Main App Component ---

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
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);
  const [adminUUID, setAdminUUID] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ amount: number } | null>(null);

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
      
      // If profile doesn't exist, create it and handle referral reward
      if (!profile) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const metadata = currentSession?.user?.user_metadata;
        const refCode = metadata?.referred_by;
        let referrerId = null;

        // Find referrer if code exists
        if (refCode) {
          const { data: referrer } = await supabase.from('profiles').select('id, balance').eq('referral_code', refCode).maybeSingle();
          if (referrer) {
            referrerId = referrer.id;
            // Reward referrer with 0.10 for successful signup
            await supabase.from('profiles').update({ balance: Number(referrer.balance) + 0.10 }).eq('id', referrer.id);
            // Create a transaction record for the referrer
            await supabase.from('transactions').insert({
              user_id: referrer.id,
              type: 'referral',
              amount: 0.10,
              status: 'completed',
              details: `Registration bonus for inviting ${metadata?.first_name || 'User'}`,
              date: new Date().toISOString()
            });
          }
        }

        const { data: newProfile, error } = await supabase.from('profiles').insert([{ 
          id: userId, 
          balance: 0, 
          withdrawable_balance: 0, 
          referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(), 
          first_name: metadata?.first_name || 'User', 
          email: userEmail,
          referred_by_id: referrerId
        }]).select().single();
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
        
        if (!sessionStorage.getItem('minepro_welcome_shown')) {
          setShowWelcome(true);
          sessionStorage.setItem('minepro_welcome_shown', 'true');
        }
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
      
      setCelebration({ amount: machine.dailyProfit });
      setTimeout(() => setCelebration(null), 3000);
      
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
      
      {celebration && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>
          <div className="relative animate-in zoom-in duration-500 flex flex-col items-center gap-4">
             <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.8)]">
                <Zap size={48} className="text-white fill-current" />
             </div>
             <div className="text-center">
                <p className="text-emerald-400 font-black text-xl uppercase tracking-widest">{lang === 'ar' ? 'تم الحصاد بنجاح' : 'HARVEST SUCCESS'}</p>
                <p className="text-white font-black text-6xl italic">+{celebration.amount.toFixed(2)}</p>
                <p className="text-blue-500 font-black text-sm uppercase tracking-[0.3em] mt-1">USDT PROCESSED</p>
             </div>
          </div>
        </div>
      )}

      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} lang={lang} />}
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal onClose={() => setShowRecharge(false)} onDeposit={() => fetchAllUserData(session.user.id, session.user.email || '')} showToast={showToast} userId={session.user.id} lang={lang} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} onWithdraw={() => fetchAllUserData(session.user.id, session.user.email || '')} userData={userData} userId={session.user.id} showToast={showToast} lang={lang} />}
      {showSupport && <SupportChatModal lang={lang} onClose={() => setShowSupport(false)} user={userData} userId={session.user.id} initialAdminId={adminUUID} showToast={showToast} />}
      
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-8 rounded-[3rem] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform duration-500">
           <Wallet size={120} className="text-blue-500" />
        </div>
        <div className="relative z-10 space-y-6">
           <div className="flex justify-between items-center">
              <div>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mb-1">{t('balanceTitle')}</p>
                 <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black italic text-white tracking-tighter">{(user.balance || 0).toFixed(2)}</span>
                    <span className="text-xs font-black text-blue-500 uppercase italic">USDT</span>
                 </div>
              </div>
              <div className="w-14 h-14 bg-blue-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-[0_10px_30px_rgba(37,99,235,0.4)]">
                 <Coins size={32} />
              </div>
           </div>

           <div className="flex gap-4">
              <button onClick={onShowRecharge} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform active:scale-95 shadow-xl">
                 <ArrowUpRight size={16} />
                 {t('recharge')}
              </button>
              <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-transform active:scale-95 shadow-xl">
                 <ArrowUpRight size={16} className="rotate-90" />
                 {t('withdraw')}
              </button>
           </div>
        </div>
      </div>

      {/* STUCK FUNDS SECTION - AS REQUESTED */}
      <div className="w-full bg-[#1e143b] p-7 rounded-[2.5rem] border border-white/5 flex flex-col gap-5 relative group overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
            <LifeBuoy size={100} />
        </div>
        <div className="flex justify-between items-start relative z-10">
           <div className="flex-1 space-y-2">
              <h4 className="text-white font-black text-lg uppercase italic tracking-tight">{t('stuckFunds')}</h4>
              <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{t('stuckFundsDesc')}</p>
           </div>
           <div className="w-14 h-14 bg-red-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]">
              <AlertCircle size={32} />
           </div>
        </div>
        <button onClick={onShowSupport} className="w-fit bg-white text-[#1e143b] px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all relative z-10">
           {t('requestHelpBtn')}
           <MessageCircle size={14} className="fill-current opacity-30" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div onClick={onShowSupport} className="bg-[#0b1424] p-6 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all group shadow-lg">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
               <Headphones size={24} />
            </div>
            <div>
               <h4 className="text-white font-black text-sm uppercase italic">{t('supportChat')}</h4>
               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{t('needHelp')}</p>
            </div>
         </div>
         <div onClick={onShowInfo} className="bg-[#0b1424] p-6 rounded-[2.5rem] border border-white/5 space-y-4 cursor-pointer hover:border-blue-500/30 transition-all group shadow-lg">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
               <Info size={24} />
            </div>
            <div>
               <h4 className="text-white font-black text-sm uppercase italic">{lang === 'ar' ? 'معلومات' : 'Information'}</h4>
               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">MINEPRO PROTOCOL</p>
            </div>
         </div>
      </div>

      <div className="bg-[#0b1424] p-8 rounded-[3rem] border border-white/5 space-y-6 shadow-xl">
         <div className="flex justify-between items-center">
            <h3 className="text-white font-black text-sm uppercase italic tracking-widest">{t('history')}</h3>
            <History size={18} className="text-slate-600" />
         </div>
         <div className="space-y-4">
            {user.transactions.slice(0, 3).map((tx: any) => (
               <div key={tx.id} className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'deposit' ? <ArrowUpRight size={18} /> : <ArrowUpRight size={18} className="rotate-90" />}
                     </div>
                     <div>
                        <p className="text-white font-black text-[11px] uppercase italic">{tx.type}</p>
                        <p className="text-[8px] text-slate-500 font-bold uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={`text-sm font-black italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}</p>
                     <p className={`text-[8px] font-black uppercase ${tx.status === 'completed' ? 'text-emerald-500' : 'text-orange-500'}`}>{tx.status}</p>
                  </div>
               </div>
            ))}
            {user.transactions.length === 0 && (
               <div className="py-10 text-center opacity-20">
                  <Activity size={32} className="mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No Activity Recorded</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

// --- Admin ---

const AdminView = ({ adminId, t, showToast, lang }: any) => {
  const [mainTab, setMainTab] = useState<'deposit' | 'messages' | 'withdraw' | 'members'>('deposit');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserDetails, setSelectedUserDetails] = useState<string | null>(null);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === 'members') {
        const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setData(users || []);
      } else if (mainTab === 'messages') {
        const { data: msgs } = await supabase.from('support_messages').select('sender_id, receiver_id, message, created_at, is_read').order('created_at', { ascending: false });
        const userMap = new Map();
        msgs?.forEach(m => {
          const otherId = m.sender_id === adminId ? m.receiver_id : m.sender_id;
          if (!userMap.has(otherId)) userMap.set(otherId, m);
        });
        const userIds = Array.from(userMap.keys());
        const { data: profs } = await supabase.from('profiles').select('*').in('id', userIds);
        setData(userIds.map(id => ({ ...userMap.get(id), profiles: profs?.find(p => p.id === id) })));
      } else {
        const typeStr = mainTab === 'deposit' ? 'deposit' : 'withdrawal';
        let txQuery = supabase.from('transactions').select('*').eq('type', typeStr);
        if (subTab === 'new') txQuery = txQuery.eq('status', 'pending');
        else txQuery = txQuery.in('status', ['completed', 'failed']);
        const { data: txs } = await txQuery.order('date', { ascending: false });
        if (txs) {
          const uids = txs.map(t => t.user_id);
          const { data: profs } = await supabase.from('profiles').select('*').in('id', uids);
          setData(txs.map(tx => ({ ...tx, profiles: profs?.find(p => p.id === tx.user_id) })));
        } else setData([]);
      }
    } catch (e: any) { showToast(e, "error"); } 
    finally { setLoading(false); }
  }, [mainTab, subTab, showToast, adminId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      if (newStatus === 'completed' && tx.type === 'deposit') {
        // Find user profile to see if they were referred
        const { data: p } = await supabase.from('profiles').select('*').eq('id', tx.user_id).single();
        
        // Update user balance
        await supabase.from('profiles').update({ 
          balance: Number(p.balance) + Number(tx.amount), 
          total_recharge: Number(p.total_recharge) + Number(tx.amount) 
        }).eq('id', tx.user_id);

        // Handle referral reward for deposit (10%)
        if (p.referred_by_id) {
           const referralBonus = Number(tx.amount) * 0.10;
           const { data: referrer } = await supabase.from('profiles').select('balance').eq('id', p.referred_by_id).maybeSingle();
           
           if (referrer) {
              await supabase.from('profiles').update({ 
                balance: Number(referrer.balance) + referralBonus 
              }).eq('id', p.referred_by_id);

              // Record referral transaction for referrer
              await supabase.from('transactions').insert({
                user_id: p.referred_by_id,
                type: 'referral',
                amount: referralBonus,
                status: 'completed',
                details: `10% Commission from deposit of ${p.first_name}`,
                date: new Date().toISOString()
              });
           }
        }
      }
      showToast("Protocol Confirmed", "success");
      fetchData();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       {selectedUserDetails && <UserDetailsModal userId={selectedUserDetails} onClose={() => setSelectedUserDetails(null)} lang={lang} showToast={showToast} />}
       {selectedChatUserId && <SupportChatModal lang={lang} onClose={() => setSelectedChatUserId(null)} user={null} userId={selectedChatUserId} initialAdminId={adminId} showToast={showToast} isAdminReply={true} />}
       
       <div className="bg-[#0b1424] p-3 rounded-[2rem] flex gap-2 shadow-2xl border border-white/5">
         {[
           {id: 'deposit', label: 'إيداع'},
           {id: 'messages', label: 'رسائل'},
           {id: 'withdraw', label: 'سحب'},
           {id: 'members', label: 'أعضاء'}
         ].map((tab: any) => (
           <button key={tab.id} onClick={() => setMainTab(tab.id as any)} className={`flex-1 py-4 px-2 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${mainTab === tab.id ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}>{tab.label}</button>
         ))}
       </div>

       {(mainTab === 'deposit' || mainTab === 'withdraw') && (
         <div className="bg-[#0b1424] p-2 rounded-2xl flex gap-1 border border-white/5 max-w-[240px] mx-auto">
            <button onClick={() => setSubTab('new')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black transition-all ${subTab === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>الجديدة</button>
            <button onClick={() => setSubTab('archive')} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black transition-all ${subTab === 'archive' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>الأرشيف</button>
         </div>
       )}

       <div className="space-y-4">
         {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
               <Loader2 className="animate-spin text-blue-500" size={40} />
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Synchronizing Protocol...</p>
            </div>
         ) : data.length === 0 ? (
            <div className="py-20 text-center opacity-30">
               <Activity size={48} className="mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest">No Active Protocol</p>
            </div>
         ) : data.map(item => (
           mainTab === 'messages' ? (
             <div key={item.profiles?.id || Math.random()} onClick={() => setSelectedChatUserId(item.profiles?.id)} className="bg-[#0b1424] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-xl cursor-pointer hover:bg-[#151f33] transition-all group">
               <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-xl font-black italic shadow-lg group-hover:scale-110 transition-transform">
                     {item.profiles?.first_name?.[0] || 'U'}
                  </div>
                  <div>
                    <h5 className="text-white font-black text-sm uppercase italic tracking-tight">{item.profiles?.first_name || 'User'}</h5>
                    <p className="text-[10px] text-slate-500 font-bold truncate max-w-[150px] mt-1">{item.message || '...'}</p>
                  </div>
               </div>
               <div className="text-right flex flex-col items-end gap-2">
                  <p className="text-[9px] text-slate-600 font-bold uppercase">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  {!item.is_read && item.receiver_id === adminId && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>}
               </div>
             </div>
           ) : mainTab === 'members' ? (
             <div key={item.id} onClick={() => setSelectedUserDetails(item.id)} className="bg-[#0b1424] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-xl cursor-pointer hover:bg-[#151f33] transition-all">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-lg font-black italic">
                      {item.first_name?.[0] || 'U'}
                   </div>
                   <div>
                      <h5 className="text-white font-black text-sm uppercase italic">{item.first_name || 'User'}</h5>
                      <p className="text-[9px] text-slate-600 font-mono tracking-tighter truncate max-w-[150px]">{item.email}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black text-blue-500 italic">{(item.balance || 0).toFixed(1)}</p>
                   <p className="text-[8px] text-slate-700 font-black uppercase">USDT</p>
                </div>
             </div>
           ) : (
             <div key={item.id} className="bg-[#0b1424] p-8 rounded-[3rem] border border-white/5 space-y-7 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Activity size={80} className="text-blue-500" />
               </div>
               
               <div className="flex justify-between items-start relative z-10">
                 <div onClick={() => setSelectedUserDetails(item.user_id)} className="cursor-pointer hover:opacity-70 transition-opacity">
                    <h5 className="text-white font-black text-2xl uppercase italic tracking-tighter underline decoration-blue-500/30 underline-offset-4">{item.profiles?.first_name || 'Protocol'}</h5>
                    <p className="text-[10px] text-slate-500 font-mono tracking-widest mt-1 uppercase">{item.profiles?.email}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-3xl font-black text-white italic tracking-tight shimmer-effect">{Math.abs(item.amount).toFixed(2)}</p>
                    <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em] mt-1">USDT</p>
                 </div>
               </div>

               {item.proof_url && (
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                       <ShieldCheck size={16} className="text-blue-500" />
                       <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Verification Proof</h6>
                    </div>
                    <div className="w-full h-64 rounded-[2rem] overflow-hidden border border-white/10 bg-black shadow-inner">
                       <img src={item.proof_url} className="w-full h-full object-contain" />
                    </div>
                 </div>
               )}

               {!item.proof_url && item.type === 'withdrawal' && (
                  <div className="bg-red-500/10 p-5 rounded-3xl border border-red-500/20">
                     <p className="text-[10px] text-red-200 font-black uppercase tracking-widest mb-1">Target Wallet (BEP20)</p>
                     <p className="text-xs font-mono text-white break-all select-all">{item.details}</p>
                  </div>
               )}

               {item.status === 'pending' && (
                 <div className="flex gap-4 pt-2 relative z-10">
                   <button onClick={() => handleTx(item, 'completed')} className="flex-1 bg-white text-slate-900 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">Approve</button>
                   <button onClick={() => handleTx(item, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all">Reject</button>
                 </div>
               )}

               {item.status !== 'pending' && (
                  <div className="flex items-center justify-center gap-2 py-4 border-t border-white/5 opacity-50">
                     {item.status === 'completed' ? <CheckCircle2 className="text-emerald-500" size={16} /> : <X className="text-red-500" size={16} />}
                     <p className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'completed' ? 'text-emerald-500' : 'text-red-500'}`}>{item.status}</p>
                  </div>
               )}
             </div>
           )
         ))}
       </div>
    </div>
  );
};

const UserDetailsModal = ({ userId, onClose, lang, showToast }: any) => {
  const [u, setU] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [activeMachines, setActiveMachines] = useState<any[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_machines').select('*').eq('user_id', userId).gt('remaining_days', 0)
      ]);
      setU(pRes.data);
      setActiveMachines(mRes.data || []);
      setLoading(false);
    } catch (e) {}
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const modifyBalance = async (op: 'add' | 'sub') => {
    const val = Number(amountInput);
    if (isNaN(val) || val <= 0) return showToast("أدخل مبلغا صحيحا", "error");
    try {
      const newBal = op === 'add' ? Number(u.balance) + val : Number(u.balance) - val;
      const { error } = await supabase.from('profiles').update({ 
        balance: newBal, 
        withdrawable_balance: Math.max(0, op === 'add' ? Number(u.withdrawable_balance) + val : Number(u.withdrawable_balance) - val) 
      }).eq('id', userId);
      
      if (error) throw error;
      
      await supabase.from('transactions').insert({
        user_id: userId,
        type: op === 'add' ? 'deposit' : 'withdrawal',
        amount: op === 'add' ? val : -val,
        status: 'completed',
        details: noteInput || (op === 'add' ? "تم إرسال رصيد من المسؤول" : "تم سحب رصيد من المسؤول"),
        date: new Date().toISOString()
      });

      showToast("تم تحديث الرصيد وإرسال إشعار للمستخدم", "success");
      setAmountInput('');
      setNoteInput('');
      fetchUser();
    } catch (e: any) { showToast(e, "error"); }
  };

  if (loading || !u) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
       <div className="bg-[#0b1424] w-full max-w-md rounded-[3rem] border border-white/5 flex flex-col relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh]">
          <div className="p-8 pb-4 text-center relative border-b border-white/5">
             <button onClick={onClose} className="absolute top-8 right-8 p-2.5 bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all"><X size={20}/></button>
             <h3 className="text-white font-black text-xl italic uppercase tracking-widest">ملف العميل</h3>
             <p className="text-[8px] text-blue-500/60 font-mono tracking-tighter mt-1">{u.id}</p>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-7">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500">
                      <Mail size={18} />
                   </div>
                   <p className="text-[11px] font-bold text-slate-400 font-mono">{u.email}</p>
                </div>
                <div className="w-16 h-16 bg-blue-600 rounded-[1.2rem] flex items-center justify-center text-white text-3xl font-black italic shadow-[0_0_20px_rgba(37,99,235,0.4)]">?</div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <ProfileStatCard label="WITHDRAWABLE" value={u.withdrawable_balance.toFixed(2)} color="text-blue-500" />
                <ProfileStatCard label="TOTAL BALANCE" value={u.balance.toFixed(2)} color="text-white" />
                <ProfileStatCard label="TOTAL WITHDRAW" value={u.total_withdraw.toFixed(2)} color="text-red-500" />
                <ProfileStatCard label="TOTAL DEPOSIT" value={u.total_recharge.toFixed(2)} color="text-emerald-500" />
             </div>

             <div className="bg-black/40 p-4 rounded-[1.5rem] border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <Clock size={14} className="text-slate-500" />
                   <span className="text-[10px] text-slate-500 font-bold">{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">REF CODE: <span className="text-orange-500 font-black italic ml-1">{u.referral_code}</span></span>
                   <Users size={14} className="text-slate-500" />
                </div>
             </div>

             <div className="space-y-4 pt-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">تعديل الرصيد (إرسال / سحب)</p>
                <div className="space-y-2">
                  <input type="text" value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="أضف ملاحظة للمستخدم..." className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-[11px] text-white outline-none focus:border-blue-500/30" />
                  <div className="bg-black/40 p-2 rounded-3xl border border-white/5 flex gap-2">
                     <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} placeholder="0.00" className="flex-1 bg-transparent border-none outline-none text-white text-xl font-black italic text-center placeholder-white/10" />
                     <div className="flex gap-2">
                        <button onClick={() => modifyBalance('add')} className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"><Plus size={24}/></button>
                        <button onClick={() => modifyBalance('sub')} className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all"><Minus size={24}/></button>
                     </div>
                  </div>
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center justify-end gap-2 text-blue-500">
                   <h4 className="text-[11px] font-black uppercase italic">الماكينات النشطة</h4>
                   <Cpu size={18} />
                </div>
                <div className="space-y-3">
                   {activeMachines.length === 0 ? (
                      <div className="p-10 bg-black/20 rounded-3xl border border-dashed border-white/5 text-center">
                         <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.2em]">NO ACTIVE HARDWARE</p>
                      </div>
                   ) : activeMachines.map(am => {
                      const m = MACHINES.find(mach => mach.id === am.machine_id);
                      return (
                         <div key={am.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                            <div>
                               <p className="text-white font-black text-[11px] uppercase italic">{m?.name || 'NODE'}</p>
                               <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">{am.remaining_days} DAYS LEFT</p>
                            </div>
                            <Cpu size={16} className="text-blue-500" />
                         </div>
                      );
                   })}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t, lang }: any) => {
  return (
    <div className="space-y-6 pb-10">
      {MACHINES.map(m => (
        <div key={m.id} className={`bg-[#0b1424] p-8 rounded-[2.5rem] border border-blue-500/20 space-y-7 shadow-2xl relative overflow-hidden group`}>
           <div className="flex justify-between items-start">
              <div className="flex flex-col items-start">
                 <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">السعر</p>
                 <p className="text-3xl font-black text-white italic tracking-tighter shimmer-effect">{m.price}<span className="text-xs opacity-60 ml-0.5 not-italic uppercase">U</span></p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                 <h4 className="text-white font-black text-lg italic uppercase tracking-tighter">{m.name}</h4>
                 <p className="text-[8px] text-blue-500 font-black uppercase tracking-widest">{m.description}</p>
              </div>
              <div className="w-12 h-14 bg-slate-800/50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                 <Bookmark size={24} className="fill-current" />
              </div>
           </div>
           <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/40 p-3 py-5 rounded-[1.8rem] border border-white/5 text-center space-y-2 relative overflow-hidden">
                 <div className="w-6 h-6 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto">
                    <TrendingUp size={14} />
                 </div>
                 <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">الإجمالي</p>
                 <p className="text-xs font-black text-rose-500 italic">{(m.dailyProfit * m.duration).toFixed(2)}+</p>
              </div>
              <div className="bg-black/40 p-3 py-5 rounded-[1.8rem] border border-white/5 text-center space-y-2">
                 <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto">
                    <Calendar size={14} />
                 </div>
                 <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">المدة</p>
                 <p className="text-xs font-black text-blue-500 italic">{m.duration} يوم</p>
              </div>
              <div className="bg-black/40 p-3 py-5 rounded-[1.8rem] border border-white/5 text-center space-y-2">
                 <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto">
                    <Activity size={14} />
                 </div>
                 <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">الربح اليومي</p>
                 <p className="text-xs font-black text-emerald-500 italic">{m.dailyProfit}+</p>
              </div>
           </div>
           <button onClick={() => onBuy(m)} className="w-full bg-[#065f46]/30 border border-emerald-500/20 py-5 rounded-[2rem] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg hover:bg-[#065f46]/50">
              NODE STABLE
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]"></div>
           </button>
        </div>
      ))}
    </div>
  );
};

const TasksView = ({ user, onComplete, t, lang }: any) => {
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  useEffect(() => {
    const itv = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(itv);
  }, []);

  const todayEarnings = user.transactions
    .filter((tx: any) => tx.type === 'deposit' && tx.status === 'completed' && new Date(tx.date).toDateString() === new Date().toDateString())
    .reduce((acc: number, tx: any) => acc + Number(tx.amount), 0);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-[#0f172a] to-[#020617] p-7 rounded-[2.5rem] border border-white/5 space-y-5 shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12 group-hover:rotate-45 transition-transform duration-700">
            <Sparkles size={120} />
         </div>
         <div className="flex justify-between items-center relative z-10">
            <div className="space-y-1">
               <h3 className="text-white font-black text-xl italic uppercase tracking-tighter">{lang === 'ar' ? 'مركز الحصاد' : 'HARVEST CENTER'}</h3>
               <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">OPERATIONAL STATUS: ACTIVE</p>
            </div>
            <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]">
               <ListTodo size={32} />
            </div>
         </div>
         <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
               <p className="text-[8px] text-slate-500 font-black uppercase mb-1">{lang === 'ar' ? 'أرباح اليوم' : 'TODAY EARNED'}</p>
               <p className="text-xl font-black text-emerald-500 italic">{todayEarnings.toFixed(2)} <span className="text-[10px]">USDT</span></p>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
               <p className="text-[8px] text-slate-500 font-black uppercase mb-1">{lang === 'ar' ? 'العقد النشط' : 'ACTIVE NODES'}</p>
               <p className="text-xl font-black text-blue-500 italic">{user.ownedMachines.length} <span className="text-[10px]">NODES</span></p>
            </div>
         </div>
      </div>

      <div className="space-y-4">
        {user.ownedMachines.length === 0 ? (
          <div className="bg-[#0b0f1a] p-12 rounded-[3rem] border border-white/5 text-center space-y-4 shadow-xl">
             <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center mx-auto opacity-30">
                <ZapOff size={40} className="text-slate-500" />
             </div>
             <div>
                <p className="text-white font-black text-sm uppercase italic">{lang === 'ar' ? 'لا توجد عقد نشطة' : 'NO ACTIVE NODES'}</p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">Visit the mining store to get started</p>
             </div>
          </div>
        ) : user.ownedMachines.map((um: UserMachine) => {
          const m = MACHINES.find(mach => mach.id === um.machine_id);
          const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
          const diff = currentTime - lastClaim;
          const cooldown = 24 * 60 * 60 * 1000;
          const canClaim = diff >= cooldown;
          
          const progress = Math.min(100, (diff / cooldown) * 100);
          
          return (
            <div key={um.id} className={`bg-[#0b1424] p-7 rounded-[2.5rem] border ${canClaim ? 'border-emerald-500/20' : 'border-white/5'} transition-all duration-500 space-y-6 shadow-xl relative overflow-hidden group`}>
               {canClaim && (
                 <div className="absolute top-0 right-0 p-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                 </div>
               )}
               
               <div className="flex justify-between items-start relative z-10">
                  <div className="flex items-center gap-4">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${canClaim ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800/20 text-slate-600'}`}>
                        <Database size={28} />
                     </div>
                     <div>
                        <h4 className="text-white font-black text-sm uppercase italic tracking-tight">{m?.name}</h4>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">{lang === 'ar' ? 'حالة التزامن:' : 'SYNC STATUS:'} {canClaim ? 'READY' : 'SYNCING...'}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[8px] text-slate-600 font-black uppercase mb-1">{lang === 'ar' ? 'العائد' : 'YIELD'}</p>
                     <p className={`text-xl font-black italic ${canClaim ? 'text-emerald-500' : 'text-slate-400'}`}>+{m?.dailyProfit.toFixed(2)}</p>
                  </div>
               </div>

               {!canClaim && (
                 <div className="space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-600">
                       <span>{Math.floor(progress)}% COMPLETE</span>
                       <span>{( (cooldown - diff) / (1000 * 60 * 60) ).toFixed(1)}H REMAINING</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                       <div 
                         className="h-full bg-blue-600 transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                         style={{ width: `${progress}%` }}
                       ></div>
                    </div>
                 </div>
               )}

               <button 
                 onClick={() => onComplete(um)} 
                 disabled={!canClaim} 
                 className={`w-full py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl relative overflow-hidden
                   ${canClaim 
                     ? 'bg-emerald-600 text-white active:scale-95 hover:bg-emerald-500 group' 
                     : 'bg-white/5 text-slate-700 opacity-50'
                   }`}
               >
                  {canClaim ? (
                    <>
                      <Sparkles size={18} className="animate-pulse" />
                      {lang === 'ar' ? 'حصاد الأرباح' : 'HARVEST YIELD'}
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {lang === 'ar' ? 'قيد التعدين' : 'MINING IN PROGRESS'}
                    </>
                  )}
                  {canClaim && <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-[-25deg]"></div>}
               </button>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-600/5 p-6 rounded-[2rem] border border-blue-500/10 flex items-start gap-4 shadow-lg">
         <Info size={24} className="text-blue-500 shrink-0 mt-0.5" />
         <p className="text-[10px] text-blue-100/60 font-bold leading-relaxed">
           {lang === 'ar' 
             ? 'يتم الحصاد مرة واحدة يومياً لكل عقد نشط. تأكد من العودة بانتظام لضمان تدفق السيولة إلى محفظتك.' 
             : 'Harvest can be performed once daily for each active node. Be sure to return regularly to ensure liquidity flow.'}
         </p>
      </div>
    </div>
  );
};

const WelcomeModal = ({ onClose, lang }: { onClose: () => void, lang: Language }) => {
  const [step, setStep] = useState(0);
  const steps = [
    {
      icon: <Zap size={40} className="text-blue-500" />,
      title: lang === 'ar' ? 'مرحباً بك في MINEPRO' : 'Welcome to MINEPRO',
      text: lang === 'ar' ? 'أهلاً بك في أقوى منصة لتوليد الأصول الرقمية. نحن نستخدم تقنيات التعدين السحابي المتقدمة لضمان عوائد مستقرة وفورية.' : 'Welcome to the most powerful digital asset generation platform. We use advanced cloud mining technologies to ensure stable and instant returns.'
    },
    {
      icon: <Layers size={40} className="text-emerald-500" />,
      title: lang === 'ar' ? 'لماذا هذه الأرباح؟' : 'Why these profits?',
      text: lang === 'ar' ? 'تعمل المنصة كجسر مالي متطور، حيث نقوم بتحويل الأموال عبر شبكة ضخمة من المحافظ لتأمين السيولة وتعزيز شرعية الأصول الرقمية في الأسواق العالمية، مما يولد هوامش ربح عالية للمشتركين.' : 'The platform acts as a sophisticated financial bridge, where we transfer funds across a vast network of wallets to secure liquidity and enhance the legitimacy of digital assets in global markets, generating high profit margins for subscribers.'
    },
    {
      icon: <Cpu size={40} className="text-rose-500" />,
      title: lang === 'ar' ? 'نظام الماكينات' : 'Machine System',
      text: lang === 'ar' ? 'يمكنك تفعيل عقد (ماكينة) بأسعار تبدأ من 10 USDT. كل ماكينة تعمل لمدة محددة وتمنحك أرباحاً يومية يمكنك سحبها فوراً.' : 'You can activate a contract (machine) at prices starting from 10 USDT. Each machine runs for a specific period and grants you daily profits that you can withdraw immediately.'
    },
    {
      icon: <HelpCircle size={40} className="text-orange-500" />,
      title: lang === 'ar' ? 'استعادة الأموال العالقة' : 'Recover Stuck Funds',
      text: lang === 'ar' ? 'هل لديك أموال عالقة في منصات أخرى؟ فريقنا يساعدك في استعادتها مقابل عمولة (20% - 50%) تُدفع فقط بعد نجاح عملية السحب الخاصة بك.' : 'Have stuck funds in other platforms? Our team helps you recover them for a commission (20% - 50%) paid only after your withdrawal is successful.'
    },
    {
      icon: <ShieldCheck size={40} className="text-blue-400" />,
      title: lang === 'ar' ? 'قواعد الدعم الفني' : 'Support Rules',
      text: lang === 'ar' ? 'الدعم الفني متاح حصرياً للمشتركين الذين يمتلكون عقداً مدفوعاً. الماكينة المجانية هي مساعدة لتجربة النظام ولا تمنح صلاحية الوصول للدعم، إلا في حال وجود مشكلة في عملية الاشتراك نفسها.' : 'Technical support is exclusively available to subscribers with a paid contract. The free machine is a helper to try the system and does not grant support access, except for issues regarding the subscription process itself.'
    }
  ];

  return (
    <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-md flex items-center justify-center p-5 animate-in fade-in duration-500">
       <div className="bg-[#0b1424] w-full max-w-sm rounded-[3rem] border border-white/5 flex flex-col items-center p-8 space-y-6 text-center relative shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-2 shadow-inner">
             {steps[step].icon}
          </div>
          <div className="space-y-3">
             <h3 className="text-white font-black text-xl italic uppercase tracking-tighter">{steps[step].title}</h3>
             <p className="text-slate-400 text-[13px] leading-relaxed font-bold">{steps[step].text}</p>
          </div>
          <div className="flex gap-2 w-full pt-4">
             {step > 0 && (
               <button onClick={() => setStep(step - 1)} className="flex-1 bg-white/5 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest">{lang === 'ar' ? 'السابق' : 'BACK'}</button>
             )}
             <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onClose()} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl">
               {step < steps.length - 1 ? (lang === 'ar' ? 'التالي' : 'NEXT') : (lang === 'ar' ? 'ابدأ الآن' : 'GET STARTED')}
             </button>
          </div>
          <div className="flex gap-1.5">
             {steps.map((_, i) => (
               <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-blue-500' : 'w-2 bg-white/10'}`}></div>
             ))}
          </div>
       </div>
    </div>
  );
};

const TeamView = ({ user, t, lang, showToast }: any) => {
  const refLink = `https://mining-pro.vercel.app/#/?ref=${user.referral_code}`;
  
  return (
    <div className="space-y-6 pb-10">
      <div className="bg-gradient-to-br from-purple-600 to-indigo-800 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12">
            <Users size={120} />
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest opacity-60 relative z-10">Referral ID</p>
         <div className="flex items-center justify-between bg-white/10 p-5 rounded-[2rem] border border-white/20 mt-4 backdrop-blur-sm relative z-10">
            <span className="text-2xl font-black italic tracking-widest">{user.referral_code}</span>
            <button onClick={() => { navigator.clipboard.writeText(user.referral_code); showToast("Copied Code", "success"); }} className="p-2.5 bg-white text-purple-700 rounded-xl active:scale-90 transition-transform"><Copy size={18}/></button>
         </div>
         <div className="mt-6 space-y-2 relative z-10">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Share Link (0.10 USDT per referral)</p>
            <div className="flex gap-2">
               <div className="flex-1 bg-black/20 p-4 rounded-2xl border border-white/10 text-[10px] font-mono truncate">{refLink}</div>
               <button onClick={() => { navigator.clipboard.writeText(refLink); showToast("Link Copied", "success"); }} className="bg-white text-indigo-700 px-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Copy Link</button>
            </div>
         </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
         <StatCard icon={Award} label="Commission" value={user.referralEarnings} color="text-purple-500" bg="bg-purple-500/10" />
         <StatCard icon={Users} label="Team Members" value={0} color="text-blue-500" bg="bg-blue-500/10" />
      </div>
      
      <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
         <h5 className="text-white font-black text-xs uppercase italic tracking-widest">Referral Rewards Protocol</h5>
         <div className="space-y-3">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Plus size={16}/></div>
               <p className="text-[10px] text-slate-400 font-bold">0.10 USDT Registration Bonus</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500"><TrendingUp size={16}/></div>
               <p className="text-[10px] text-slate-400 font-bold">10% from every deposit made by referrals</p>
            </div>
         </div>
      </div>
    </div>
  );
};

const ProfileView = ({ user, t, lang }: any) => {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col items-center py-8">
         <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center text-white text-3xl font-black italic mb-4 shadow-2xl">
           {user.first_name?.[0] || 'U'}
         </div>
         <h3 className="text-xl font-black italic uppercase tracking-tighter">{user.first_name || 'User'}</h3>
         <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">{user.email}</p>
      </div>
      <div className="bg-[#0b0f1a] p-4 rounded-[2.5rem] border border-white/5 space-y-4 shadow-xl">
         <ProfileItem label="Deposits" value={`${(user.totalRecharge || 0).toFixed(2)} USDT`} icon={Zap} color="text-emerald-500" />
         <ProfileItem label="Total Withdraw" value={`${(user.totalWithdraw || 0).toFixed(2)} USDT`} icon={ExternalLink} color="text-red-500" />
         <ProfileItem label="Joined" value={new Date(user.created_at).toLocaleDateString()} icon={Calendar} color="text-blue-500" />
      </div>
      <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-widest border border-red-500/10 active:scale-95 transition-all shadow-lg">LOGOUT</button>
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

const AuthView = ({ lang, t, showToast }: any) => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [refCode, setRefCode] = useState(searchParams.get('ref') || '');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              first_name: fullName,
              referred_by: refCode
            }
          }
        });
        if (error) throw error;
        showToast("تم إنشاء الحساب بنجاح", "success");
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

        <div className="bg-[#0b1424] p-8 rounded-[3rem] border border-white/5 shadow-2xl space-y-6">
          <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
             <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>تسجيل الدخول</button>
             <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>إنشاء حساب</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">الاسم الكامل</p>
                 <input type="text" placeholder="مثال: أحمد محمد" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all text-right" required={!isLogin} />
              </div>
            )}

            <div className="space-y-1">
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">البريد الإلكتروني</p>
               <input type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all required" />
            </div>

            <div className="space-y-1">
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">كلمة المرور</p>
               <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all required" />
            </div>

            {!isLogin && (
              <div className="space-y-1">
                 <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">رمز الإحالة (اختياري)</p>
                 <input type="text" placeholder="كود الإحالة إن وجد" value={refCode} onChange={e => setRefCode(e.target.value)} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-white outline-none focus:border-blue-500/50 transition-all text-center font-black tracking-widest" />
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 py-5 rounded-[2rem] font-black text-white uppercase tracking-widest active:scale-95 transition-all shadow-xl mt-4">
              {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : (isLogin ? 'تسجيل دخول' : 'إنشاء حسابي')}
            </button>
          </form>
        </div>
        
        <p className="text-center text-[10px] text-slate-700 font-black uppercase tracking-tighter">MINEPRO PROTOCOL v3.1.2 - SECURE ENCRYPTED ACCESS</p>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
    <div className="bg-[#0b0f1a] w-full max-w-sm rounded-[3rem] border border-white/10 p-10 space-y-6 relative text-center">
      <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-2xl text-slate-400 hover:text-white"><X size={20}/></button>
      <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><Info size={32}/></div>
      <h3 className="text-white font-black text-xl uppercase italic">About MINEPRO</h3>
      <p className="text-slate-400 text-sm leading-relaxed">نظام متقدم لتعدين العملات الرقمية يعتمد على بروتوكولات الذكاء الاصطناعي لضمان أفضل عوائد يومية واستقرار مالي عالمي.</p>
    </div>
  </div>
);

const SupportChatModal = ({ lang, onClose, user, userId, initialAdminId, showToast, isAdminReply }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isSubscribed = user?.ownedMachines?.some((um: any) => um.machine_id !== 0) || false;

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
    
    if (!isAdminReply && !isSubscribed) {
       const q = newMessage.toLowerCase();
       const isSubQuery = q.includes('اشتراك') || q.includes('تفعيل') || q.includes('subscribe') || q.includes('activate') || q.includes('deposit') || q.includes('ايداع');
       if (!isSubQuery) {
         showToast(lang === 'ar' ? 'يجب الاشتراك أولاً لاستخدام الدعم الفني' : 'You must subscribe first to use support', 'error');
         return;
       }
    }

    try {
      await supabase.from('support_messages').insert({ sender_id: isAdminReply ? initialAdminId : userId, receiver_id: isAdminReply ? userId : initialAdminId, message: newMessage.trim() });
      setNewMessage('');
      fetchMessages();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-lg">
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={24}/></button>
        <h3 className="text-white font-black italic uppercase tracking-widest">{lang === 'ar' ? 'الدعم الفني' : 'SUPPORT'}</h3>
        <div className="w-12"></div>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {!isSubscribed && !isAdminReply && (
          <div className="bg-orange-500/10 p-5 rounded-[2rem] border border-orange-500/20 text-orange-200 text-xs font-bold leading-relaxed mb-4 text-center shadow-lg">
            {lang === 'ar' ? '⚠️ تنبيه: نظام الدعم مخصص للمشتركين فقط. يمكنك حالياً إرسال رسائل تتعلق بمشاكل الاشتراك أو الإيداع فقط.' : '⚠️ Alert: Support system is for subscribers only. You can currently only send messages related to subscription or deposit issues.'}
          </div>
        )}
        {loading ? <Loader2 className="animate-spin mx-auto text-blue-500" /> : messages.map(m => {
          const isMe = isAdminReply ? m.sender_id === initialAdminId : m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-5 rounded-[2rem] text-sm font-bold shadow-xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'}`}>{m.message}</div>
            </div>
          );
        })}
      </div>
      <div className="p-6 bg-[#0b0f1a] border-t border-white/5 flex gap-4 shadow-2xl">
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type message..." className="flex-1 bg-black/40 p-5 rounded-[2rem] outline-none text-white text-sm border border-white/5 focus:border-blue-500/30 transition-all" />
        <button onClick={sendMessage} className="p-5 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all"><Send size={20}/></button>
      </div>
    </div>
  );
};

const RechargeModal = ({ onClose, onDeposit, showToast, userId, lang }: any) => {
  const [amount, setAmount] = useState('0.00');
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
    if (!proof) return showToast(lang === 'ar' ? 'يرجى إرفاق الصورة' : 'Attach proof', 'error');
    setLoading(true);
    try {
      await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'deposit', 
        amount: Number(amount), 
        status: 'pending', 
        proof_url: proof 
      });
      showToast(lang === 'ar' ? "تم إرسال الطلب بنجاح" : "Deposit requested", "success");
      onDeposit();
      onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
       <div className="bg-[#111827] w-[92%] max-w-md rounded-[2.5rem] border border-white/10 p-6 space-y-5 relative overflow-y-auto max-h-[95vh] shadow-[0_0_50px_rgba(0,0,0,0.5)] no-scrollbar">
          <button onClick={onClose} className="absolute top-5 right-5 p-2 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={18}/></button>
          
          <div className="text-center space-y-1">
             <h3 className="text-xl font-black italic tracking-widest text-white uppercase">شحن الرصيد</h3>
             <p className="text-[9px] text-blue-500 font-black tracking-widest uppercase opacity-70">NETWORK: BEP20 (BSC)</p>
          </div>

          <div className="bg-[#1f2937]/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between gap-3 group">
             <p className="text-[10px] font-mono text-blue-400 break-all select-all flex-1 leading-tight">{DEPOSIT_ADDRESS}</p>
             <button onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('Address Copied', 'success'); }} className="p-2 bg-blue-600/20 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Copy size={14}/></button>
          </div>

          <div className="space-y-1 text-right px-1">
             <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">المبلغ المودع</p>
             <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border-none outline-none text-3xl font-black italic text-center py-4 rounded-2xl text-white placeholder-white/20" placeholder="0.00" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-end gap-2 px-1 text-slate-500">
               <p className="text-[9px] font-black uppercase tracking-widest">إرفاق لقطة شاشة للإثبات</p>
            </div>
            
            <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 flex items-start gap-3 text-right">
               <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
               <p className="text-[9px] text-blue-100 font-bold leading-relaxed italic">يجب إرفاق لقطة شاشة واضحة من محفظتك توضح تفاصيل عملية التحويل (مكتملة) لضمان سرعة معالجة الطلب.</p>
            </div>

            <div onClick={() => fileRef.current?.click()} className="w-full h-36 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer group hover:border-blue-500/50 transition-all overflow-hidden relative shadow-inner">
               {proof ? <img src={proof} className="w-full h-full object-cover" /> : <>
                 <ImageIcon size={28} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                 <p className="text-[10px] text-slate-400 font-black uppercase group-hover:text-blue-400">اضغط لاختيار صورة</p>
               </>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          <div className="flex items-center justify-center gap-2 opacity-50">
             <Lock size={10} className="text-emerald-500" />
             <p className="text-[8px] font-black uppercase text-emerald-500 tracking-tighter">بروتوكول تشفير الإيداع نشط ومؤمن بالكامل</p>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-blue-600 py-4 rounded-[1.5rem] font-black text-white text-sm uppercase tracking-[0.3em] shadow-lg active:scale-95 transition-all">
             {loading ? <Loader2 className="animate-spin mx-auto" /> : (lang === 'ar' ? 'تأكيد' : 'CONFIRM')}
          </button>
       </div>
    </div>
  );
};

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
       <div className="bg-[#111827] w-full max-w-md rounded-[3rem] border border-white/10 p-8 space-y-6 relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] no-scrollbar">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={20}/></button>
          
          <h3 className="text-2xl font-black italic text-white uppercase text-center tracking-widest">{lang === 'ar' ? 'سحب الرصيد' : 'WITHDRAW'}</h3>
          
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 rounded-[2rem] border border-white/10 text-center shadow-lg">
             <p className="text-[11px] text-blue-200 font-black uppercase mb-1 tracking-widest">{lang === 'ar' ? 'المتاح للسحب' : 'AVAILABLE TO WITHDRAW'}</p>
             <p className="text-2xl font-black text-white italic tracking-tighter">USDT {userData.withdrawableBalance.toFixed(2)}</p>
          </div>

          <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-3 shadow-lg">
             <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                <AlertCircle size={18} />
             </div>
             <p className="text-[11px] text-red-200 font-bold leading-tight">{lang === 'ar' ? `الحد الأدنى للسحب هو ${MIN_WITHDRAWAL} USDT` : `Min withdrawal is ${MIN_WITHDRAWAL} USDT`}</p>
          </div>

          <div className="space-y-4">
             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">{lang === 'ar' ? 'عنوان محفظة (BEP20)' : 'WALLET ADDRESS (BEP20)'}</p>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="1uytretdtfyguh" className="w-full bg-[#020617]/60 border border-white/5 p-5 rounded-2xl text-white outline-none font-mono text-sm placeholder-white/10 focus:border-blue-500/30 transition-all shadow-inner" />
             </div>

             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-2">{lang === 'ar' ? 'الكمية' : 'AMOUNT'}</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.50" className="w-full bg-[#020617]/60 border border-red-500/20 p-5 rounded-2xl text-white outline-none font-black italic text-xl placeholder-white/10 focus:border-red-500/50 transition-all shadow-inner" />
             </div>
          </div>

          <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/10 flex items-start gap-4 shadow-lg">
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

export default App;