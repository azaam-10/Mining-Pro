
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  Loader2, ShieldCheck, X, Copy, Zap, Settings, RefreshCw, 
  MessageCircle, Send, LogOut, TrendingUp, Activity, Info, 
  Briefcase, History, Eye, Search, Check, XCircle, Image as ImageIcon,
  Upload, Camera, Headphones, Calendar, ArrowUpRight, Award, Gem, Layers
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
    } catch (e) { console.error("Admin fetch error", e); }
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
      {showSupport && <SupportChatModal lang={lang} onClose={() => setShowSupport(false)} userId={session.user.id} adminId={adminUUID} />}
      
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

const AdminView = ({ t, showToast, lang, adminId }: any) => {
  const [mainTab, setMainTab] = useState<'deposit' | 'withdraw' | 'members' | 'messages'>('withdraw');
  const [subTab, setSubTab] = useState<'new' | 'archive'>('new');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);

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
        
        if (msgs && users && adminId) {
          const uids = Array.from(new Set(msgs.map(m => m.sender_id === adminId ? m.receiver_id : m.sender_id))).filter(id => id !== adminId);
          const list = uids.map(uid => {
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

      if (tx.type === 'deposit' && newStatus === 'completed') {
        const { data: profile } = await supabase.from('profiles').select('balance, total_recharge').eq('id', tx.user_id).single();
        if (profile) {
          await supabase.from('profiles').update({ 
            balance: Number(profile.balance) + Math.abs(tx.amount),
            total_recharge: Number(profile.total_recharge || 0) + Math.abs(tx.amount) 
          }).eq('id', tx.user_id);
        }
      }
      showToast(lang === 'ar' ? "تم التحديث بنجاح" : "Success", "success");
      fetchData();
    } catch (e: any) { showToast(e, "error"); }
  };

  if (activeChatUser) {
    return <SupportChatModal userId={activeChatUser} adminId={adminId} onClose={() => setActiveChatUser(null)} lang={lang} isAdminReply={true} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-16">
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
              <div key={t.userId} onClick={() => setActiveChatUser(t.userId)} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 flex justify-between items-center cursor-pointer hover:border-blue-500/20 active:scale-95 transition-all shadow-xl group">
                <div className="flex gap-4 items-center overflow-hidden">
                   <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-black text-lg italic shrink-0">{String(t.name[0])}</div>
                   <div className="overflow-hidden">
                     <p className="text-white font-black text-sm uppercase italic truncate">{String(t.name)}</p>
                     <p className="text-[10px] text-slate-500 truncate">{String(t.lastMsg)}</p>
                   </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                   <p className="text-[9px] text-slate-700 font-black">{new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   <div className="w-2.5 h-2.5 bg-blue-600 rounded-full ml-auto mt-2 animate-pulse"></div>
                </div>
              </div>
           ))}

           {['deposit', 'withdraw'].includes(mainTab) && data.map((item: any) => (
             <div key={item.id} className="bg-[#0b0f1a] p-7 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="flex justify-between items-start">
                   <div>
                     <h4 className="text-white font-black text-lg uppercase italic tracking-tight truncate max-w-[150px]">{String(item.profiles?.first_name || 'Anonymous')}</h4>
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
             <div key={item.id} className="bg-[#0b0f1a] p-5 rounded-3xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-black text-sm uppercase italic">{String(item.first_name)}</p>
                    <p className="text-[10px] text-slate-500">{String(item.email)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-blue-500 italic">{(item.balance || 0).toFixed(2)}</p>
                  </div>
                </div>
             </div>
           ))}

           {data.length === 0 && (
             <div className="text-center py-20 opacity-20 space-y-4">
                <History size={48} className="mx-auto" />
                <p className="text-xs font-black uppercase tracking-widest">Buffer Empty</p>
             </div>
           )}
         </div>
       )}
    </div>
  );
};

const RechargeModal = ({ onClose, showToast, userId, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast(lang === 'ar' ? "حجم الصورة كبير جداً (الأقصى 2 ميجابايت)" : "File too large (Max 2MB)", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviewImage(base64);
        setBase64Image(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return showToast(lang === 'ar' ? "يرجى إدخال مبلغ صحيح" : "Invalid amount", "error");
    if (!base64Image) return showToast(lang === 'ar' ? "يرجى إرفاق صورة إثبات الإيداع" : "Proof screenshot required", "error");
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert({ 
        user_id: userId, 
        type: 'deposit', 
        amount: amt, 
        proof_url: base64Image, 
        status: 'pending', 
        date: new Date().toISOString() 
      });
      if (error) throw error;
      showToast(lang === 'ar' ? "تم إرسال الطلب، بانتظار المراجعة" : "Deposit requested", "success"); 
      onClose();
    } catch (e: any) {
      showToast(e, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-7 flex items-center justify-center backdrop-blur-xl animate-in zoom-in-95">
       <div className="bg-[#0b0f1a] w-full max-w-sm p-8 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
          <button onClick={onClose} className="absolute top-4 right-4 p-2.5 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
          
          <div className="text-center space-y-2">
            <h3 className="text-white font-black italic uppercase text-xl">{lang === 'ar' ? 'شحن الرصيد' : 'Deposit Node'}</h3>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Network: BEP20 (BSC)</p>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl text-[10px] break-all font-mono text-center border border-white/5 text-blue-400 select-all cursor-pointer group relative" onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast("Copied", "success")}}>
            {DEPOSIT_ADDRESS}
            <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center font-black">TAP TO COPY</div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-[9px] text-slate-500 font-black uppercase px-1">{lang === 'ar' ? 'المبلغ المودع' : 'USDT Amount'}</p>
              <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-white text-center font-black text-xl italic outline-none focus:border-blue-500/50" />
            </div>

            <div className="space-y-1.5">
              <p className="text-[9px] text-slate-500 font-black uppercase px-1">{lang === 'ar' ? 'إرفاق لقطة شاشة للإثبات' : 'Proof Screenshot'}</p>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              
              {!previewImage ? (
                <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-white/10 bg-white/5 p-8 rounded-2xl flex flex-col items-center gap-3 group hover:border-blue-500/30 transition-all">
                  <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><ImageIcon size={24} /></div>
                  <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">{lang === 'ar' ? 'اضغط لاختيار صورة' : 'TAP TO ADD IMAGE'}</p>
                </button>
              ) : (
                <div className="relative group">
                   <img src={previewImage} alt="preview" className="w-full h-40 object-cover rounded-2xl border border-white/10" />
                   <button onClick={() => {setPreviewImage(null); setBase64Image(null)}} className="absolute top-2 right-2 bg-red-500 p-1.5 rounded-lg text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                     <p className="text-[10px] font-black uppercase text-white tracking-[0.2em]">{lang === 'ar' ? 'تغيير الصورة' : 'CHANGE IMAGE'}</p>
                   </div>
                </div>
              )}
            </div>
          </div>

          <button onClick={submit} disabled={submitting} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-white text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : (lang === 'ar' ? 'تأكيد وإرسال' : 'SUBMIT PROTOCOL') }
          </button>
       </div>
    </div>
  );
};

const WithdrawModal = ({ onClose, userData, userId, showToast, lang }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt < MIN_WITHDRAWAL) return showToast(lang === 'ar' ? `أقل سحب ${MIN_WITHDRAWAL} USDT` : `Min: ${MIN_WITHDRAWAL}`, "error");
    if (amt > (userData?.withdrawableBalance || 0)) return showToast(lang === 'ar' ? "رصيد غير كافٍ" : "Insufficient funds", "error");
    if (!address.trim()) return showToast(lang === 'ar' ? "أدخل العنوان" : "Address required", "error");
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert({ 
        user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', 
        date: new Date().toISOString(), details: address.trim()
      });
      if (error) throw error;
      await supabase.from('profiles').update({ 
        balance: Number(userData.balance) - amt, 
        withdrawable_balance: Number(userData.withdrawableBalance) - amt 
      }).eq('id', userId);

      showToast(lang === 'ar' ? "تم إرسال طلب السحب" : "Withdrawal requested", "success"); 
      onClose();
    } catch (e: any) { showToast(e, "error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 p-7 flex items-center justify-center backdrop-blur-xl animate-in zoom-in-95">
       <div className="bg-[#0b0f1a] w-full max-sm p-8 rounded-[2.5rem] border border-white/10 space-y-6 shadow-2xl relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2.5 bg-white/5 rounded-xl text-slate-400"><X size={20}/></button>
          <div className="text-center space-y-2">
            <h3 className="text-white font-black italic uppercase text-xl">{lang === 'ar' ? 'سحب الرصيد' : 'Asset Release'}</h3>
          </div>
          <div className="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/20 text-center">
            <p className="text-[9px] text-blue-400 uppercase font-black">{lang === 'ar' ? 'المتاح للسحب' : 'Available balance'}</p>
            <p className="text-2xl font-black text-white italic">{(userData?.withdrawableBalance || 0).toFixed(2)} USDT</p>
          </div>
          <div className="space-y-4">
            <input placeholder="0x..." value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-[11px] text-white font-mono outline-none" />
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-center text-white font-black text-xl italic outline-none" />
          </div>
          <button onClick={submit} disabled={submitting} className="w-full bg-white text-black py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex justify-center items-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : (lang === 'ar' ? 'تأكيد السحب' : 'Establish Payout') }
          </button>
       </div>
    </div>
  );
};

// --- Shared Components ---

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw, onShowSupport, lang }: any) => (
  <div className="space-y-6 animate-in fade-in">
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[2rem] p-7 shadow-2xl space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
      <div className="flex justify-between items-center relative z-10">
        <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.2em]">{t('balanceTitle')}</p>
        <button onClick={onShowInfo} className="text-blue-500 text-[10px] font-black tracking-widest uppercase">Protocol info</button>
      </div>
      <h2 className="text-5xl font-black text-white italic tracking-tighter relative z-10">{(Number(user?.balance) || 0).toFixed(2)}<span className="text-sm text-blue-500 ml-2 not-italic font-bold tracking-widest">USDT</span></h2>
      <div className="flex gap-4 relative z-10">
        <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-4 rounded-2xl text-[12px] uppercase shadow-xl active:scale-95 transition-all">{t('recharge')}</button>
        <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl text-[12px] uppercase shadow-xl active:scale-95 transition-all">{t('withdraw')}</button>
      </div>
    </div>

    <div className="bg-gradient-to-r from-blue-600/10 to-transparent border border-blue-500/20 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
       <div className="flex items-center gap-5 relative z-10">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg animate-bounce">
             <Headphones size={24} />
          </div>
          <div className="flex-1">
             <h4 className="text-white font-black text-sm uppercase italic">{lang === 'ar' ? 'هل تحتاج إلى مساعدة؟' : 'Need Assistance?'}</h4>
             <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'فريق الدعم متاح للرد على استفساراتكم 24/7' : 'Our agents are available to help you 24/7'}</p>
          </div>
          <button onClick={onShowSupport} className="bg-white text-black text-[9px] font-black px-4 py-3 rounded-xl uppercase shadow-xl active:scale-90 transition-all">
             {lang === 'ar' ? 'تحدث معنا' : 'Chat Now'}
          </button>
       </div>
    </div>

    <div className="space-y-4">
       <h3 className="text-[10px] font-black uppercase text-slate-600 px-1 tracking-[0.3em]">{t('history')}</h3>
       {user?.transactions.slice(0, 5).map((tx: any) => (
         <div key={tx.id} className="bg-[#0b0f1a] p-5 rounded-2xl border border-white/5 flex justify-between items-center shadow-lg">
           <div className="flex gap-4 items-center">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
               {tx.type === 'task' ? <TrendingUp size={16}/> : (tx.type === 'deposit' ? <Zap size={16}/> : <Activity size={16}/>)}
             </div>
             <div>
               <p className="text-xs font-black text-white uppercase italic">{String(tx.type)}</p>
               <p className="text-[9px] text-slate-700 font-bold">{new Date(tx.date).toLocaleDateString()}</p>
             </div>
           </div>
           <p className={`font-black text-lg ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}</p>
         </div>
       ))}
    </div>
  </div>
);

const MachinesView = ({ user, onBuy, t, lang }: any) => {
  const getTierClass = (price: number) => {
    if (price <= 100) return 'tier-bronze-fx'; 
    if (price <= 1000) return 'tier-gold-fx';
    if (price <= 10000) return 'tier-platinum-fx shimmer-effect';
    return 'tier-diamond-fx shimmer-effect';
  };

  const getTierIcon = (price: number) => {
    if (price <= 100) return <Award size={24} />;
    if (price <= 1000) return <Layers size={24} />;
    if (price <= 10000) return <Gem size={24} />;
    return <Zap size={24} />;
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-8">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-black italic uppercase text-white">{t('machines')}</h2>
        <span className="text-[9px] bg-white/5 px-3 py-1 rounded-full text-slate-500 font-black uppercase tracking-widest border border-white/5">Auto-Mining Protocol</span>
      </div>
      
      <div className="space-y-8">
        {MACHINES.map((m) => {
          const owned = (user?.ownedMachines || []).some((om: any) => om.machine_id === m.id);
          const totalROI = (m.dailyProfit * m.duration).toFixed(2);
          const tierClass = getTierClass(m.price);

          return (
            <div 
              key={m.id} 
              className={`bg-[#0b0f1a] rounded-[2.5rem] p-8 border border-white/5 space-y-6 shadow-2xl relative overflow-hidden transition-all hover:border-white/20 active:scale-[0.98] ${tierClass} ${owned ? 'ring-2 ring-blue-500/40 ring-offset-4 ring-offset-[#020617]' : ''}`}
            >
               {/* Tier Header */}
               <div className="flex justify-between items-start relative z-10">
                  <div className="flex gap-4 items-center">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shadow-xl animate-float`}>
                      {getTierIcon(m.price)}
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-white uppercase italic tracking-tighter leading-none">{String(m.name)}</h3>
                      <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.3em] mt-1.5 opacity-80">Tier Status: Optimized</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{lang === 'ar' ? 'السعر' : 'Unit Cost'}</p>
                    <p className="text-3xl font-black text-white italic tracking-tighter">
                      {m.price}<span className="text-xs not-italic ml-1 text-blue-500">U</span>
                    </p>
                  </div>
               </div>

               {/* Stats Grid */}
               <div className="grid grid-cols-3 gap-3 relative z-10">
                  <div className="bg-black/40 border border-white/5 p-4 rounded-3xl text-center backdrop-blur-md">
                    <TrendingUp size={14} className="mx-auto mb-1.5 text-emerald-500" />
                    <p className="text-[8px] text-slate-500 font-black uppercase mb-1">{lang === 'ar' ? 'يومي' : 'Daily'}</p>
                    <p className="text-sm font-black text-emerald-500">+{m.dailyProfit}</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-4 rounded-3xl text-center backdrop-blur-md">
                    <Calendar size={14} className="mx-auto mb-1.5 text-blue-500" />
                    <p className="text-[8px] text-slate-500 font-black uppercase mb-1">{lang === 'ar' ? 'المدة' : 'Cycle'}</p>
                    <p className="text-sm font-black text-blue-400">{m.duration}D</p>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-4 rounded-3xl text-center backdrop-blur-md">
                    <ArrowUpRight size={14} className="mx-auto mb-1.5 text-purple-500" />
                    <p className="text-[8px] text-slate-500 font-black uppercase mb-1">{lang === 'ar' ? 'الإجمالي' : 'ROI'}</p>
                    <p className="text-sm font-black text-purple-400">+{totalROI}</p>
                  </div>
               </div>

               {/* Action Button */}
               <button 
                  onClick={() => !owned && onBuy(m)} 
                  disabled={owned} 
                  className={`w-full py-5 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.25em] transition-all relative overflow-hidden shadow-2xl ${owned ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white text-black active:scale-95'}`}
               >
                  {owned ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                      NODE STABLE
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      {lang === 'ar' ? 'تفعيل الآن' : 'Initialize Protocol'}
                    </span>
                  )}
               </button>
               
               {/* Background Decorative Element */}
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 blur-3xl rounded-full pointer-events-none"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TasksView = ({ user, onComplete, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in pb-8">
    <h2 className="text-xl font-black italic uppercase text-white px-1">{t('tasks')}</h2>
    {(user?.ownedMachines || []).map((um: any) => {
      const m = MACHINES.find(x => x.id === um.machine_id);
      const lastClaim = um.last_claim_date ? new Date(um.last_claim_date).getTime() : 0;
      const isLocked = Date.now() - lastClaim < 24 * 60 * 60 * 1000;
      return (
        <div key={um.id} className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/5 space-y-5 shadow-2xl">
           <div className="flex justify-between items-center">
              <div>
                 <p className="text-white font-black text-base uppercase italic tracking-tight">{String(m?.name)}</p>
                 <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-1">{um.remaining_days} CYCLES LEFT</p>
              </div>
              <p className="text-2xl font-black text-emerald-500 italic">+{Number(m?.dailyProfit).toFixed(2)}</p>
           </div>
           <button onClick={() => !isLocked && onComplete(um)} disabled={isLocked} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl ${isLocked ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>
              {isLocked ? 'STABILIZING...' : t('completeTask')}
           </button>
        </div>
      );
    })}
    {(user?.ownedMachines || []).length === 0 && <div className="py-24 text-center opacity-20 space-y-4"><Cpu size={60} className="mx-auto" /><p className="text-xs font-black uppercase tracking-widest">No Active Nodes</p></div>}
  </div>
);

const TeamView = ({ user, t, lang, showToast }: any) => {
  return (
    <div className="space-y-6 animate-in fade-in pb-8">
      <h2 className="text-xl font-black italic uppercase text-white px-1">{t('team')}</h2>
      <div className="bg-[#0b0f1a] rounded-[2rem] p-7 border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
        <div className="space-y-2 relative z-10">
          <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.2em]">Network Program</p>
          <h3 className="text-2xl font-black text-white italic tracking-tight uppercase">Affiliate Link</h3>
          <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
            {lang === 'ar' ? `اربح عمولة ${REFERRAL_PERCENT * 100}% فورية من كل إيداع يقوم به فريقك.` : `Earn ${REFERRAL_PERCENT * 100}% instant reward on team deposits.`}
          </p>
        </div>
        <div className="space-y-3 relative z-10">
          <div onClick={() => { if (user?.referral_code) { navigator.clipboard.writeText(user.referral_code); showToast(lang === 'ar' ? "تم النسخ" : "Copied", "success"); } }} className="p-4 bg-black/60 rounded-2xl border border-white/5 flex justify-between items-center cursor-pointer group hover:border-blue-500/30">
            <span className="text-white font-mono font-black text-lg uppercase tracking-widest">{user?.referral_code || '---'}</span>
            <Copy size={18} className="text-blue-500 group-hover:scale-110" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Total Rewards</p>
            <p className="text-xl font-black text-emerald-500 italic">{(user?.referralEarnings || 0).toFixed(2)} <span className="text-[8px] not-italic">USDT</span></p>
          </div>
          <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-center">
            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Status</p>
            <p className="text-xl font-black text-blue-400 uppercase italic">Elite</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProfileView = ({ user, t, lang }: any) => (
  <div className="space-y-6 animate-in fade-in pb-8">
    <div className="p-7 bg-[#0b0f1a] border border-white/10 rounded-[2rem] shadow-2xl flex items-center gap-6 relative overflow-hidden">
       <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-2 shadow-2xl">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id || 'default'}`} className="w-full h-full" alt="avatar"/>
       </div>
       <div>
          <h3 className="text-2xl font-black text-white italic tracking-tight">{String(user?.first_name)}</h3>
          <p className="text-[10px] text-blue-500 font-mono font-bold uppercase">{String(user?.email)}</p>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-5">
       <div className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/5 shadow-xl"><p className="text-[10px] text-slate-600 uppercase font-black">Total Deposit</p><p className="text-2xl font-black text-emerald-500 italic mt-2">{(user?.totalRecharge || 0).toFixed(2)}</p></div>
       <div className="bg-[#0b0f1a] p-6 rounded-3xl border border-white/5 shadow-xl"><p className="text-[10px] text-slate-600 uppercase font-black">Total Payout</p><p className="text-2xl font-black text-red-500 italic mt-2">{(user?.totalWithdraw || 0).toFixed(2)}</p></div>
    </div>
  </div>
);

const AuthView = ({ lang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email.trim(), password: formData.password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email: formData.email.trim(), 
          password: formData.password, 
          options: { data: { first_name: formData.firstName.trim(), last_name: formData.lastName.trim() } }
        });
        if (error) throw error;
        showToast(lang === 'ar' ? "نجاح! يرجى تسجيل الدخول" : "Success! Please Login.", "success"); 
        setIsLogin(true);
      }
    } catch (e: any) { showToast(e, 'error'); }
    finally { setAuthLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#020617] p-7 flex flex-col justify-center animate-in fade-in">
       <div className="max-w-xs mx-auto w-full space-y-10">
          <div className="text-center">
            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase scale-110 drop-shadow-[0_0_20px_rgba(37,99,235,0.3)]">MINE<span className="text-blue-500">PRO</span></h1>
            <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2 opacity-60">Distributed protocol</p>
          </div>
          <form onSubmit={handleAuth} className="bg-[#0b0f1a] p-7 rounded-[2.5rem] border border-white/10 space-y-5 shadow-2xl relative">
             <div className="flex p-1.5 bg-black/60 rounded-2xl mb-6 shadow-inner border border-white/5">
                <button type="button" onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all ${isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>LOGIN</button>
                <button type="button" onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600'}`}>JOIN</button>
             </div>
             {!isLogin && <input placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-blue-500/50" required />}
             <input placeholder="Email Node" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-blue-500/50" required />
             <input type="password" placeholder="Cipher" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#020617] border border-white/5 p-4 rounded-2xl text-xs text-white outline-none focus:border-blue-500/50" required />
             <button disabled={authLoading} className="w-full bg-white text-black font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 flex justify-center items-center gap-2 mt-4">
                {authLoading ? <Loader2 className="animate-spin" size={18} /> : 'Uplink active'}
             </button>
          </form>
       </div>
    </div>
  );
};

const ProtocolLoadingScreen = () => <div className="min-h-screen bg-[#020617] flex items-center justify-center flex-col gap-8"><div className="relative"><Loader2 className="animate-spin text-blue-500" size={56}/><div className="absolute inset-0 bg-blue-500/30 blur-3xl rounded-full"></div></div><p className="text-[10px] font-black text-slate-500 tracking-[0.6em] uppercase animate-pulse">Establishing Connection</p></div>;
const NavItem = ({ icon: Icon, label, active, onClick }: any) => <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 relative ${active ? 'text-blue-500 scale-110' : 'text-slate-700 opacity-40 hover:opacity-100 hover:scale-105'}`}><Icon size={22}/><span className="text-[8px] font-black uppercase tracking-[0.2em]">{label}</span></button>;
const InfoModal = ({ onClose }: any) => <div className="fixed inset-0 bg-black/98 z-[300] flex items-center justify-center p-10 text-center animate-in fade-in"><div className="max-w-xs space-y-8"><div className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)]"><ShieldCheck size={48} className="text-white"/></div><div className="space-y-3"><h3 className="text-3xl font-black italic uppercase">MINE<span className="text-blue-500">PRO</span> ELITE</h3><p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.3em] opacity-60">Mining Infrastructure v3.4.1</p></div><button onClick={onClose} className="w-full bg-white text-black py-5 rounded-[1.8rem] font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl">Confirm Access</button></div></div>;

const SupportChatModal = ({ userId, adminId, onClose, lang, isAdminReply = false }: any) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!userId || !adminId) return;
    const { data } = await supabase.from('support_messages').select('*').or(`and(sender_id.eq.${userId},receiver_id.eq.${adminId}),and(sender_id.eq.${adminId},receiver_id.eq.${userId})`).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [userId, adminId]);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel(`support-${userId}`).on('postgres_changes', { event: 'INSERT', table: 'support_messages' }, fetchMessages).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [userId, adminId, fetchMessages]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!newMessage.trim() || !userId || !adminId) return;
    const sender = isAdminReply ? adminId : userId;
    const receiver = isAdminReply ? userId : adminId;
    const msg = newMessage; setNewMessage('');
    await supabase.from('support_messages').insert({ sender_id: sender, receiver_id: receiver, message: msg });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 flex flex-col animate-in fade-in backdrop-blur-md">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-xl">
        <button onClick={onClose} className="p-2.5 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
        <h3 className="font-black text-white italic tracking-widest uppercase">{isAdminReply ? 'Client Terminal' : 'Support Node'}</h3>
        <div className="w-10"></div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-7 space-y-5 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${((isAdminReply && m.sender_id === adminId) || (!isAdminReply && m.sender_id === userId)) ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-[1.5rem] text-[12px] font-black shadow-2xl ${((isAdminReply && m.sender_id === adminId) || (!isAdminReply && m.sender_id === userId)) ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'}`}>{String(m.message)}</div>
          </div>
        ))}
      </div>
      <div className="p-5 bg-[#0b0f1a] border-t border-white/5 flex gap-3 shadow-2xl pb-10">
        <button onClick={send} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Send size={22}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && send()} placeholder="..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 text-sm text-white outline-none focus:border-blue-500/50" />
      </div>
    </div>
  );
};

export default App;
