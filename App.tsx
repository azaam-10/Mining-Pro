
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Home as HomeIcon, Cpu, ListTodo, Users, User as UserIcon, 
  ArrowDownCircle, ArrowUpCircle, CheckCircle2, Clock, XCircle, 
  Loader2, ShieldCheck, HelpCircle, X, Copy, UploadCloud, 
  ArrowDown, Zap, Globe, Layers, Settings, Eye, Search, 
  RefreshCw, Calendar, ChevronLeft, MessageCircle, Send, Sparkles,
  LogOut, Mail, Key
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, ADMIN_EMAIL } from './constants';
import { supabase } from './supabase';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

interface Toast { message: string; type: 'success' | 'error' | 'info'; id: number; }

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>('ar');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
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
      if (session) { setLoading(true); fetchAllUserData(session.user.id); }
      else { setUserData(null); setLoading(false); }
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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const buyMachine = async (machine: Machine) => {
    if (!userData) return;
    if (userData.balance < machine.price) return showToast("رصيدك غير كافٍ", 'error');
    showToast('جاري تفعيل البروتوكول...', 'info');
    const { error: machineErr } = await supabase.from('user_machines').insert({
      user_id: session.user.id,
      machine_id: machine.id,
      remaining_days: machine.duration,
      total_earned: 0
    });
    if (machineErr) return showToast(machineErr.message, 'error');
    await supabase.from('profiles').update({ balance: userData.balance - machine.price }).eq('id', session.user.id);
    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  const completeTask = async (um: UserMachine) => {
    const today = formatDate(new Date());
    if (um.last_claim_date === today) return;
    const machine = MACHINES.find(m => m.id === um.machine_id);
    if (!machine) return;
    showToast('جاري سحب الأرباح...', 'info');
    await supabase.from('user_machines').update({
      last_claim_date: today,
      total_earned: um.total_earned + machine.dailyProfit,
      remaining_days: um.remaining_days - 1
    }).eq('id', um.id);
    await supabase.from('profiles').update({ 
      balance: userData!.balance + machine.dailyProfit, 
      withdrawable_balance: userData!.withdrawableBalance + machine.dailyProfit 
    }).eq('id', session.user.id);
    await supabase.from('transactions').insert({ user_id: session.user.id, type: 'task', amount: machine.dailyProfit, status: 'completed' });
    showToast(t('transactionCompleted'), 'success');
    fetchAllUserData(session.user.id);
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  if (!session) return <AuthView lang={lang} setLang={setLang} t={t} showToast={showToast} />;
  if (!userData) return null;

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl font-["Cairo"]' : 'font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal t={t} onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} onClose={() => setShowRecharge(false)} onDeposit={fetchAllUserData} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={fetchAllUserData} max={userData.withdrawableBalance} userId={session.user.id} balance={userData.balance} showToast={showToast} />}
      {showSupport && <SupportChatModal lang={lang} t={t} onClose={() => setShowSupport(false)} userId={session.user.id} />}
      
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] space-y-2.5 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-3xl border ${toast.type === 'error' ? 'bg-red-500/30 border-red-500/50' : toast.type === 'success' ? 'bg-blue-600/30 border-blue-600/50' : 'bg-slate-900/80 border-slate-700/50'}`}>
            <span className="text-[13px] font-black italic">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="p-6 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-40 bg-[#020617]/90">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-blue-500/20"><Zap size={24} className="text-white fill-white" /></div>
            <div className="flex flex-col"><span className="font-black italic text-2xl tracking-tighter">MINE<span className="text-blue-500">PRO</span></span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSupport(true)} className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl hover:bg-blue-500/20 transition-all relative">
               <MessageCircle size={20} />
               <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse border-2 border-[#020617]"></div>
            </button>
            <button onClick={() => supabase.auth.signOut()} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500/20 transition-all"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-12 relative z-10">
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

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-3xl border-t border-white/5 p-6 z-40">
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

// --- لوحة المسؤول بالشكل الجمالي الفاخر ---
const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'deposits' | 'withdrawals' | 'support'>('deposits'); // جعل العمليات هي الافتراضي
  const [subTab, setSubTab] = useState<'pending' | 'resolved'>('pending');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [chatUserId, setChatUserId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.from('profiles').select('*');
      const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const { data: machineData } = await supabase.from('user_machines').select('*');
      const { data: chatData } = await supabase.from('support_messages').select('*').order('created_at', { descending: true });
      
      const mergedTxs = txData?.map(tx => ({
        ...tx,
        profiles: userData?.find(u => u.id === tx.user_id) || { first_name: 'Unknown', last_name: 'User', email: 'N/A' }
      })) || [];

      if (userData) setUsers(userData);
      if (txData) setTxs(mergedTxs);
      if (machineData) setMachines(machineData);
      if (chatData) {
        const uniqueUsers = Array.from(new Set(chatData.map(m => m.sender_id === 'ADMIN_UID' ? m.receiver_id : m.sender_id)));
        setChats(uniqueUsers.map(uid => ({
          userId: uid,
          lastMsg: chatData.find(m => (m.sender_id === uid && m.receiver_id !== uid) || m.receiver_id === uid),
          profile: userData?.find(u => u.id === uid)
        })));
      }
    } catch (e) { showToast("Error", "error"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (tx: any, newStatus: 'completed' | 'failed') => {
    const user = users.find(u => u.id === tx.user_id);
    if (!user) return;
    if (tx.type === 'deposit' && newStatus === 'completed') {
      await supabase.from('profiles').update({ balance: user.balance + tx.amount, total_recharge: user.total_recharge + tx.amount }).eq('id', tx.user_id);
    }
    if (tx.type === 'withdrawal' && newStatus === 'failed') {
       await supabase.from('profiles').update({ balance: user.balance + Math.abs(tx.amount), withdrawable_balance: user.withdrawable_balance + Math.abs(tx.amount) }).eq('id', tx.user_id);
    }
    await supabase.from('transactions').update({ status: newStatus }).eq('id', tx.id);
    fetchData();
    showToast(`Status Updated`, 'success');
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
         <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter flex items-center gap-4 flex-row-reverse"><Settings className="text-blue-500" size={32} /> لوحة التحكم</h2>
         <button onClick={fetchData} className="p-4 bg-white/5 rounded-[1.5rem] text-blue-500 hover:rotate-180 transition-all duration-700"><RefreshCw size={24}/></button>
      </div>

      <div className="flex bg-[#0b0f1a] p-2 rounded-[2rem] border border-white/10 shadow-2xl relative z-10 no-scrollbar overflow-x-auto">
        {['deposits', 'withdrawals', 'users', 'support'].map((t: any) => (
          <button key={t} onClick={() => {setTab(t); setSelectedUser(null); setChatUserId(null);}} className={`flex-1 min-w-[95px] py-4 rounded-[1.2rem] font-black text-[10px] uppercase transition-all duration-300 ${tab === t ? 'bg-blue-600 shadow-xl text-white' : 'text-slate-600 hover:text-slate-400'}`}>{t === 'deposits' ? 'الإيداعات' : t === 'withdrawals' ? 'السحوبات' : t === 'users' ? 'الأعضاء' : 'الدعم'}</button>
        ))}
      </div>

      {(tab === 'deposits' || tab === 'withdrawals') && (
        <div className="space-y-8">
           <div className="flex justify-center gap-4 bg-[#020617] p-1.5 rounded-2xl border border-white/5 max-w-[280px] mx-auto">
             <button onClick={() => setSubTab('pending')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${subTab === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'text-slate-700'}`}>الطلبات المعلقة</button>
             <button onClick={() => setSubTab('resolved')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${subTab === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-700'}`}>سجل العمليات</button>
          </div>
          
          {txs.filter(t => t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')).map(t => (
            <div key={t.id} className={`relative bg-[#0b0f1a] border ${t.status === 'pending' ? 'border-yellow-500/30 shadow-[0_0_40px_rgba(234,179,8,0.08)]' : 'border-white/10 opacity-70'} p-10 rounded-[4rem] text-right space-y-8 overflow-hidden transition-all duration-700`}>
               <div className="flex justify-between items-center flex-row-reverse relative z-10">
                  <div className="text-right cursor-pointer group" onClick={() => setSelectedUser(t.profiles)}>
                    <h5 className="font-black text-white italic text-xl group-hover:text-blue-500 transition-colors underline underline-offset-8 decoration-blue-500/20">{t.profiles?.first_name} {t.profiles?.last_name}</h5>
                    <p className="text-[11px] text-slate-600 font-mono mt-2">{t.profiles?.email}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-5 py-2 rounded-full border ${t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>{t.status === 'pending' ? 'مطلوب مراجعته' : 'انتهى'}</span>
               </div>
               <div className="flex justify-between items-end flex-row-reverse border-t border-white/5 pt-8 relative z-10">
                  <p className="text-[11px] font-black text-slate-500 uppercase italic">المبلغ بالدولار</p>
                  <div className="text-left">
                     <p className="text-5xl font-black italic text-white leading-none">{Math.abs(t.amount)}</p>
                     <p className="text-[10px] text-blue-500 font-black uppercase mt-2">USDT ASSET</p>
                  </div>
               </div>
               {t.proof_url && (
                 <div className="relative group/img mt-6 rounded-[2.5rem] overflow-hidden border border-white/10 bg-black/50 cursor-zoom-in" onClick={() => window.open(t.proof_url, '_blank')}>
                    <img src={t.proof_url} className="w-full h-auto max-h-64 object-contain hover:scale-105 transition-transform duration-700" alt="Proof" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 flex items-end p-8 opacity-0 group-hover/img:opacity-100 transition-opacity"><p className="text-[11px] text-white font-black uppercase flex items-center gap-3"><Eye size={16}/> تكبير الصورة</p></div>
                 </div>
               )}
               {t.status === 'pending' && (
                 <div className="flex gap-4 pt-6 relative z-10">
                    <button onClick={() => handleAction(t, 'completed')} className="flex-[2] bg-white text-black font-black py-6 rounded-[2rem] uppercase text-[12px] tracking-widest shadow-2xl hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 transition-all">تأكيد وقبول</button>
                    <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/20 font-black py-6 rounded-[2rem] uppercase text-[12px] tracking-widest active:scale-95 transition-all">رفض</button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && !selectedUser && (
        <div className="space-y-6">
           {users.map(u => (
              <div key={u.id} onClick={() => setSelectedUser(u)} className="relative group bg-[#0b0f1a] border border-white/10 p-8 rounded-[3rem] flex justify-between items-center flex-row-reverse cursor-pointer hover:border-blue-500/50 transition-all duration-500 shadow-xl overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-all"></div>
                <div className="text-right flex items-center gap-6 flex-row-reverse relative z-10">
                   <div className="w-16 h-16 rounded-[1.2rem] bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} className="w-12 h-12" alt="Avatar" /></div>
                   <div className="space-y-1">
                      <h4 className="font-black text-white italic text-xl leading-none">{u.first_name} {u.last_name}</h4>
                      <p className="text-[11px] text-slate-600 font-mono">{u.email}</p>
                   </div>
                </div>
                <div className="text-left relative z-10">
                   <p className="text-blue-500 font-black italic text-2xl">{u.balance.toFixed(2)}</p>
                   <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest">Balance</p>
                </div>
              </div>
            ))}
        </div>
      )}

      {selectedUser && (
        <div className="animate-in slide-in-from-right duration-500 space-y-10">
           <button onClick={() => setSelectedUser(null)} className="flex items-center gap-3 text-blue-500 font-black text-[11px] uppercase bg-white/5 px-8 py-4 rounded-full hover:bg-blue-600 hover:text-white transition-all"><ChevronLeft size={18}/> العودة للقائمة</button>
           <div className="bg-[#0b0f1a] border border-white/10 rounded-[4rem] p-12 text-right space-y-10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px]"></div>
              <div className="flex items-center gap-10 flex-row-reverse border-b border-white/5 pb-12">
                 <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-800 border-[10px] border-[#020617] shadow-2xl flex items-center justify-center p-2"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.id}`} className="w-full h-full" alt="Usr"/></div>
                 <div className="space-y-3">
                    <h3 className="text-4xl font-black text-white italic leading-tight">{selectedUser.first_name}<br/>{selectedUser.last_name}</h3>
                    <p className="text-[12px] text-slate-500 uppercase tracking-widest">ID: {selectedUser.referral_code}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="bg-black/40 p-8 rounded-[2.5rem] shadow-inner border border-white/5"><p className="text-[10px] text-slate-600 uppercase font-black mb-3">الرصيد</p><p className="text-3xl font-black text-white italic">{selectedUser.balance.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-8 rounded-[2.5rem] shadow-inner border border-white/5"><p className="text-[10px] text-slate-600 uppercase font-black mb-3">قابل للسحب</p><p className="text-3xl font-black text-blue-500 italic">{selectedUser.withdrawable_balance.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-8 rounded-[2.5rem] shadow-inner border border-white/5"><p className="text-[10px] text-slate-600 uppercase font-black mb-3">إجمالي الإيداع</p><p className="text-3xl font-black text-emerald-500 italic">{selectedUser.total_recharge.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-8 rounded-[2.5rem] shadow-inner border border-white/5"><p className="text-[10px] text-slate-600 uppercase font-black mb-3">إجمالي السحب</p><p className="text-3xl font-black text-red-500 italic">{selectedUser.total_withdraw.toFixed(2)}</p></div>
              </div>
           </div>
        </div>
      )}

      {tab === 'support' && (
        <div className="space-y-6">
           {chats.map(c => (
            <div key={c.userId} onClick={() => setChatUserId(c.userId)} className="relative group bg-[#0b0f1a] border border-white/10 p-10 rounded-[3rem] flex justify-between items-center flex-row-reverse cursor-pointer hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
               <div className="text-right flex-1">
                  <h4 className="font-black text-white italic text-xl leading-none">{c.profile?.first_name || 'Anonymous'}</h4>
                  <p className="text-[12px] text-slate-500 truncate mt-3 pr-2">{c.lastMsg?.message}</p>
               </div>
               {!c.lastMsg?.is_read && c.lastMsg?.receiver_id === 'ADMIN' && <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping ml-6"></div>}
            </div>
          ))}
        </div>
      )}

      {chatUserId && (
        <SupportChatModal lang="ar" t={t} onClose={() => setChatUserId(null)} userId="ADMIN" adminChatWithId={chatUserId} />
      )}
    </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-4 transition-all duration-500 group ${active ? 'text-blue-500 -translate-y-4' : 'text-slate-700'}`}>
    <div className={`p-4 rounded-[1.5rem] transition-all duration-500 ${active ? 'bg-blue-600/20 shadow-[0_0_50px_rgba(37,99,235,0.4)] border border-blue-500/20' : 'hover:bg-white/5'}`}><Icon size={26} strokeWidth={active ? 2.5 : 2} /></div>
    <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${active ? 'opacity-100 scale-110' : 'opacity-40'}`}>{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo, onShowRecharge, onShowWithdraw }: any) => {
  return (
    <div className="space-y-14 animate-in fade-in duration-700">
      <div className="px-2 text-right flex justify-between items-end flex-row-reverse">
        <div className="space-y-2">
          <h2 className="text-4xl font-black italic tracking-tighter text-white">أهلاً، {user.first_name} 👋</h2>
          <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.4em]">OPERATOR_UID: {user.referral_code}</p>
        </div>
        <div className="bg-blue-600/10 border border-blue-500/20 px-6 py-3 rounded-full flex items-center gap-4 shadow-xl">
           <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
           <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Node Active</span>
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[4rem] blur opacity-40 group-hover:opacity-60 transition-all duration-1000"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[4rem] p-12 shadow-2xl min-h-[380px] flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/10 blur-[100px]"></div>
          <div className="relative z-10 space-y-10">
            <div className="flex justify-between items-center">
              <p className="text-white/40 font-black text-[12px] uppercase tracking-[0.6em] italic">{t('balanceTitle')}</p>
              <button onClick={onShowInfo} className="bg-white/5 px-6 py-4 rounded-[1.2rem] border border-white/10 text-white/90 text-[11px] font-black uppercase flex items-center gap-3 hover:bg-white/10 transition-all shadow-2xl shadow-black/50"><HelpCircle size={18} className="text-blue-500" /> المساعدة</button>
            </div>
            <div className="text-right">
               <h2 className="text-8xl font-black tracking-tighter text-white drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] leading-none">{Number(user.balance).toFixed(2)}<span className="text-2xl text-blue-500 italic ml-5 uppercase">USDT</span></h2>
            </div>
          </div>
          <div className="flex gap-8 relative z-10 mt-14">
            <button onClick={onShowRecharge} className="flex-1 bg-white text-black font-black py-7 rounded-[2rem] flex items-center justify-center gap-4 text-[13px] uppercase tracking-[0.5em] shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all"><ArrowDownCircle size={24} className="text-blue-600" /> {t('recharge')}</button>
            <button onClick={onShowWithdraw} className="flex-1 bg-blue-600 text-white font-black py-7 rounded-[2rem] flex items-center justify-center gap-4 text-[13px] uppercase tracking-[0.5em] shadow-[0_20px_40px_rgba(37,99,235,0.4)] hover:scale-[1.03] active:scale-[0.97] transition-all"><ArrowUpCircle size={24} /> {t('withdraw')}</button>
          </div>
        </div>
      </div>

      <div className="space-y-10 text-right">
         <div className="flex justify-between items-center flex-row-reverse px-2">
            <h3 className="text-sm font-black italic tracking-[0.4em] uppercase text-slate-600">{t('history')}</h3>
            <div className="w-16 h-1 bg-white/5 rounded-full"></div>
         </div>
         <div className="space-y-5">
           {user.transactions.slice(0, 10).map((tx: Transaction) => (
             <div key={tx.id} className={`relative group bg-[#0b0f1a] border ${tx.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5'} p-8 rounded-[2.5rem] flex justify-between items-center flex-row-reverse hover:bg-white/[0.02] transition-all shadow-2xl overflow-hidden`}>
                <div className="flex gap-6 flex-row-reverse items-center relative z-10">
                  <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center border shadow-inner ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                    {tx.status === 'pending' ? <Clock size={24} className="animate-spin-slow"/> : tx.type === 'task' ? <Cpu size={24}/> : <ArrowDownCircle size={24}/>}
                  </div>
                  <div className="text-right">
                     <p className="text-base font-black text-white uppercase italic tracking-tighter">{tx.type === 'task' ? 'عائد استثماري' : tx.type === 'deposit' ? 'عملية شحن' : 'طلب سحب رصيد'}</p>
                     <p className="text-[10px] text-slate-700 font-black uppercase mt-1 tracking-widest">{new Date(tx.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-left relative z-10">
                   <span className={`text-xl font-black italic ${tx.amount > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}</span>
                </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t }: any) => (
  <div className="space-y-14 animate-in fade-in duration-700">
    <div className="flex justify-between items-center flex-row-reverse px-2">
      <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-6 flex-row-reverse"><Layers className="text-blue-500" size={36}/> {t('machines')}</h2>
      <div className="h-1 flex-1 bg-white/5 mx-12 rounded-full opacity-30"></div>
    </div>
    <div className="space-y-12">
      {MACHINES.map((m: any) => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className="relative bg-[#0b0f1a] border border-white/10 rounded-[4.5rem] p-12 shadow-[0_50px_100px_rgba(0,0,0,0.7)] text-right overflow-hidden group hover:border-blue-500/50 transition-all duration-700">
            <div className="absolute top-0 left-0 w-48 h-48 bg-blue-600/5 blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex justify-between items-start mb-12 relative z-10 flex-row-reverse">
                 <div className="flex gap-7 flex-row-reverse items-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-[2.2rem] flex items-center justify-center border border-white/10 shadow-2xl group-hover:rotate-6 transition-transform duration-700"><Cpu size={48} className="text-blue-500" /></div>
                    <div className="space-y-3">
                       <h3 className="font-black text-3xl text-white uppercase italic tracking-tighter leading-none">{m.name}</h3>
                       <p className="text-[11px] text-blue-500/60 font-black uppercase tracking-[0.4em]">Advanced Mining Unit</p>
                    </div>
                 </div>
                 <div className="text-left">
                    <p className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{m.price}</p>
                    <p className="text-[11px] text-blue-500 font-black italic uppercase mt-2">USDT Deposit</p>
                 </div>
            </div>
            
            <p className="text-slate-500 text-sm italic font-bold mb-10 opacity-70 border-r-4 border-blue-600 pr-5 leading-relaxed">{m.description}</p>

            <div className="grid grid-cols-2 gap-8 mb-12">
              <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] text-right shadow-inner flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-600 italic mb-3 tracking-widest">صافي الربح اليومي</p>
                <p className="text-3xl font-black text-emerald-500 italic tracking-tighter leading-none">+{m.dailyProfit} <span className="text-sm">USDT</span></p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] text-right shadow-inner flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-600 italic mb-3 tracking-widest">دورة الاستثمار</p>
                <p className="text-3xl font-black text-white italic tracking-tighter leading-none">{m.duration} <span className="text-sm">يوم</span></p>
              </div>
            </div>
            
            <button onClick={() => onBuy(m)} disabled={owned} className={`w-full py-8 rounded-[3rem] font-black text-[15px] uppercase tracking-[0.6em] shadow-2xl transition-all duration-700 relative overflow-hidden group/btn ${owned ? 'bg-slate-900 text-slate-700 border border-white/5' : 'bg-white text-black hover:bg-slate-100 hover:scale-[1.02] active:scale-95'}`}>
              {!owned && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>}
              {owned ? 'تم التفعيل' : 'تفعيل الماكينة الآن'}
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
    <div className="space-y-14 animate-in fade-in duration-700">
      <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-6 flex-row-reverse px-2"><ListTodo className="text-blue-500" size={36}/> {t('tasks')}</h2>
      <div className="space-y-10">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`relative group bg-[#0b0f1a] border ${isDone ? 'border-white/5 opacity-40' : 'border-blue-500/30 shadow-[0_30px_60px_rgba(37,99,235,0.1)]'} rounded-[3.5rem] p-12 shadow-2xl text-right transition-all duration-700 overflow-hidden`}>
                <div className="flex justify-between items-center flex-row-reverse mb-10 relative z-10">
                  <div className="flex gap-6 flex-row-reverse items-center">
                    <div className={`p-5 rounded-[1.8rem] shadow-2xl ${isDone ? 'bg-white/5' : 'bg-blue-600/10 text-blue-500 border border-blue-500/20'}`}><Cpu size={36}/></div>
                    <div className="text-right"><h4 className="font-black text-2xl text-white uppercase italic tracking-tighter leading-none">{m?.name}</h4><p className="text-[10px] text-slate-700 font-black uppercase mt-2 tracking-widest">Active Status</p></div>
                  </div>
                  <div className="text-left">
                    <p className={`text-4xl font-black italic ${isDone ? 'text-slate-800' : 'text-emerald-500'}`}>+{m?.dailyProfit}</p>
                    <p className="text-[10px] text-slate-800 font-black uppercase mt-1">Pending Harvest</p>
                  </div>
                </div>
                <button disabled={isDone} onClick={() => onComplete(um)} className={`w-full py-8 rounded-[3rem] font-black uppercase text-[13px] tracking-[0.6em] transition-all duration-500 ${isDone ? 'bg-slate-900 text-slate-700 border border-white/5' : 'bg-blue-600 text-white shadow-xl hover:scale-[1.02] active:scale-95'}`}>
                  {isDone ? 'تم الاستلام' : 'استلام الربح اليومي'}
                </button>
              </div>
            );
          })}
          {user.ownedMachines.length === 0 && (
            <div className="py-40 text-center opacity-10 font-black italic uppercase tracking-[0.8em] text-slate-500">لا يوجد مهام</div>
          )}
      </div>
    </div>
  );
};

const SupportChatModal = ({ lang, t, onClose, userId, adminChatWithId }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId},sender_id.eq.${adminChatWithId},receiver_id.eq.${adminChatWithId}`)
      .order('created_at', { ascending: true });
    
    if (data) {
       const filtered = data.filter(m => 
          (m.sender_id === userId || m.receiver_id === userId) && 
          (userId === 'ADMIN' ? (m.sender_id === adminChatWithId || m.receiver_id === adminChatWithId) : true)
       );
       setMessages(filtered);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('support').on('postgres_changes', { event: '*', table: 'support_messages' }, () => fetchMessages()).subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId, adminChatWithId]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const msg = newMessage;
    setNewMessage('');
    await supabase.from('support_messages').insert({
      sender_id: userId,
      receiver_id: adminChatWithId || 'ADMIN',
      message: msg
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617]/98 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300">
      <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a] shadow-2xl relative z-10">
        <button onClick={onClose} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:bg-white/10 transition-all"><X size={24}/></button>
        <div className="text-right">
           <h3 className="font-black text-white italic text-2xl uppercase tracking-tighter">الدعم الفني</h3>
           <p className="text-[11px] text-blue-500 uppercase font-black tracking-widest animate-pulse">Live Support Chat</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar relative z-0">
        {loading ? <div className="mt-40 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40} /></div> : messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-6 rounded-[2.2rem] text-[15px] font-bold shadow-2xl relative ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'}`}>
              {m.message}
              <p className="text-[9px] opacity-40 mt-3 font-black uppercase tracking-widest">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && !loading && <div className="py-40 text-center opacity-10 font-black italic uppercase tracking-[0.6em] text-slate-500">بداية المحادثة</div>}
      </div>
      <div className="p-10 bg-[#0b0f1a]/80 backdrop-blur-3xl border-t border-white/5 flex gap-5 relative z-10">
        <button onClick={sendMessage} className="p-6 bg-blue-600 text-white rounded-[1.8rem] shadow-xl shadow-blue-500/30 active:scale-90 transition-all"><Send size={28}/></button>
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="اكتب رسالتك هنا..." className="flex-1 bg-white/[0.03] border border-white/10 rounded-[1.8rem] px-10 text-base text-white outline-none focus:border-blue-500/50 shadow-inner" />
      </div>
    </div>
  );
};

// --- المكونات المساعدة ---
const ProfileStat = ({ label, value, color }: any) => (
  <div className="bg-black/40 border border-white/5 p-8 rounded-[2.2rem] text-right shadow-inner">
     <p className="text-[10px] font-black uppercase text-slate-600 italic mb-3 tracking-widest">{label}</p>
     <p className={`text-3xl font-black text-${color} italic tracking-tighter leading-none`}>{value.toFixed(2)} <span className="text-[11px]">USDT</span></p>
  </div>
);

const InfoModal = ({ t, onClose }: any) => (
  <div className="fixed inset-0 z-[250] flex items-center justify-center p-8 bg-[#020617]/98 backdrop-blur-3xl animate-in fade-in duration-500">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[5rem] p-14 text-right space-y-10 animate-in zoom-in-95 shadow-2xl shadow-black">
      <div className="w-24 h-24 bg-blue-600/10 rounded-[2rem] flex items-center justify-center text-blue-500 mx-auto shadow-inner border border-blue-500/20"><ShieldCheck size={48}/></div>
      <h3 className="font-black text-white text-3xl uppercase italic text-center tracking-tighter">الأمان والبروتوكول</h3>
      <p className="text-sm leading-relaxed text-slate-400 font-bold italic text-center opacity-80">تضمن تقنيتنا حماية 100% لأصولك الرقمية عبر تشفير نهاية لنهاية غير قابل للاختراق.</p>
      <button onClick={onClose} className="w-full bg-white text-black font-black py-8 rounded-[2.5rem] uppercase tracking-[0.5em] text-[13px] shadow-2xl active:scale-95 transition-all">موافق</button>
    </div>
  </div>
);

const RechargeModal = ({ t, onClose, onDeposit, showToast, userId }: any) => {
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => { setImage(reader.result as string); setUploading(false); };
      reader.readAsDataURL(file);
    }
  };
  const submit = async () => {
    if (!amount || !image) return showToast("أكمل البيانات", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', proof_url: image });
    showToast(t('verificationPending'), 'success'); onDeposit(userId); onClose();
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-slate-950/98 backdrop-blur-3xl overflow-y-auto animate-in fade-in duration-300">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[4.5rem] p-12 space-y-12 animate-in zoom-in-95 shadow-2xl shadow-black">
        <div className="flex justify-between items-center bg-gradient-to-br from-blue-600 to-indigo-900 p-6 rounded-[2.2rem] shadow-2xl">
          <h3 className="font-black text-white text-xl italic tracking-tighter uppercase">إيداع رصيد</h3>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl text-white hover:bg-white/20 transition-all"><X size={22} /></button>
        </div>
        <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[2.5rem] space-y-5 text-right shadow-inner">
           <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest italic">رابط الإيداع المعتمد (BEP20)</p>
           <div className="bg-black/50 p-5 rounded-[1.5rem] flex items-center gap-5 border border-white/5">
              <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم النسخ!', 'success')}} className="p-4 bg-blue-600 text-white rounded-[1.2rem] shadow-lg active:scale-90 transition-all"><Copy size={20}/></button>
              <span className="text-[10px] font-mono text-slate-500 break-all flex-1 leading-relaxed">{DEPOSIT_ADDRESS}</span>
           </div>
        </div>
        <input type="number" placeholder="المبلغ USDT" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/10 p-8 rounded-[2.2rem] text-white font-black italic text-center text-5xl outline-none focus:border-blue-500/50 shadow-inner" />
        <label className="block border-2 border-dashed border-white/10 rounded-[3.5rem] p-14 text-center bg-white/[0.02] cursor-pointer group hover:border-blue-500/50 transition-all">
           <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
           {image ? <img src={image} className="w-32 h-32 mx-auto rounded-[2.5rem] object-cover border-4 border-blue-600 shadow-2xl" alt="Proof" /> : <div className="text-blue-500 space-y-4 group-hover:scale-110 transition-transform"><UploadCloud size={56} className="mx-auto" /><p className="text-[12px] uppercase font-black">رفع صورة الإيصال</p></div>}
        </label>
        <button onClick={submit} className="w-full bg-white text-black font-black py-8 rounded-[2.5rem] uppercase tracking-[0.6em] text-[14px] shadow-2xl shadow-white/5 hover:bg-slate-100 transition-all">تأكيد الإيداع</button>
      </div>
    </div>
  );
};

const WithdrawModal = ({ t, onClose, onWithdraw, max, userId, balance, showToast }: any) => {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const submit = async () => {
    const amt = Number(amount);
    if (amt < MIN_WITHDRAWAL) return showToast(t('minWithdrawalError'), 'error');
    if (amt > max) return showToast("رصيد غير كافٍ", "error");
    await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', details: `Addr: ${address}` });
    await supabase.from('profiles').update({ balance: balance - amt, withdrawable_balance: max - amt }).eq('id', userId);
    onWithdraw(userId); onClose(); showToast(t('verificationPending'), 'success');
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-slate-950/98 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[4.5rem] p-12 space-y-12 animate-in zoom-in-95 shadow-2xl">
        <div className="flex justify-between items-center bg-gradient-to-br from-blue-700 to-indigo-950 p-6 rounded-[2.2rem] shadow-2xl">
          <h3 className="font-black text-white text-xl italic uppercase tracking-tighter">سحب الأرباح</h3>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl text-white hover:bg-white/20 transition-all"><X size={22} /></button>
        </div>
        <div className="bg-blue-600/5 border border-blue-500/10 p-8 rounded-[2.5rem] flex justify-between items-center flex-row-reverse shadow-inner">
           <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">متاح للسحب</span>
           <span className="text-4xl font-black text-blue-500 italic drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]">{max.toFixed(2)} USDT</span>
        </div>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="عنوان المحفظة (BEP20)" className="w-full bg-black/50 border border-white/10 p-7 rounded-[2rem] text-white font-mono text-sm outline-none focus:border-blue-500/40 shadow-inner" />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="المبلغ (Min 8)" className="w-full bg-black/50 border border-white/10 p-7 rounded-[2rem] text-white font-black italic text-center text-5xl outline-none focus:border-blue-500/40 shadow-inner" />
        <button onClick={submit} className="w-full bg-blue-600 text-white font-black py-8 rounded-[2.5rem] uppercase tracking-[0.6em] text-[14px] shadow-2xl shadow-blue-500/40 hover:bg-blue-500 transition-all">سحب فوري</button>
      </div>
    </div>
  );
};

const AuthView = ({ lang, setLang, t, showToast }: any) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', referralCode: '' });
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
      if (error) showToast(error.message, 'error');
    } else {
      const { error } = await supabase.auth.signUp({
        email: formData.email, password: formData.password,
        options: { data: { first_name: formData.firstName, last_name: formData.lastName, referred_by: formData.referralCode } }
      });
      if (error) showToast(error.message, 'error');
      else showToast('تحقق من بريدك الإلكتروني!', 'success');
    }
    setLoading(false);
  };
  return (
    <div className={`min-h-screen bg-[#020617] p-10 flex flex-col justify-center ${lang === 'ar' ? 'rtl' : ''}`}>
      <div className="max-w-md mx-auto w-full space-y-14 animate-in fade-in duration-700">
        <div className="text-center space-y-6">
          <div className="w-28 h-28 bg-blue-600 rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_30px_60px_rgba(37,99,235,0.4)] rotate-12 hover:rotate-0 transition-transform duration-500"><Zap size={64} className="text-white fill-white" /></div>
          <h1 className="text-6xl font-black italic tracking-tighter text-white">MINE<span className="text-blue-500">PRO</span></h1>
          <p className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-800">V-Protocol Elite Mining</p>
        </div>
        <div className="bg-[#0b0f1a] border border-white/10 rounded-[4.5rem] p-14 shadow-[0_50px_100px_rgba(0,0,0,0.7)] space-y-12 relative overflow-hidden">
          <div className="flex bg-[#020617] p-2 rounded-[2.2rem] border border-white/5 relative z-10 shadow-inner">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-5 rounded-[1.8rem] font-black text-xs transition-all uppercase tracking-widest ${isLogin ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-800'}`}>{isLogin ? 'دخول' : 'Access'}</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-5 rounded-[1.8rem] font-black text-xs transition-all uppercase tracking-widest ${!isLogin ? 'bg-blue-600 text-white shadow-2xl' : 'text-slate-800'}`}>{!isLogin ? 'تسجيل' : 'Join'}</button>
          </div>
          <form onSubmit={handleAuth} className="space-y-6 relative z-10">
            {!isLogin && <div className="grid grid-cols-2 gap-5"><Input icon={UserIcon} placeholder="الأول" value={formData.firstName} onChange={(v: string) => setFormData({...formData, firstName: v})} /><Input icon={UserIcon} placeholder="الأخير" value={formData.lastName} onChange={(v: string) => setFormData({...formData, lastName: v})} /></div>}
            <Input icon={Mail} type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={(v: string) => setFormData({...formData, email: v})} />
            <Input icon={Key} type="password" placeholder="كلمة المرور" value={formData.password} onChange={(v: string) => setFormData({...formData, password: v})} />
            {!isLogin && <Input icon={Sparkles} placeholder="كود الإحالة" value={formData.referralCode} onChange={(v: string) => setFormData({...formData, referralCode: v})} />}
            <button disabled={loading} className="w-full bg-white text-black font-black py-7 rounded-[2rem] uppercase tracking-[0.5em] text-[13px] shadow-2xl hover:bg-slate-100 transition-all mt-6">
              {loading ? <Loader2 className="animate-spin mx-auto text-blue-600" size={28} /> : (isLogin ? 'Access Console' : 'Initialize Node')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Input = ({ icon: Icon, type = "text", placeholder, value, onChange }: any) => (
  <div className="relative group">
    <div className="absolute inset-y-0 right-6 flex items-center text-slate-800 group-focus-within:text-blue-500 transition-colors"><Icon size={22} /></div>
    <input type={type} required placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#020617] border border-white/5 pr-16 pl-8 py-7 rounded-[2.2rem] text-sm font-bold outline-none focus:border-blue-500/50 transition-all text-white shadow-inner placeholder:text-slate-800" />
  </div>
);

const TeamView = ({ user, t }: any) => (
  <div className="space-y-14 animate-in fade-in duration-700">
    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white flex items-center gap-6 flex-row-reverse px-2"><Users className="text-blue-500" size={36}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/10 rounded-[5rem] p-24 text-center space-y-10 shadow-[0_50px_100px_rgba(0,0,0,0.7)] relative overflow-hidden">
       <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 blur-[120px]"></div>
       <p className="text-slate-700 text-[13px] font-black uppercase tracking-[1em] italic relative z-10">NETWORK_EARNINGS</p>
       <h3 className="text-[7.5rem] font-black text-blue-500 tracking-tighter italic drop-shadow-[0_20px_30px_rgba(37,99,235,0.4)] relative z-10 leading-none">{Number(user.referralEarnings).toFixed(2)}</h3>
       <div className="flex justify-center relative z-10"><span className="inline-block text-[11px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-10 py-4 rounded-full border border-emerald-500/20 shadow-2xl">Global Network Sync Active</span></div>
    </div>
    <div className="space-y-6">
      <p className="text-[11px] font-black uppercase text-slate-800 italic px-8 tracking-widest">معرف الإحالة الخاص بك</p>
      <div className="bg-[#0b0f1a] border border-white/10 p-14 rounded-[4rem] flex items-center gap-12 shadow-inner group hover:border-blue-500/30 transition-all">
        <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم النسخ!')}} className="p-8 bg-blue-600 text-white rounded-[2.2rem] shadow-[0_20px_40px_rgba(37,99,235,0.4)] active:scale-90 transition-all group-hover:scale-105 duration-500"><Copy size={42} /></button>
        <div className="flex-1 text-right truncate"><span className="text-4xl font-mono text-slate-700 tracking-[0.3em] font-bold italic">{user.referral_code}</span></div>
      </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-16 animate-in fade-in duration-700">
    <div className="relative p-16 bg-[#0b0f1a] border border-white/10 rounded-[5.5rem] shadow-[0_60px_120px_rgba(0,0,0,0.8)] flex items-center gap-14 flex-row-reverse justify-between overflow-hidden group">
       <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent"></div>
       <div className="space-y-6 text-right z-10">
          <h3 className="text-5xl font-black italic tracking-tighter uppercase text-white leading-tight drop-shadow-2xl">{user.first_name}<br/>{user.last_name}</h3>
          <div className="inline-flex items-center gap-5 px-10 py-5 bg-blue-600/10 border border-blue-500/30 rounded-[2.2rem] shadow-2xl shadow-blue-500/10">
             <ShieldCheck size={24} className="text-blue-500" />
             <span className="text-[13px] font-black uppercase tracking-[0.4em] text-blue-500">Elite Protocol</span>
          </div>
       </div>
       <div className="w-48 h-48 rounded-[3.5rem] bg-gradient-to-br from-blue-600 via-indigo-800 to-blue-950 border-[15px] border-[#020617] shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden z-10 group-hover:scale-105 transition-transform duration-700">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`} alt="Avatar" className="w-full h-full scale-125 translate-y-4"/>
       </div>
    </div>
    <div className="grid grid-cols-2 gap-10">
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[4rem] p-14 text-right shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 blur-2xl group-hover:bg-red-600/10 transition-all"></div>
         <p className="text-[11px] text-slate-700 font-black uppercase tracking-widest italic mb-4">إجمالي المسحوبات</p>
         <p className="text-5xl font-black text-red-500 italic tracking-tighter leading-none">{user.totalWithdraw} <span className="text-sm">USDT</span></p>
      </div>
      <div className="bg-[#0b0f1a] border border-white/10 rounded-[4rem] p-14 text-right shadow-2xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 blur-2xl group-hover:bg-emerald-600/10 transition-all"></div>
         <p className="text-[11px] text-slate-700 font-black uppercase tracking-widest italic mb-4">إجمالي الإيداعات</p>
         <p className="text-5xl font-black text-emerald-500 italic tracking-tighter leading-none">{user.totalRecharge} <span className="text-sm">USDT</span></p>
      </div>
    </div>
  </div>
);

export default App;
