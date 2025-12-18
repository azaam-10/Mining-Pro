
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, History, TrendingUp, 
  CheckCircle2, Clock, XCircle, Loader2, ShieldCheck, 
  Lock, HelpCircle, X, Wallet, Activity, Copy, 
  UploadCloud, ArrowDown, ArrowRight, Zap, Globe, 
  Database, BarChart3, Crown, Info, Layers, 
  Star, Timer, Gem, Flame, Rocket, ShieldAlert, 
  Diamond, Medal, ShieldAlert as ShieldIcon,
  LogOut, Mail, Key, UserPlus, Settings, Eye, Search, RefreshCw,
  Calendar, CreditCard, ChevronLeft
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, NETWORK, MIN_WITHDRAWAL, ADMIN_EMAIL } from './constants';
import { supabase } from './supabase';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<UserState | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllUserData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setLoading(true);
        fetchAllUserData(session.user.id);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAllUserData = async (userId: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      const { data: machines } = await supabase.from('user_machines').select('*').eq('user_id', userId);
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });

      if (profile) {
        setUserData({
          ...profile,
          withdrawableBalance: profile.withdrawable_balance || 0,
          totalRecharge: profile.total_recharge || 0,
          totalWithdraw: profile.total_withdraw || 0,
          referralEarnings: profile.referral_earnings || 0,
          ownedMachines: machines || [],
          transactions: txs || [],
          lastWithdrawDate: profile.last_withdraw_date || null
        });
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const buyMachine = async (machine: Machine) => {
    if (!userData || userData.ownedMachines.length >= 10) {
      showToast(t('maxMachinesReached'), 'error');
      return;
    }
    if (userData.balance < machine.price) {
      showToast(t('insufficientBalance'), 'error');
      return;
    }
    showToast(lang === 'ar' ? 'جاري التفعيل...' : 'Activating...', 'info');
    const { error: machineErr } = await supabase.from('user_machines').insert({
      user_id: session.user.id,
      machine_id: machine.id,
      remaining_days: machine.duration,
      total_earned: 0
    });
    if (machineErr) return showToast(machineErr.message, 'error');
    const newBalance = userData.balance - machine.price;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', session.user.id);
    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  const completeTask = async (userMachine: UserMachine) => {
    const today = formatDate(new Date());
    if (userMachine.last_claim_date === today) return;
    const machine = MACHINES.find(m => m.id === userMachine.machine_id);
    if (!machine) return;
    showToast(lang === 'ar' ? 'جاري الحصاد...' : 'Harvesting...', 'info');
    const { error: updateErr } = await supabase.from('user_machines').update({
      last_claim_date: today,
      total_earned: userMachine.total_earned + machine.dailyProfit,
      remaining_days: userMachine.remaining_days - 1
    }).eq('id', userMachine.id);
    if (updateErr) return showToast(updateErr.message, 'error');
    const newBalance = userData!.balance + machine.dailyProfit;
    const newWithdrawable = userData!.withdrawableBalance + machine.dailyProfit;
    await supabase.from('profiles').update({ balance: newBalance, withdrawable_balance: newWithdrawable }).eq('id', session.user.id);
    await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed', details: `Profit from ${machine.name}` });
    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  const handleDeposit = async (amount: number, proof: string) => {
    if (amount <= 0 || !proof) return showToast(lang === 'ar' ? 'يرجى إدخال المبلغ ورفع الصورة' : 'Enter amount and upload proof', 'error');
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'deposit',
      amount: amount,
      status: 'pending',
      proof_url: proof,
      details: 'Deposit verification pending'
    });
    if (error) return showToast(error.message, 'error');
    showToast(t('verificationPending'), 'success');
    setShowRecharge(false);
    fetchAllUserData(session.user.id);
  };

  const performWithdraw = async (amount: number, address: string) => {
    if (!userData) return;
    if (amount < MIN_WITHDRAWAL) return showToast(t('minWithdrawalError'), 'error');
    if (amount > userData.withdrawableBalance) return showToast(t('insufficientBalance'), 'error');
    
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      details: `Withdrawal request to: ${address}`
    });
    
    if (error) return showToast(error.message, 'error');

    const newBalance = userData.balance - amount;
    const newWithdrawable = userData.withdrawableBalance - amount;
    await supabase.from('profiles').update({ balance: newBalance, withdrawable_balance: newWithdrawable }).eq('id', session.user.id);

    showToast(t('verificationPending'), 'success');
    setShowWithdraw(false);
    fetchAllUserData(session.user.id);
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  if (!session) return <AuthView lang={lang} setLang={setLang} t={t} showToast={showToast} />;
  if (!userData) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : 'text-left font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal t={t} onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} lang={lang} onClose={() => setShowRecharge(false)} onDeposit={handleDeposit} showToast={showToast} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={performWithdraw} max={userData.withdrawableBalance} />}
      
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] space-y-2.5 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3.5 p-4.5 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-3xl border ${toast.type === 'error' ? 'bg-red-500/30 border-red-500/50' : toast.type === 'success' ? 'bg-blue-600/30 border-blue-600/50' : 'bg-slate-900/80 border-slate-700/50'}`}>
            <span className="text-[13px] font-black italic">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="p-5 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-40 bg-[#020617]/90">
        <div className="max-w-md mx-auto flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><Zap size={22} className="text-white fill-white" /></div>
            <div className="flex flex-col"><span className="font-black italic text-2xl leading-none">MINE<span className="text-blue-500">PRO</span></span></div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-10 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={userData} t={t} onShowInfo={() => setShowInfo(true)} onShowRecharge={() => setShowRecharge(true)} onShowWithdraw={() => setShowWithdraw(true)} />} />
          <Route path="/machines" element={<MachinesView user={userData} onBuy={buyMachine} t={t} />} />
          <Route path="/tasks" element={<TasksView user={userData} onComplete={completeTask} t={t} />} />
          <Route path="/team" element={<TeamView user={userData} t={t} />} />
          <Route path="/profile" element={<ProfileView user={userData} t={t} />} />
          {userData.email === ADMIN_EMAIL && <Route path="/admin" element={<AdminView t={t} showToast={showToast} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-3xl border-t border-white/5 p-5 z-40">
        <div className="max-w-md mx-auto flex justify-around items-end">
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

const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'deposits' | 'withdrawals'>('users');
  const [subTab, setSubTab] = useState<'pending' | 'resolved'>('pending');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData, error: userErr } = await supabase.from('profiles').select('*');
      const { data: txData, error: txErr } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const { data: machineData, error: machErr } = await supabase.from('user_machines').select('*');
      
      if (userErr) throw userErr;
      if (txErr) throw txErr;
      
      const mergedTxs = txData?.map(tx => ({
        ...tx,
        profiles: userData?.find(u => u.id === tx.user_id) || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
      })) || [];

      if (userData) setUsers(userData);
      if (txData) setTxs(mergedTxs);
      if (machineData) setMachines(machineData);
    } catch (e: any) {
      showToast(e.message || "Error fetching admin data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (tx: any, newStatus: 'completed' | 'failed') => {
    const user = users.find(u => u.id === tx.user_id);
    if (!user) return showToast("User not found", "error");

    if (tx.type === 'deposit' && newStatus === 'completed') {
      const newBalance = (user.balance || 0) + tx.amount;
      const newTotalRecharge = (user.total_recharge || 0) + tx.amount;
      await supabase.from('profiles').update({ balance: newBalance, total_recharge: newTotalRecharge }).eq('id', tx.user_id);
    }
    
    if (tx.type === 'withdrawal' && newStatus === 'failed') {
       await supabase.from('profiles').update({ 
         balance: (user.balance || 0) + Math.abs(tx.amount), 
         withdrawable_balance: (user.withdrawable_balance || 0) + Math.abs(tx.amount) 
       }).eq('id', tx.user_id);
    }

    if (tx.type === 'withdrawal' && newStatus === 'completed') {
       await supabase.from('profiles').update({ 
         total_withdraw: (user.total_withdraw || 0) + Math.abs(tx.amount) 
       }).eq('id', tx.user_id);
    }

    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
    if (error) showToast(error.message, 'error');
    else {
      showToast(`Transaction ${newStatus}`, 'success');
      fetchData();
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-2 px-1">
         <h2 className="text-xl font-black italic text-white uppercase tracking-tighter">مركز الإدارة</h2>
         <button onClick={fetchData} className="p-2 bg-white/5 rounded-xl text-blue-500 hover:rotate-180 transition-all duration-500"><RefreshCw size={20}/></button>
      </div>

      <div className="flex bg-[#0b0f1a] p-1 rounded-xl border border-white/5">
        <button onClick={() => {setTab('users'); setSelectedUser(null);}} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${tab === 'users' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-500'}`}>المستخدمين</button>
        <button onClick={() => {setTab('deposits'); setSelectedUser(null);}} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${tab === 'deposits' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-500'}`}>الإيداعات</button>
        <button onClick={() => {setTab('withdrawals'); setSelectedUser(null);}} className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${tab === 'withdrawals' ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-500'}`}>السحوبات</button>
      </div>

      {tab !== 'users' && !selectedUser && (
        <div className="flex justify-center gap-4 bg-[#020617] p-1 rounded-2xl border border-white/5 mx-auto max-w-[250px]">
           <button onClick={() => setSubTab('pending')} className={`flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase transition-all ${subTab === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'text-slate-600'}`}>قيد الانتظار</button>
           <button onClick={() => setSubTab('resolved')} className={`flex-1 py-2 px-4 rounded-xl text-[9px] font-black uppercase transition-all ${subTab === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-600'}`}>السجل (المحلولة)</button>
        </div>
      )}

      {tab === 'users' && !selectedUser && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input placeholder="البحث برقم المعرف أو البريد..." className="w-full bg-[#0b0f1a] border border-white/5 pr-12 pl-4 py-4 rounded-2xl text-xs text-white outline-none focus:border-blue-500/30" />
          </div>
          {users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-[#0b0f1a] border border-white/10 p-5 rounded-[2rem] flex justify-between items-center flex-row-reverse group hover:border-blue-500/50 transition-all cursor-pointer">
              <div className="text-right">
                <h4 className="font-black text-white italic">{u.first_name} {u.last_name}</h4>
                <p className="text-[10px] text-slate-500 font-mono">{u.email}</p>
              </div>
              <div className="flex flex-col items-start">
                 <span className="text-blue-500 text-xs font-black italic">{u.balance.toFixed(2)} USDT</span>
                 <span className="text-[8px] text-slate-700 uppercase font-bold">Total Assets</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-10">
           <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase mb-4 bg-white/5 px-4 py-2 rounded-full">
             <ChevronLeft size={14} /> العودة للرئيسية
           </button>
           
           <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-8 text-right space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
              
              <div className="flex items-center gap-6 flex-row-reverse relative z-10 border-b border-white/5 pb-8">
                 <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border-4 border-blue-600/10 flex items-center justify-center">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.id}`} alt="User" className="w-14 h-14"/>
                 </div>
                 <div className="flex-1">
                    <h3 className="text-2xl font-black text-white italic">{selectedUser.first_name} {selectedUser.last_name}</h3>
                    <p className="text-[10px] text-slate-500 font-mono">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 flex-row-reverse mt-2">
                       <Calendar size={12} className="text-slate-700" />
                       <span className="text-[9px] text-slate-700 uppercase font-black">انضم في: {new Date(selectedUser.created_at).toLocaleDateString()}</span>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 relative z-10">
                 <StatBox label="الرصيد الكلي" value={selectedUser.balance} color="white" />
                 <StatBox label="قابل للسحب" value={selectedUser.withdrawable_balance} color="blue-500" />
                 <StatBox label="إجمالي الإيداع" value={selectedUser.total_recharge} color="emerald-500" />
                 <StatBox label="إجمالي السحب" value={selectedUser.total_withdraw} color="red-500" />
              </div>

              <div className="space-y-4 pt-6 relative z-10">
                 <div className="flex justify-between items-center flex-row-reverse">
                    <p className="text-[10px] font-black uppercase text-slate-500">الماكينات المملوكة</p>
                    <span className="bg-white/5 px-3 py-1 rounded-lg text-[10px] font-black text-white">{machines.filter(m => m.user_id === selectedUser.id).length}</span>
                 </div>
                 <div className="space-y-3">
                   {machines.filter(m => m.user_id === selectedUser.id).map(um => {
                     const machine = MACHINES.find(x => x.id === um.machine_id);
                     return (
                       <div key={um.id} className="bg-black/20 border border-white/5 p-4 rounded-2xl flex justify-between flex-row-reverse items-center">
                          <div className="text-right">
                             <p className="text-[11px] font-black text-white italic">{machine?.name}</p>
                             <p className="text-[8px] text-slate-600">Purchase: {new Date(um.purchase_date).toLocaleDateString()}</p>
                          </div>
                          <div className="bg-blue-600/10 px-3 py-1 rounded-full"><span className="text-[9px] font-black text-blue-500">باقي {um.remaining_days} يوم</span></div>
                       </div>
                     );
                   })}
                 </div>
              </div>

              <div className="pt-6 relative z-10">
                 <p className="text-[10px] font-black uppercase text-slate-500 mb-4">آخر العمليات</p>
                 <div className="space-y-2">
                   {txs.filter(tx => tx.user_id === selectedUser.id).slice(0, 5).map(tx => (
                     <div key={tx.id} className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl flex-row-reverse">
                        <span className={`text-[9px] font-black uppercase ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.type}</span>
                        <span className="text-[10px] font-black text-white italic">{tx.amount.toFixed(2)} USDT</span>
                     </div>
                   ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {(tab === 'deposits' || tab === 'withdrawals') && !selectedUser && (
        <div className="space-y-6">
          {txs.filter(t => 
            t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && 
            (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')
          ).map(t => (
            <div key={t.id} className={`bg-[#0b0f1a] border ${t.status === 'pending' ? 'border-yellow-500/30' : 'border-white/10 opacity-70'} p-6 rounded-[2.5rem] text-right space-y-4`}>
              <div className="flex justify-between items-center flex-row-reverse">
                 <div className="text-right cursor-pointer" onClick={() => setSelectedUser(t.profiles)}>
                   <h5 className="font-black text-white italic text-sm hover:text-blue-500 transition-colors underline decoration-blue-500/30">{t.profiles?.first_name} {t.profiles?.last_name}</h5>
                   <p className="text-[10px] text-slate-600 font-mono">{t.profiles?.email}</p>
                 </div>
                 <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                   t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                   t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                   'bg-red-500/10 text-red-500 border-red-500/20'
                 }`}>{t.status === 'pending' ? 'معلقة' : t.status === 'completed' ? 'تمت بنجاح' : 'مرفوضة'}</span>
              </div>
              
              <div className="flex justify-between flex-row-reverse items-baseline border-t border-white/5 pt-3">
                <span className="text-slate-500 text-[10px] font-black uppercase">المبلغ</span>
                <span className="text-2xl font-black italic text-white">{Math.abs(t.amount)} <span className="text-[10px] text-blue-500">USDT</span></span>
              </div>
              
              {t.proof_url && (
                <div className="mt-2 rounded-2xl overflow-hidden border border-white/10 group relative bg-black">
                   <img 
                    src={t.proof_url} 
                    alt="Proof" 
                    className="w-full h-auto max-h-48 object-contain cursor-zoom-in" 
                    onClick={() => window.open(t.proof_url, '_blank')}
                   />
                </div>
              )}

              {t.status === 'pending' && (
                <div className="flex gap-4 pt-2">
                  <button onClick={() => handleAction(t, 'completed')} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase active:scale-95 transition-all">قبول</button>
                  <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase active:scale-95 transition-all">رفض</button>
                </div>
              )}
            </div>
          ))}
          {txs.filter(t => 
            t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && 
            (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')
          ).length === 0 && (
            <div className="py-20 text-center opacity-20 font-black italic uppercase tracking-[0.3em] text-slate-500">لا يوجد بيانات هنا حالياً</div>
          )}
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, color }: any) => (
  <div className="bg-black/40 border border-white/5 p-4 rounded-2xl text-right">
     <p className="text-[8px] font-black uppercase text-slate-600 italic mb-1">{label}</p>
     <p className={`text-lg font-black text-${color} italic tracking-tighter`}>{value.toFixed(2)} <span className="text-[8px]">USDT</span></p>
  </div>
);

// --- بقية المكونات تظل كما هي ---
const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw }: any) => {
  return (
    <div className="space-y-10">
      <div className="px-1 text-right flex justify-between items-end flex-row-reverse">
        <div className="space-y-1">
          <h2 className="text-2xl font-black italic tracking-tighter text-white">أهلاً، {user.first_name} 👋</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">ID: {user.referral_code}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full flex items-center gap-2">
           <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 animate-pulse">System Online</span>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[3rem] blur opacity-25"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-9 shadow-2xl min-h-[300px] flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-3xl"></div>
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3"><p className="text-white/40 font-black text-[10px] uppercase tracking-[0.4em] italic">{t('balanceTitle')}</p></div>
              <button onClick={onShowInfo} className="bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10 text-white/90 text-[10px] font-black uppercase flex items-center gap-2"><HelpCircle size={15} className="text-blue-500" /> مساعدة</button>
            </div>
            <div className="text-right">
               <h2 className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">{Number(user.balance).toFixed(2)}<span className="text-xl text-blue-500 italic ml-3">USDT</span></h2>
            </div>
          </div>
          <div className="flex gap-5 relative z-10 mt-10">
            <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"><ArrowDownCircle size={20} className="text-blue-600" /> {t('recharge')}</button>
            <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"><ArrowUpCircle size={20} /> {t('withdraw')}</button>
          </div>
        </div>
      </div>

      <div className="space-y-6 text-right">
         <h3 className="text-sm font-black italic tracking-widest uppercase text-slate-500 px-2">{t('history')}</h3>
         <div className="space-y-3">
           {user.transactions.slice(0, 10).map((tx: Transaction) => (
             <div key={tx.id} className={`bg-[#0b0f1a] border ${tx.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5'} p-5 rounded-2xl flex justify-between items-center flex-row-reverse group transition-all`}>
                <div className="flex gap-4 flex-row-reverse items-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {tx.status === 'pending' ? <Clock size={18} className="animate-spin-slow"/> : tx.type === 'task' ? <Cpu size={18}/> : <ArrowDown size={18}/>}
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-black text-white uppercase italic">{tx.type} {tx.status === 'pending' && <span className="text-[8px] text-yellow-500">(قيد المراجعة)</span>}</p>
                     <p className="text-[8px] text-slate-500 font-bold uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-sm font-black italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
             </div>
           ))}
           {user.transactions.length === 0 && (
             <div className="py-12 text-center text-slate-800 font-black italic text-[10px] uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">لا يوجد سجل عمليات</div>
           )}
         </div>
      </div>
    </div>
  );
};

const RechargeModal = ({ t, lang, onClose, onDeposit, showToast }: any) => {
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return showToast(lang === 'ar' ? 'حجم الصورة كبير جداً (أقصى حد 2 ميجا)' : 'Image too large (Max 2MB)', 'error');
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl overflow-y-auto">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col my-auto animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-br from-[#1e293b] to-[#0f172a]">
          <h3 className="font-black text-white text-xl uppercase tracking-tighter italic">{t('recharge')}</h3>
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-9 space-y-9 text-right overflow-y-auto no-scrollbar">
          <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-3xl space-y-3">
             <div className="flex items-center gap-2 text-blue-500 flex-row-reverse">
                <ShieldCheck size={18} />
                <span className="text-[10px] font-black uppercase">رابط الإيداع المعتمد</span>
             </div>
             <div className="bg-black/40 p-4 rounded-xl flex items-center gap-4">
                <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم النسخ!', 'success')}} className="p-3 bg-white/5 rounded-xl text-blue-500"><Copy size={18} /></button>
                <span className="text-[10px] font-mono text-slate-500 break-all leading-relaxed flex-1">{DEPOSIT_ADDRESS}</span>
             </div>
          </div>
          <div className="space-y-4">
            <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">المبلغ المراد شحنه (USDT)</p>
            <input type="number" placeholder="0.00" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-6 rounded-[1.5rem] text-white font-black italic text-center text-2xl outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div className="space-y-6">
             <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">{t('paymentProof')}</p>
             <label className="block border-2 border-dashed border-white/10 rounded-[2.5rem] p-12 text-center bg-white/[0.02] hover:border-blue-500/50 transition-all cursor-pointer group">
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                  {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud size={32} />}
                </div>
                {image ? (
                  <div className="relative inline-block mt-2">
                    <img src={image} className="w-24 h-24 object-cover rounded-xl border border-white/10" />
                    <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1"><CheckCircle2 size={12} className="text-white"/></div>
                  </div>
                ) : (
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t('clickToUpload')}</p>
                )}
             </label>
          </div>
        </div>
        <div className="p-9 bg-black/20 border-t border-white/5">
          <button 
            onClick={() => onDeposit(Number(rechargeAmount), image)} 
            disabled={!image || !rechargeAmount || uploading}
            className="w-full bg-white text-black font-black py-5 rounded-[1.5rem] uppercase tracking-[0.4em] text-[12px] shadow-xl disabled:opacity-20 transition-all hover:bg-slate-100 active:scale-[0.98] uppercase"
          >
            {t('confirmDeposit')}
          </button>
        </div>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-br from-indigo-900/50 to-slate-950">
          <h3 className="font-black text-white text-xl uppercase tracking-tighter italic">{t('withdraw')}</h3>
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-2xl text-slate-400"><X size={20} /></button>
        </div>
        <div className="p-9 space-y-8 text-right">
           <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-3xl flex justify-between items-center flex-row-reverse shadow-inner">
              <span className="text-[10px] font-black text-slate-500 uppercase">الرصيد القابل للسحب</span>
              <span className="text-xl font-black text-blue-500 italic">{max.toFixed(2)} USDT</span>
           </div>
           <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">عنوان المحفظة (BEP20)</p>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl text-white font-mono text-xs outline-none focus:border-blue-500/30 transition-all" />
           </div>
           <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest italic">المبلغ المطلوب</p>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Min. 8.00 USDT" className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl text-white font-black italic text-center text-xl outline-none focus:border-blue-500/30 transition-all" />
           </div>
        </div>
        <div className="p-9 bg-black/20 border-t border-white/5">
           <button onClick={() => onWithdraw(Number(amount), address)} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-[0.4em] text-[12px] shadow-xl shadow-blue-500/20 hover:bg-blue-500 active:scale-[0.98] transition-all">تأكيد عملية السحب</button>
        </div>
      </div>
    </div>
  );
};

const AuthView = ({ lang, setLang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) showToast(error.message, 'error');
    } else {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
      });
      if (error) showToast(error.message, 'error');
      else showToast(lang === 'ar' ? 'تحقق من بريدك الإلكتروني لتأكيد الحساب!' : 'Verify your email!', 'success');
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen bg-[#020617] p-6 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-12"><Zap size={42} className="text-white fill-white" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">V-Protocol Elite System</p>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-10 shadow-2xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
          <div className="flex bg-[#020617] p-1.5 rounded-2xl border border-white/5 relative z-10">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-4 rounded-xl font-black text-xs transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{lang === 'ar' ? 'دخول' : 'Login'}</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-4 rounded-xl font-black text-xs transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>{lang === 'ar' ? 'حساب جديد' : 'Register'}</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-5 relative z-10">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الأول' : 'First'} value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} />
                <Input icon={UserIcon} placeholder={lang === 'ar' ? 'الأخير' : 'Last'} value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} />
              </div>
            )}
            <Input icon={Mail} type="email" placeholder={lang === 'ar' ? 'البريد' : 'Email'} value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder={lang === 'ar' ? 'كلمة السر' : 'Password'} value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            {!isLogin && <Input icon={UserPlus} placeholder={lang === 'ar' ? 'كود الإحالة (اختياري)' : 'Referral (Opt)'} value={formData.referralCode} onChange={(v: string) => setFormData({...formData, referralCode: v})} />}
            <button disabled={loading} className="w-full bg-white text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[11px] shadow-xl hover:bg-slate-100 active:scale-[0.98] transition-all">
              {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : (isLogin ? 'Access System' : 'Create Operator')}
            </button>
          </form>
        </div>
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="w-full text-center text-slate-700 font-black text-[10px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 mt-4"><Globe size={14}/> {lang === 'ar' ? 'Switch to English' : 'تحويل للعربية'}</button>
      </div>
    </div>
  );
};

const Input = ({ icon: Icon, type = "text", placeholder, value, onChange }: any) => (
  <div className="relative group">
    <div className="absolute inset-y-0 right-4 flex items-center text-slate-600 group-focus-within:text-blue-500 transition-colors"><Icon size={18} /></div>
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-12 pl-4 py-4.5 rounded-2xl text-xs font-bold outline-none focus:border-blue-500/50 transition-all text-white shadow-inner" />
  </div>
);

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 group ${active ? 'text-blue-500 -translate-y-2' : 'text-slate-600'}`}>
    <div className={`p-3 rounded-2xl transition-all duration-300 ${active ? 'bg-blue-600/15 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : ''}`}><Icon size={22} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[8px] font-black uppercase tracking-[0.15em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>{label}</span>
  </button>
);

const MachinesView = ({ user, onBuy, t }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex justify-between items-center flex-row-reverse px-2">
      <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4 flex-row-reverse"><Layers className="text-blue-500" size={24}/> {t('machines')}</h2>
      <span className="text-[9px] font-black bg-white/5 px-4 py-1.5 rounded-full border border-white/10 uppercase tracking-widest text-slate-500">Elite Protocols</span>
    </div>
    <div className="space-y-8">
      {MACHINES.map(m => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className="relative bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-8 shadow-2xl text-right overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-600/5 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex justify-between items-start mb-8 relative z-10 flex-row-reverse">
                 <div className="flex gap-5 flex-row-reverse items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform"><Cpu size={32} className="text-blue-500" /></div>
                    <div className="space-y-2"><h3 className="font-black text-xl text-white uppercase italic tracking-tighter leading-none">{m.name}</h3><span className="text-[8px] font-black uppercase text-blue-500 tracking-[0.2em]">Alpha-Node v4.1</span></div>
                 </div>
                 <div className="text-left">
                    <p className="text-4xl font-black text-white tracking-tighter">{m.price}<span className="text-xs text-blue-500 ml-1 italic uppercase">USDT</span></p>
                    <p className="text-[8px] font-black uppercase text-slate-700 mt-1 tracking-widest">Stake Required</p>
                 </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                <p className="text-[8px] font-black uppercase text-slate-600 italic">الربح اليومي</p>
                <p className="text-lg font-black text-emerald-500 italic">+{m.dailyProfit} <span className="text-[10px]">USDT</span></p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                <p className="text-[8px] font-black uppercase text-slate-600 italic">دورة العمل</p>
                <p className="text-lg font-black text-white italic">{m.duration} <span className="text-[10px]">يوم</span></p>
              </div>
            </div>
            <button onClick={() => onBuy(m)} disabled={owned} className={`w-full py-5 rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.4em] shadow-2xl transition-all ${owned ? 'bg-slate-900 text-slate-600 border border-white/5' : 'bg-white text-black active:scale-95 shadow-white/5 hover:bg-slate-100'}`}>
              {owned ? t('owned') : t('buyNow')}
            </button>
          </div>
        );
      })}
    </div>
  </div>
);

const TasksView = ({ user, onComplete, t }: any) => {
  const today = formatDate(new Date());
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-4 flex-row-reverse px-2"><ListTodo className="text-blue-500" size={26}/> {t('tasks')}</h2>
      {user.ownedMachines.length === 0 ? (
        <div className="bg-[#0b0f1a] border-2 border-dashed border-white/5 rounded-[3.5rem] p-32 text-center flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-800"><Cpu size={32}/></div>
          <p className="text-slate-800 font-black italic uppercase tracking-[0.4em] text-[10px]">لم يتم العثور على ماكينات نشطة</p>
        </div>
      ) : (
        <div className="space-y-6">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border ${isDone ? 'border-white/5 opacity-40 grayscale-[0.5]' : 'border-blue-500/30'} rounded-[2.5rem] p-8 shadow-2xl text-right relative overflow-hidden transition-all duration-500`}>
                {!isDone && <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl"></div>}
                <div className="flex justify-between items-center flex-row-reverse mb-8 relative z-10">
                  <div className="flex gap-4 flex-row-reverse items-center">
                    <div className={`p-3 rounded-xl ${isDone ? 'bg-white/5' : 'bg-blue-600/10 text-blue-500'}`}><Cpu size={24}/></div>
                    <div className="text-right"><h4 className="font-black text-xl text-white uppercase italic">{m?.name}</h4><p className="text-[8px] text-slate-600 font-mono">NODE_UID: {um.id.toString().slice(0,8)}</p></div>
                  </div>
                  <p className={`text-2xl font-black italic ${isDone ? 'text-slate-500' : 'text-emerald-500'}`}>+{m?.dailyProfit} USDT</p>
                </div>
                <button disabled={isDone} onClick={() => onComplete(um)} className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.4em] transition-all ${isDone ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 text-white shadow-xl shadow-blue-500/10 active:scale-95'}`}>
                  {isDone ? t('transactionCompleted') : t('completeTask')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TeamView = ({ user, t }: any) => (
  <div className="space-y-10 animate-in fade-in duration-500">
    <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white flex items-center gap-5 flex-row-reverse px-2"><Users className="text-blue-500" size={28}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[4rem] p-20 text-center space-y-6 shadow-2xl relative overflow-hidden">
       <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 blur-3xl"></div>
       <p className="text-slate-700 text-[11px] font-black uppercase tracking-[0.6em] italic relative z-10">{t('referralEarnings')}</p>
       <h3 className="text-8xl font-black text-blue-500 tracking-tighter italic drop-shadow-2xl relative z-10">{Number(user.referralEarnings).toFixed(2)}</h3>
       <span className="inline-block text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-5 py-2 rounded-full relative z-10">Active Network</span>
    </div>
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase text-slate-700 italic px-4 tracking-widest">معرف الإحالة الخاص بك</p>
      <div className="bg-[#0b0f1a] border border-white/10 p-10 rounded-[2.5rem] flex items-center gap-8 shadow-inner group">
        <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم نسخ الكود!')}} className="p-5 bg-white/5 rounded-2xl text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all"><Copy size={28} /></button>
        <div className="flex-1 text-right truncate"><span className="text-2xl font-mono text-slate-700 tracking-widest font-bold italic">{user.referral_code}</span></div>
      </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-12 animate-in fade-in duration-500">
    <div className="relative p-12 bg-white/[0.03] border border-white/5 rounded-[4rem] shadow-2xl flex items-center gap-10 flex-row-reverse justify-between overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent"></div>
       <div className="space-y-4 text-right z-10">
          <h3 className="text-4xl font-black italic tracking-tighter uppercase text-white leading-tight">{user.first_name}<br/>{user.last_name}</h3>
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600/10 border border-blue-500/30 rounded-2xl shadow-xl">
             <ShieldCheck size={18} className="text-blue-500" />
             <span className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-500">Tier-1 Operator</span>
          </div>
       </div>
       <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 border-8 border-[#020617] shadow-2xl flex items-center justify-center overflow-hidden z-10">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full scale-125 translate-y-2"/>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-9 text-right shadow-xl">
         <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest italic mb-2">إجمالي السحوبات</p>
         <p className="text-3xl font-black text-red-500 italic tracking-tighter">{user.totalWithdraw} <span className="text-[10px]">USDT</span></p>
      </div>
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-9 text-right shadow-xl">
         <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest italic mb-2">إجمالي الإيداعات</p>
         <p className="text-3xl font-black text-emerald-500 italic tracking-tighter">{user.totalRecharge} <span className="text-[10px]">USDT</span></p>
      </div>
    </div>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-10 space-y-6">
       <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-6">
         <span className="text-slate-500 text-[10px] font-black uppercase">البريد الإلكتروني</span>
         <span className="text-white font-black text-xs truncate max-w-[180px]">{user.email}</span>
       </div>
       <div className="flex justify-between items-center flex-row-reverse border-b border-white/5 pb-6">
         <span className="text-slate-500 text-[10px] font-black uppercase">بروتوكول الأمان</span>
         <span className="text-emerald-500 font-black text-[10px] uppercase">V-PROTOCOL ACTIVE</span>
       </div>
    </div>
  </div>
);

const InfoModal = ({ t, onClose }: any) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl animate-in fade-in duration-300">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[4rem] overflow-hidden shadow-2xl flex flex-col p-12 text-right space-y-8 animate-in zoom-in-95">
      <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto"><ShieldCheck size={42}/></div>
      <h3 className="font-black text-white text-2xl uppercase italic text-center tracking-tighter">{t('securityTitle')}</h3>
      <p className="text-[13px] leading-relaxed text-slate-400 font-bold italic text-center">{t('securityText')}</p>
      <button onClick={onClose} className="w-full bg-white text-black font-black py-6 rounded-[2rem] uppercase tracking-[0.4em] text-[11px] shadow-2xl active:scale-[0.98] transition-all">Acknowledge Protocol</button>
    </div>
  </div>
);

export default App;
