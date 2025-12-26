
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, X, Copy, Zap, Settings, RefreshCw, 
  MessageCircle, Send, LogOut, TrendingUp, Activity, Info, 
  Briefcase, History, Eye, Search, Check, XCircle, Image as ImageIcon,
  Upload, Camera, Headphones, Calendar, ArrowUpRight, Award, Gem, Layers,
  Info as InfoIcon, Lock, ShieldAlert, BadgeCheck, ExternalLink, Mail, Clock,
  AlertCircle, HelpCircle, LifeBuoy, Coins
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL, REFERRAL_PERCENT } from './constants';
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
    let finalMsg = "حدث خطأ غير معروف";
    if (typeof message === 'string') finalMsg = message;
    else if (message instanceof Error) finalMsg = message.message;
    else if (message && typeof message === 'object') finalMsg = message.message || message.details || JSON.stringify(message);

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
        const { data: newProfile, error } = await supabase.from('profiles').insert([
          { 
            id: userId, balance: 0, withdrawable_balance: 0, 
            referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
            first_name: 'User', last_name: '', email: userEmail
          }
        ]).select().single();
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
      if (isManual) showToast(lang === 'ar' ? "تم التحديث بنجاح" : "Data Updated", "success");
    } catch (err: any) { 
      showToast(err, "error");
    } 
    finally { setLoading(false); setSyncing(false); }
  }, [lang, fetchAdminUUID, showToast]);

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
    if (!userData || !session?.user || isProcessing) return;
    if (userData.balance < machine.price) {
      return showToast(lang === 'ar' ? "الرصيد غير كافٍ" : "Insufficient balance", 'error');
    }
    setIsProcessing(true);
    try {
      const { error: buyErr } = await supabase.from('user_machines').insert({
        user_id: session.user.id,
        machine_id: machine.id,
        remaining_days: machine.duration,
        total_earned: 0
      });
      if (buyErr) throw buyErr;

      const { error: updErr } = await supabase.from('profiles').update({ balance: Number(userData.balance) - machine.price }).eq('id', session.user.id);
      if (updErr) throw updErr;

      showToast(lang === 'ar' ? "تم تفعيل الماكينة بنجاح" : "Mining Activated", 'success');
      await fetchAllUserData(session.user.id, session.user.email!);
    } catch (e: any) { showToast(e, 'error'); }
    finally { setIsProcessing(false); }
  };

  const completeTask = async (um: UserMachine) => {
    if (!userData || !session?.user || isProcessing) return;
    const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
    if (Date.now() - lastClaim < 24 * 60 * 60 * 1000) {
      return showToast(lang === 'ar' ? "المهمة متاحة مرة كل 24 ساعة" : "Check back in 24h", 'error');
    }
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    setIsProcessing(true);
    try {
      const { error: umErr } = await supabase.from('user_machines').update({
        last_claim_date: new Date().toISOString(),
        total_earned: (um.total_earned || 0) + machine.dailyProfit,
        remaining_days: Math.max(0, um.remaining_days - 1)
      }).eq('id', um.id);
      if (umErr) throw umErr;

      const { error: profErr } = await supabase.from('profiles').update({ 
        balance: Number(userData.balance) + machine.dailyProfit,
        withdrawable_balance: Number(userData.withdrawableBalance) + machine.dailyProfit
      }).eq('id', session.user.id);
      if (profErr) throw profErr;

      const { error: txErr } = await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed' });
      if (txErr) throw txErr;

      showToast(lang === 'ar' ? "تم استلام أرباح التعدين" : "Profits Claimed", 'success');
      await fetchAllUserData(session.user.id, session.user.email!);
    } catch (e: any) { showToast(e, 'error'); }
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
      
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[85%] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl pointer-events-auto backdrop-blur-3xl border border-white/10 ${toast.type === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-100'}`}>
            <span className="text-[12px] font-bold">{String(toast.message)}</span>
          </div>
        ))}
      </div>

      <header className="px-4 py-5 border-b border-white/5 backdrop-blur-xl sticky top-0 z-40 bg-[#020617]/80 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500/20 transition-all"><LogOut size={22} /></button>
           
           <div className="relative">
             <button onClick={() => setShowSupport(true)} className="flex items-center gap-2 p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl hover:bg-blue-500/20 transition-all group relative">
               <MessageCircle size={22} className="animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-widest">{lang === 'ar' ? 'الدعم الفني' : 'Support'}</span>
               <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#020617] animate-bounce"></div>
             </button>
           </div>

           <button onClick={() => fetchAllUserData(session.user.id, session.user.email || '', true)} className={`p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl ${syncing ? 'animate-spin' : ''}`}>
             <RefreshCw size={22} />
           </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-black italic text-xl tracking-tighter uppercase">MINE<span className="text-blue-500">PRO</span></span>
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]"><Zap size={20} className="text-white fill-white" /></div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} onShowSupport={() => setShowSupport(true)} lang={lang} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} lang={lang} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} lang={lang} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} lang={lang} showToast={showToast} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} lang={lang} />} />
          <Route path="/admin" element={userData.email === ADMIN_EMAIL ? <AdminView t={t} showToast={showToast} lang={lang} adminId={adminUUID} /> : <Navigate to="/" />} />
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
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[2.5rem] text-white shadow-[0_20px_50px_rgba(37,99,235,0.3)] relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
         <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 italic">{t('balanceTitle')}</p>
                  <h2 className="text-4xl font-black italic tracking-tight">{(user.balance || 0).toFixed(2)} <span className="text-xl opacity-50 not-italic uppercase ml-1">USDT</span></h2>
               </div>
               <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl"><TrendingUp size={28} /></div>
            </div>
            
            <div className="flex gap-4 pt-2">
               <button onClick={onShowRecharge} className="flex-1 bg-white text-blue-700 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-xl"><ArrowUpRight size={18} /> {t('recharge')}</button>
               <button onClick={onShowWithdraw} className="flex-1 bg-blue-500/30 text-white border border-white/20 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 backdrop-blur-md hover:bg-white/10 transition-all">{t('withdraw')}</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <StatCard icon={Coins} label={lang === 'ar' ? 'أرباح الفريق' : 'Team Profit'} value={user.referralEarnings} color="text-emerald-500" bg="bg-emerald-500/10" />
         <StatCard icon={Cpu} label={lang === 'ar' ? 'الماكينات' : 'Runners'} value={user.ownedMachines.length} color="text-blue-500" bg="bg-blue-500/10" />
      </div>

      <div className="space-y-4">
         <button onClick={onShowSupport} className="w-full bg-[#0b0f1a] p-6 rounded-[2rem] border border-red-500/10 flex items-center gap-5 text-left group hover:border-red-500/30 transition-all active:scale-[0.98]">
            <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center group-hover:bg-red-500/20 transition-colors shadow-lg shadow-red-500/5">
               <AlertCircle size={30} />
            </div>
            <div className="flex-1">
               <h4 className="text-white font-black text-sm uppercase italic tracking-tight">{t('stuckFunds')}</h4>
               <p className="text-[10px] text-slate-500 font-bold mt-1">{t('stuckFundsDesc')}</p>
            </div>
            <ArrowUpRight size={18} className="text-slate-700 group-hover:text-red-500 transition-all" />
         </button>

         <div onClick={onShowInfo} className="w-full bg-[#0b0f1a] p-6 rounded-[2rem] border border-emerald-500/10 flex items-center gap-5 text-left group hover:border-emerald-500/30 transition-all cursor-pointer">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors shadow-lg shadow-emerald-500/5">
               <ShieldCheck size={30} />
            </div>
            <div className="flex-1">
               <h4 className="text-white font-black text-sm uppercase italic tracking-tight">{t('secureSystem')}</h4>
               <p className="text-[10px] text-slate-500 font-bold mt-1">{t('secureSystemDesc')}</p>
            </div>
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
         </div>

         <button onClick={onShowSupport} className="w-full bg-[#0b0f1a] p-6 rounded-[2rem] border border-blue-500/10 flex items-center gap-5 text-left group hover:border-blue-500/30 transition-all active:scale-[0.98]">
            <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors shadow-lg shadow-blue-500/5">
               <Headphones size={30} />
            </div>
            <div className="flex-1">
               <h4 className="text-white font-black text-sm uppercase italic tracking-tight">{t('needHelp')}</h4>
               <p className="text-[10px] text-slate-500 font-bold mt-1">{t('needHelpDesc')}</p>
            </div>
            <ArrowUpRight size={18} className="text-slate-700 group-hover:text-blue-500 transition-all" />
         </button>
      </div>

      <div className="space-y-4">
         <div className="flex justify-between items-center px-1">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] italic">{t('history')}</h4>
            <History size={16} className="text-slate-500" />
         </div>
         <div className="space-y-3">
            {user.transactions.slice(0, 3).map((tx: any) => (
               <div key={tx.id} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 flex justify-between items-center shadow-lg hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                     <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {tx.type === 'deposit' ? <Zap size={20} /> : tx.type === 'withdrawal' ? <ExternalLink size={20} /> : <TrendingUp size={20} />}
                     </div>
                     <div>
                        <p className="text-white font-black text-sm uppercase italic">{String(tx.type)}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">{new Date(tx.date).toLocaleDateString()}</p>
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

const AdminView = ({ t, showToast, lang, adminId }: any) => {
  const [mainTab, setMainTab] = useState<'deposit' | 'withdraw' | 'members' | 'messages'>('withdraw');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === 'members') {
        const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setData(users || []);
      } else if (mainTab === 'messages') {
        const { data: msgs } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
        const { data: users } = await supabase.from('profiles').select('id, first_name, email');
        
        if (msgs && users) {
          const uids = Array.from(new Set(msgs.map(m => m.sender_id === adminId ? m.receiver_id : m.sender_id))).filter(id => id && id !== adminId);
          const selfMsgUids = msgs.filter(m => m.sender_id === m.receiver_id).map(m => m.sender_id);
          const allUids = Array.from(new Set([...uids, ...selfMsgUids]));

          const list = allUids.map(uid => {
            const user = users.find(u => u.id === uid);
            const last = msgs.find(m => m.sender_id === uid || m.receiver_id === uid);
            return { userId: uid, name: user?.first_name || 'User', email: user?.email, lastMsg: last?.message, date: last?.created_at };
          });
          setData(list);
        }
      } else {
        const typeStr = mainTab === 'deposit' ? 'deposit' : 'withdrawal';
        let txQuery = supabase.from('transactions').select('*').eq('type', typeStr);
        if (subTab === 'new') txQuery = txQuery.eq('status', 'pending');
        else txQuery = txQuery.in('status', ['completed', 'failed']);

        const { data: txs, error: txError } = await txQuery.order('date', { ascending: false });
        if (txError) throw txError;

        if (txs && txs.length > 0) {
          const userIds = Array.from(new Set(txs.map(t => t.user_id)));
          const { data: profiles } = await supabase.from('profiles').select('id, first_name, email').in('id', userIds);
          const combined = txs.map(tx => ({ ...tx, profiles: profiles?.find(p => p.id === tx.user_id) || null }));
          setData(combined);
        } else setData([]);
      }
    } catch (e: any) { 
      showToast(e, "error");
    } finally { setLoading(false); }
  }, [mainTab, subTab, showToast, adminId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTx = async (tx: any, newStatus: 'completed' | 'failed') => {
    try {
      const { error: txError } = await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
      if (txError) throw txError;

      if (newStatus === 'completed') {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', tx.user_id).maybeSingle();
        if (profile) {
          if (tx.type === 'deposit') {
            const amount = Number(tx.amount);
            await supabase.from('profiles').update({ 
              balance: Number(profile.balance || 0) + amount, 
              total_recharge: Number(profile.total_recharge || 0) + amount 
            }).eq('id', tx.user_id);
          } else if (tx.type === 'withdrawal') {
            await supabase.from('profiles').update({ 
              total_withdraw: Number(profile.total_withdraw || 0) + Math.abs(Number(tx.amount)) 
            }).eq('id', tx.user_id);
          }
        }
      } 
      else if (newStatus === 'failed' && tx.type === 'withdrawal') {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', tx.user_id).maybeSingle();
        if (profile) {
          const refundAmt = Math.abs(Number(tx.amount));
          await supabase.from('profiles').update({ 
            balance: Number(profile.balance || 0) + refundAmt,
            withdrawable_balance: Number(profile.withdrawable_balance || 0) + refundAmt
          }).eq('id', tx.user_id);
        }
      }

      showToast(lang === 'ar' ? "تم التحديث بنجاح" : "Success", "success");
      fetchData();
    } catch (e: any) { showToast(e, "error"); }
  };

  if (activeChatUser) {
    return <SupportChatModal userId={activeChatUser} initialAdminId={adminId} onClose={() => setActiveChatUser(null)} lang={lang} isAdminReply={true} showToast={showToast} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-16">
       {selectedUserDetails && <UserDetailsModal userId={selectedUserDetails} onClose={() => setSelectedUserDetails(null)} lang={lang} showToast={showToast} />}

       <div className="bg-[#0b0f1a] p-2 rounded-[2rem] border border-white/5 flex gap-1.5 shadow-2xl overflow-x-auto no-scrollbar">
         <button onClick={() => setMainTab('deposit')} className={`flex-1 min-w-[80px] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${mainTab === 'deposit' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'إيداع' : 'Dep'}</button>
         <button onClick={() => setMainTab('withdraw')} className={`flex-1 min-w-[80px] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${mainTab === 'withdraw' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'سحب' : 'With'}</button>
         <button onClick={() => setMainTab('messages')} className={`flex-1 min-w-[80px] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${mainTab === 'messages' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'رسائل' : 'Chat'}</button>
         <button onClick={() => setMainTab('members')} className={`flex-1 min-w-[80px] py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider transition-all ${mainTab === 'members' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>{lang === 'ar' ? 'أعضاء' : 'Users'}</button>
       </div>

       {['deposit', 'withdraw'].includes(mainTab) && (
         <div className="flex justify-center gap-4 items-center">
            <div className="bg-[#0b0f1a] p-1.5 rounded-[1.8rem] border border-white/5 flex gap-1.5 w-full max-w-[320px] shadow-xl">
               <button onClick={() => setSubTab('new')} className={`flex-1 py-3 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest transition-all ${subTab === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>{lang === 'ar' ? 'الجديدة' : 'New'}</button>
               <button onClick={() => setSubTab('archive')} className={`flex-1 py-3 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest transition-all ${subTab === 'archive' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>{lang === 'ar' ? 'الأرشيف' : 'Archive'}</button>
            </div>
            <button onClick={fetchData} className="p-3 bg-blue-600/10 text-blue-500 rounded-full active:rotate-180 transition-transform"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
         </div>
       )}

       {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div> : (
         <div className="space-y-6">
           {mainTab === 'messages' && data.map((t: any) => (
              <div key={t.userId} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 flex justify-between items-center shadow-xl group">
                <div onClick={() => setSelectedUserDetails(t.userId)} className="flex gap-4 items-center overflow-hidden flex-1 cursor-pointer">
                   <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-lg italic shrink-0">{t.name ? t.name[0] : '?'}</div>
                   <div className="overflow-hidden">
                     <p className="text-white font-black text-sm uppercase italic truncate hover:text-blue-400 transition-colors">{String(t.name)}</p>
                     <p className="text-[10px] text-slate-500 truncate">{String(t.lastMsg)}</p>
                   </div>
                </div>
                <div onClick={() => setActiveChatUser(t.userId)} className="text-right shrink-0 ml-2 cursor-pointer p-2 hover:bg-white/5 rounded-xl transition-all">
                   <p className="text-[9px] text-slate-700 font-black">{new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   <div className="w-2.5 h-2.5 bg-blue-600 rounded-full ml-auto mt-2 animate-pulse"></div>
                </div>
              </div>
           ))}

           {['deposit', 'withdraw'].includes(mainTab) && data.map((item: any) => (
             <div key={item.id} className="bg-[#0b0f1a] p-7 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                   <div onClick={() => setSelectedUserDetails(item.user_id)} className="cursor-pointer group">
                     <h4 className="text-white font-black text-lg uppercase italic tracking-tight truncate max-w-[150px] group-hover:text-blue-400 transition-colors">{String(item.profiles?.first_name || 'Anonymous')}</h4>
                     <p className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{String(item.profiles?.email || 'No Email')}</p>
                   </div>
                   <div className="text-right">
                     <p className="text-3xl font-black text-white italic mt-1">{Math.abs(item.amount || item.balance || 0).toFixed(2)}</p>
                   </div>
                </div>
                <div className="bg-black/60 p-5 rounded-[1.5rem] border border-white/5 space-y-3">
                   <p className="text-[10px] text-blue-500 font-bold uppercase text-center border-b border-white/5 pb-3">{mainTab === 'deposit' ? 'Verification Proof' : 'Wallet Address'}</p>
                   {mainTab === 'withdraw' ? (
                     <p className="text-[11px] text-slate-300 font-mono break-all text-center pt-2">{String(item.details || 'N/A')}</p>
                   ) : (
                     <div className="flex flex-col items-center gap-4">
                       {item.proof_url ? (
                         <div className="text-center w-full">
                           <img src={String(item.proof_url)} alt="proof" className="max-h-64 rounded-2xl border border-white/10 mx-auto shadow-2xl" />
                           <a href={String(item.proof_url)} target="_blank" rel="noreferrer" className="block mt-2 text-[10px] text-blue-500 font-black underline">VIEW IMAGE PROTOCOL</a>
                         </div>
                       ) : <p className="text-xs opacity-30 italic">No proof protocol attached</p>}
                     </div>
                   )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex gap-3 pt-2">
                     <button onClick={() => handleTx(item, 'completed')} className="flex-1 bg-emerald-600 py-4.5 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg">Approve</button>
                     <button onClick={() => handleTx(item, 'failed')} className="flex-1 bg-red-600/10 text-red-500 py-4.5 rounded-2xl font-black text-[11px] uppercase border border-red-500/20">Reject</button>
                  </div>
                )}
             </div>
           ))}

           {mainTab === 'members' && data.map((item: any) => (
             <div key={item.id} onClick={() => setSelectedUserDetails(item.id)} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 space-y-3 cursor-pointer hover:border-blue-500/30 transition-all group active:scale-[0.98]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-xs">{item.first_name ? item.first_name[0] : '?'}</div>
                    <div>
                      <p className="text-white font-black text-sm uppercase italic group-hover:text-blue-400">{String(item.first_name)}</p>
                      <p className="text-[10px] text-slate-500">{String(item.email)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-blue-500 italic">{(item.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
             </div>
           ))}
         </div>
       )}
    </div>
  );
};

const MachinesView = ({ user, onBuy, t, lang }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
      <div className="px-1 flex items-center gap-3">
         <div className="w-10 h-10 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center"><Layers size={20}/></div>
         <div>
            <h3 className="text-white font-black italic uppercase tracking-wider">{t('machines')}</h3>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Hardware Grid v3.0</p>
         </div>
      </div>

      <div className="space-y-6">
        {MACHINES.map(m => (
          <div key={m.id} className={`bg-gradient-to-br ${m.color} p-7 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden group`}>
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700"><Cpu size={120} /></div>
             <div className="relative z-10">
                <div className="flex justify-between items-start">
                   <div>
                      <h4 className="text-white font-black text-xl italic uppercase tracking-tight">{m.name}</h4>
                      <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mt-1">Lifecycle: {m.duration} days</p>
                   </div>
                   <div className="text-right">
                      <p className="text-2xl font-black text-white italic">{m.price} <span className="text-xs opacity-50 not-italic">USDT</span></p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                   <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/5 text-center">
                      <p className="text-[9px] text-white/50 font-black uppercase mb-1">Daily Yield</p>
                      <p className="text-lg font-black text-emerald-400 italic">+{m.dailyProfit} <span className="text-[10px]">USDT</span></p>
                   </div>
                   <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/5 text-center">
                      <p className="text-[9px] text-white/50 font-black uppercase mb-1">Total ROI</p>
                      <p className="text-lg font-black text-blue-400 italic">{(m.dailyProfit * m.duration).toFixed(1)} <span className="text-[10px]">USDT</span></p>
                   </div>
                </div>

                <p className="text-[11px] text-white/70 italic leading-relaxed mt-6 line-clamp-2">{m.description}</p>

                <button onClick={() => onBuy(m)} className="w-full mt-6 bg-white text-slate-900 py-4.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 group">
                   <Zap size={16} className="fill-current" /> {t('buyNow')}
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TasksView = ({ user, onComplete, t, lang }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
      <div className="px-1 flex items-center gap-3">
         <div className="w-10 h-10 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center"><ListTodo size={20}/></div>
         <div>
            <h3 className="text-white font-black italic uppercase tracking-wider">{t('tasks')}</h3>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Active Harvesting Protocols</p>
         </div>
      </div>

      <div className="space-y-4">
        {user.ownedMachines.length === 0 ? (
          <div className="bg-[#0b0f1a] p-10 rounded-[2rem] border border-white/5 text-center">
             <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">No active runners found</p>
          </div>
        ) : user.ownedMachines.map((um: UserMachine) => {
          const m = MACHINES.find(mach => mach.id === um.machine_id);
          const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
          const canClaim = Date.now() - lastClaim >= 24 * 60 * 60 * 1000;
          
          return (
            <div key={um.id} className="bg-[#0b0f1a] p-6 rounded-[2rem] border border-white/5 space-y-4 shadow-xl">
               <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-white font-black text-sm uppercase italic">{m?.name || 'Unknown Node'}</h4>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Remaining: {um.remaining_days} cycles</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-500 font-black italic">+{m?.dailyProfit.toFixed(2)} USDT</p>
                  </div>
               </div>
               
               <button 
                 onClick={() => onComplete(um)}
                 disabled={!canClaim}
                 className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${canClaim ? 'bg-emerald-600 text-white shadow-lg active:scale-95' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}
               >
                 {canClaim ? t('completeTask') : (lang === 'ar' ? 'انتظر للمطالبة' : 'Wait to Claim')}
               </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamView = ({ user, t, lang, showToast }: any) => {
  const copyLink = () => {
    navigator.clipboard.writeText(user.referral_code);
    showToast(lang === 'ar' ? "تم نسخ الرمز" : "Code Copied", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500 pb-10">
      <div className="px-1 flex items-center gap-3">
         <div className="w-10 h-10 bg-purple-600/20 text-purple-500 rounded-xl flex items-center justify-center"><Users size={20}/></div>
         <div>
            <h3 className="text-white font-black italic uppercase tracking-wider">{t('team')}</h3>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Network Expansion Protocol</p>
         </div>
      </div>

      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
         <div className="relative z-10 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Your Referral Code</p>
            <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/20">
               <span className="text-2xl font-black italic tracking-widest">{user.referral_code}</span>
               <button onClick={copyLink} className="p-2 bg-white text-purple-700 rounded-lg"><Copy size={18}/></button>
            </div>
            <p className="text-[9px] font-bold opacity-60 leading-relaxed uppercase">Earn {REFERRAL_PERCENT * 100}% on every mining claim from your direct network.</p>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <StatCard icon={Award} label={lang === 'ar' ? 'إجمالي الأرباح' : 'Total Earnings'} value={user.referralEarnings} color="text-purple-500" bg="bg-purple-500/10" />
         <StatCard icon={Users} label={lang === 'ar' ? 'أعضاء الفريق' : 'Direct Nodes'} value={0} color="text-blue-500" bg="bg-blue-500/10" />
      </div>
    </div>
  );
};

const ProfileView = ({ user, t, lang }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="flex flex-col items-center py-6 space-y-4">
         <div className="w-24 h-24 rounded-[2rem] bg-blue-600 p-1 shadow-2xl">
            <div className="w-full h-full bg-[#020617] rounded-[1.8rem] flex items-center justify-center text-blue-500 text-3xl font-black italic">
               {user.first_name[0]}
            </div>
         </div>
         <div className="text-center">
            <h3 className="text-xl font-black italic uppercase tracking-tight">{user.first_name} {user.last_name}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{user.email}</p>
         </div>
      </div>

      <div className="bg-[#0b0f1a] p-2 rounded-[2rem] border border-white/5 space-y-1">
         <ProfileItem label={t('recharge')} value={`${user.totalRecharge.toFixed(2)} USDT`} icon={Zap} color="text-emerald-500" />
         <ProfileItem label={t('withdraw')} value={`${user.totalWithdraw.toFixed(2)} USDT`} icon={ExternalLink} color="text-red-500" />
         <ProfileItem label={lang === 'ar' ? 'عضو منذ' : 'Member Since'} value={new Date(user.created_at).toLocaleDateString()} icon={Calendar} color="text-blue-500" />
      </div>

      <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest border border-red-500/10 flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all">
         <LogOut size={18} /> {lang === 'ar' ? 'تسجيل خروج' : 'Logout Protocol'}
      </button>
    </div>
  );
};

const ProfileItem = ({ label, value, icon: Icon, color }: any) => (
  <div className="flex justify-between items-center p-5 bg-[#020617]/50 rounded-2xl border border-transparent hover:border-white/5 transition-all">
     <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}><Icon size={18}/></div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
     </div>
     <span className="text-sm font-black italic text-white">{value}</span>
  </div>
);

const RechargeModal = ({ onClose, onDeposit, showToast, userId, lang }: any) => {
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!details) return showToast(lang === 'ar' ? 'يرجى إدخال تفاصيل الدفع' : 'Enter payment details', 'error');
    setLoading(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'deposit',
        amount: 0, 
        status: 'pending',
        details: details
      });
      if (error) throw error;
      showToast(lang === 'ar' ? "تم إرسال الطلب، في انتظار التأكيد" : "Request sent, awaiting confirmation", "success");
      onDeposit();
      onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
       <div className="bg-[#0b0f1a] w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center">
             <h3 className="text-white font-black italic uppercase tracking-widest text-lg">{lang === 'ar' ? 'إيداع رصيد' : 'DEPOSIT PROTOCOL'}</h3>
             <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
          </div>

          <div className="space-y-4">
             <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 space-y-2">
                <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Network: BEP20 (BSC)</p>
                <div className="flex items-center justify-between gap-2 bg-black/40 p-3 rounded-xl">
                   <p className="text-[11px] font-mono text-slate-300 break-all select-all">{DEPOSIT_ADDRESS}</p>
                   <button onClick={() => { navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('Address Copied', 'success'); }} className="p-2 bg-blue-600 text-white rounded-lg shrink-0"><Copy size={14}/></button>
                </div>
             </div>

             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Transaction ID / TXID</p>
                <input 
                  value={details} 
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Paste Hash or ID here" 
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-blue-500/50" 
                />
             </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} className="w-full bg-blue-600 py-5 rounded-3xl font-black text-white uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">
             {loading ? <Loader2 className="animate-spin mx-auto" /> : (lang === 'ar' ? 'تأكيد الإيداع' : 'SUBMIT PROTOCOL')}
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
    if (amt < MIN_WITHDRAWAL) return showToast(`Min withdrawal is ${MIN_WITHDRAWAL} USDT`, 'error');
    if (amt > userData.withdrawableBalance) return showToast('Insufficient balance', 'error');
    if (!address) return showToast('Enter wallet address', 'error');

    setLoading(true);
    try {
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'withdrawal',
        amount: -amt,
        status: 'pending',
        details: address
      });
      if (txErr) throw txErr;

      const { error: updErr } = await supabase.from('profiles').update({
        balance: Number(userData.balance) - amt,
        withdrawable_balance: Number(userData.withdrawableBalance) - amt
      }).eq('id', userId);
      if (updErr) throw updErr;

      showToast(lang === 'ar' ? "تم تقديم طلب السحب" : "Withdrawal request submitted", "success");
      onWithdraw();
      onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
       <div className="bg-[#0b0f1a] w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-8 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center">
             <h3 className="text-white font-black italic uppercase tracking-widest text-lg">{lang === 'ar' ? 'سحب رصيد' : 'WITHDRAW PROTOCOL'}</h3>
             <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
          </div>

          <div className="space-y-4">
             <div className="bg-red-500/10 p-6 rounded-3xl border border-red-500/20 text-center space-y-1">
                <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">Withdrawable Balance</p>
                <p className="text-2xl font-black text-white italic">{userData.withdrawableBalance.toFixed(2)} USDT</p>
             </div>

             <div className="space-y-4">
                <div className="space-y-2">
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Amount (Min: {MIN_WITHDRAWAL})</p>
                   <input 
                     type="number"
                     value={amount} 
                     onChange={e => setAmount(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-blue-500/50" 
                   />
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">USDT BEP20 Address</p>
                   <input 
                     value={address} 
                     onChange={e => setAddress(e.target.value)}
                     className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-blue-500/50" 
                   />
                </div>
             </div>
          </div>

          <button onClick={handleWithdraw} disabled={loading} className="w-full bg-red-600 py-5 rounded-3xl font-black text-white uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">
             {loading ? <Loader2 className="animate-spin mx-auto" /> : (lang === 'ar' ? 'سحب الآن' : 'INITIATE TRANSFER')}
          </button>
       </div>
    </div>
  );
};

const UserDetailsModal = ({ userId, onClose, lang, showToast }: any) => {
  const [u, setU] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newBalance, setNewBalance] = useState('');

  const fetchUser = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setU(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const updateBalance = async () => {
    try {
      const { error } = await supabase.from('profiles').update({ 
        balance: Number(newBalance),
        withdrawable_balance: Number(newBalance)
      }).eq('id', userId);
      if (error) throw error;
      showToast("Balance updated", "success");
      fetchUser();
    } catch (e: any) { showToast(e, "error"); }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
       <div className="bg-[#0b0f1a] w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 space-y-6 relative animate-in zoom-in duration-200">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
          
          <div className="space-y-4">
             <div className="text-center">
                <h4 className="text-white font-black uppercase italic">{u.first_name} {u.last_name}</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{u.email}</p>
             </div>
             
             <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                   <span>Current Balance</span>
                   <span className="text-white">{(u.balance || 0).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                   <span>Withdrawable</span>
                   <span className="text-white">{(u.withdrawable_balance || 0).toFixed(2)} USDT</span>
                </div>
             </div>

             <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Adjust Balance</p>
                <div className="flex gap-2">
                   <input value={newBalance} onChange={e => setNewBalance(e.target.value)} type="number" placeholder="New Balance" className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none text-xs" />
                   <button onClick={updateBalance} className="px-4 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase">Set</button>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, bg }: any) => (
  <div className={`${bg} p-6 rounded-[2rem] border border-white/5 space-y-3 shadow-xl`}>
     <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center ${color} border border-white/5`}><Icon size={20}/></div>
     <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black italic ${color}`}>{typeof value === 'number' ? value.toFixed(2) : value}</p>
     </div>
  </div>
);

const ProtocolLoadingScreen = () => (
  <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center space-y-4">
    <div className="relative">
      <div className="w-20 h-20 border-2 border-blue-500/20 rounded-full animate-ping absolute inset-0"></div>
      <div className="w-20 h-20 border-t-2 border-blue-500 rounded-full animate-spin"></div>
    </div>
    <span className="font-black italic text-xl tracking-tighter uppercase text-white">MINE<span className="text-blue-500">PRO</span></span>
  </div>
);

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast(lang === 'ar' ? "تم إنشاء الحساب بنجاح" : "Account created successfully", "success");
      }
    } catch (e: any) {
      showToast(e, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#020617] flex items-center justify-center p-6 ${lang === 'ar' ? 'rtl font-["Cairo"]' : ''}`}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 bg-blue-600 rounded-2xl items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] mb-4">
            <Zap size={32} className="text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-slate-500 mt-2 text-sm uppercase tracking-widest font-black">Digital Asset Factory</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-blue-500/50" required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-blue-500/50" required />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-white uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : (isLogin ? (lang === 'ar' ? 'تسجيل دخول' : 'Login') : (lang === 'ar' ? 'إنشاء حساب' : 'Register'))}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-slate-500 text-sm font-black uppercase tracking-wider">
          {isLogin ? (lang === 'ar' ? 'ليس لديك حساب؟ سجل الآن' : 'New here? Register') : (lang === 'ar' ? 'لديك حساب؟ سجل دخول' : 'Already have account? Login')}
        </button>
      </div>
    </div>
  );
};

const InfoModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
    <div className="bg-[#0b0f1a] w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 space-y-6 relative">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center mx-auto"><Info size={32}/></div>
        <h3 className="text-white font-black text-xl uppercase italic">About MINEPRO</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          نظام متقدم لتعدين العملات الرقمية يعتمد على تكنولوجيا الذكاء الاصطناعي لضمان أفضل عوائد يومية لمستخدمينا.
        </p>
      </div>
    </div>
  </div>
);

const SupportChatModal = ({ lang, onClose, userId, initialAdminId, showToast, isAdminReply }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('support_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
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
      const { error } = await supabase.from('support_messages').insert({
        sender_id: isAdminReply ? initialAdminId : userId,
        receiver_id: isAdminReply ? userId : initialAdminId,
        message: newMessage.trim()
      });
      if (error) throw error;
      setNewMessage('');
      fetchMessages();
    } catch (e: any) { showToast(e, "error"); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col animate-in slide-in-from-bottom duration-300">
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a]">
        <button onClick={onClose} className="p-2.5 bg-white/5 rounded-xl text-slate-400"><X size={24}/></button>
        <div className="text-center">
          <h3 className="text-white font-black italic uppercase tracking-widest">{lang === 'ar' ? 'الدعم الفني' : 'SUPPORT PROTOCOL'}</h3>
          <div className="flex items-center gap-1.5 justify-center mt-1">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Live Support Active</span>
          </div>
        </div>
        <div className="w-10"></div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-[#020617]">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : messages.map(m => {
          const isMe = isAdminReply ? m.sender_id === initialAdminId : m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-[1.5rem] text-sm font-medium ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none'}`}>
                {m.message}
                <p className={`text-[8px] mt-1 opacity-50 ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 bg-[#0b0f1a] border-t border-white/5">
        <div className="flex gap-3 bg-black/40 p-2 rounded-2xl border border-white/5">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={lang === 'ar' ? 'اكتب رسالتك...' : 'Type message...'} className="flex-1 bg-transparent border-none outline-none text-white px-3 text-sm" />
          <button onClick={sendMessage} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Send size={20}/></button>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 group relative">
    <div className={`p-2.5 rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-110' : 'text-slate-500 group-hover:text-blue-400 group-hover:bg-white/5'}`}>
      <Icon size={22} className={active ? 'fill-current' : ''} />
    </div>
    <span className={`text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${active ? 'text-blue-500' : 'text-slate-700 opacity-0 group-hover:opacity-100'}`}>{label}</span>
    {active && <div className="absolute -bottom-1 w-1 h-1 bg-blue-500 rounded-full"></div>}
  </button>
);

export default App;
