
import React, { useState, useEffect, useRef } from 'react';
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
  Calendar, CreditCard, ChevronLeft, MessageCircle, Send
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine, Transaction, SupportMessage } from './types';
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

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  if (!session) return <AuthView lang={lang} setLang={setLang} t={t} showToast={showToast} />;
  if (!userData) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : 'text-left font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {showInfo && <InfoModal t={t} onClose={() => setShowInfo(false)} />}
      {showRecharge && <RechargeModal t={t} lang={lang} onClose={() => setShowRecharge(false)} onDeposit={fetchAllUserData} showToast={showToast} userId={session.user.id} />}
      {showWithdraw && <WithdrawModal t={t} onClose={() => setShowWithdraw(false)} onWithdraw={fetchAllUserData} max={userData.withdrawableBalance} userId={session.user.id} balance={userData.balance} showToast={showToast} />}
      {showSupport && <SupportChatModal lang={lang} t={t} onClose={() => setShowSupport(false)} userId={session.user.id} />}
      
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
          <div className="flex gap-2">
            <button onClick={() => setShowSupport(true)} className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl relative">
               <MessageCircle size={18} />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl"><LogOut size={18} /></button>
          </div>
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

// --- مكون الدردشة المحسن ---
const SupportChatModal = ({ lang, t, onClose, userId, adminChatWithId }: any) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    // If admin is chatting, receiver is specific user. If user is chatting, receiver is admin_id (handled by policy).
    const targetUserId = adminChatWithId || 'ADMIN'; 
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('chat').on('postgres_changes', { event: '*', table: 'support_messages' }, () => fetchMessages()).subscribe();
    return () => { sub.unsubscribe(); };
  }, [userId, adminChatWithId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const msg = newMessage;
    setNewMessage('');
    const { error } = await supabase.from('support_messages').insert({
      sender_id: userId,
      receiver_id: adminChatWithId || null, // If null, it's to admin
      message: msg
    });
    if (error) console.error(error);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/98 backdrop-blur-2xl flex flex-col">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0b0f1a]">
        <button onClick={onClose} className="p-2 bg-white/5 rounded-xl"><X size={20}/></button>
        <div className="text-right">
           <h3 className="font-black text-white italic">{t('supportChat')}</h3>
           <p className="text-[9px] text-blue-500 uppercase font-black">Online Agent System</p>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
        {loading ? <Loader2 className="animate-spin mx-auto text-blue-500 mt-20" /> : messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-3xl text-[13px] font-bold ${m.sender_id === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-tl-none'}`}>
              {m.message}
              <p className="text-[8px] opacity-40 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
        {messages.length === 0 && !loading && (
          <div className="text-center py-20 opacity-20 italic text-[10px] uppercase tracking-widest">ابدأ المحادثة الآن...</div>
        )}
      </div>
      <div className="p-6 bg-[#0b0f1a] border-t border-white/5 flex gap-3">
        <button onClick={sendMessage} className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20"><Send size={20}/></button>
        <input 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={t('typeMessage')} 
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm text-white outline-none focus:border-blue-500/50"
        />
      </div>
    </div>
  );
};

const AdminView = ({ t, showToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [txs, setTxs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'deposits' | 'withdrawals' | 'support'>('users');
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
        // Group chats by user
        const uniqueUsers = Array.from(new Set(chatData.map(m => m.sender_id === 'ADMIN_UID' ? m.receiver_id : m.sender_id)));
        setChats(uniqueUsers.map(uid => ({
          userId: uid,
          lastMsg: chatData.find(m => m.sender_id === uid || m.receiver_id === uid),
          profile: userData?.find(u => u.id === uid)
        })));
      }
    } catch (e: any) {
      showToast("Error fetching admin data", "error");
    } finally {
      setLoading(false);
    }
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
    showToast(`Done: ${newStatus}`, 'success');
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center px-1">
         <h2 className="text-xl font-black italic text-white uppercase">مركز العمليات</h2>
         <button onClick={fetchData} className="p-2 bg-white/5 rounded-xl text-blue-500"><RefreshCw size={20}/></button>
      </div>

      <div className="flex bg-[#0b0f1a] p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
        {['users', 'deposits', 'withdrawals', 'support'].map((t: any) => (
          <button key={t} onClick={() => {setTab(t); setSelectedUser(null); setChatUserId(null);}} className={`flex-1 min-w-[80px] py-3 rounded-lg font-black text-[10px] uppercase transition-all ${tab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>

      {tab === 'users' && !selectedUser && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input placeholder="البحث..." className="w-full bg-[#0b0f1a] border border-white/5 pr-12 pl-4 py-4 rounded-2xl text-xs text-white outline-none" />
          </div>
          {users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-[#0b0f1a] border border-white/10 p-5 rounded-[2rem] flex justify-between items-center flex-row-reverse group cursor-pointer hover:border-blue-500/50">
              <div className="text-right">
                <h4 className="font-black text-white italic">{u.first_name} {u.last_name}</h4>
                <p className="text-[9px] text-slate-500 font-mono">{u.email}</p>
              </div>
              <ChevronLeft className="text-slate-700" size={16}/>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
           <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase bg-white/5 px-4 py-2 rounded-full"><ChevronLeft size={14}/> عودة</button>
           <div className="bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-8 text-right space-y-8 relative overflow-hidden">
              <div className="flex items-center gap-6 flex-row-reverse relative z-10 border-b border-white/5 pb-8">
                 <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${selectedUser.id}`} className="w-10 h-10"/>
                 </div>
                 <div className="flex-1">
                    <h3 className="text-xl font-black text-white italic">{selectedUser.first_name} {selectedUser.last_name}</h3>
                    <p className="text-[10px] text-slate-500">{selectedUser.email}</p>
                    <p className="text-[8px] text-slate-700 font-black mt-1 uppercase">انضم: {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-black/40 p-4 rounded-2xl"><p className="text-[8px] text-slate-600 uppercase font-black">الرصيد</p><p className="text-lg font-black text-white italic">{selectedUser.balance.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-4 rounded-2xl"><p className="text-[8px] text-slate-600 uppercase font-black">قابل للسحب</p><p className="text-lg font-black text-blue-500 italic">{selectedUser.withdrawable_balance.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-4 rounded-2xl"><p className="text-[8px] text-slate-600 uppercase font-black">إجمالي الإيداع</p><p className="text-lg font-black text-emerald-500 italic">{selectedUser.total_recharge.toFixed(2)}</p></div>
                 <div className="bg-black/40 p-4 rounded-2xl"><p className="text-[8px] text-slate-600 uppercase font-black">إجمالي السحب</p><p className="text-lg font-black text-red-500 italic">{selectedUser.total_withdraw.toFixed(2)}</p></div>
              </div>
              <div className="space-y-3 pt-4">
                 <p className="text-[10px] font-black uppercase text-slate-500">الماكينات ({machines.filter(m => m.user_id === selectedUser.id).length})</p>
                 {machines.filter(m => m.user_id === selectedUser.id).map(um => {
                   const m = MACHINES.find(x => x.id === um.machine_id);
                   return <div key={um.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center flex-row-reverse text-[11px] font-black text-white italic"><span>{m?.name}</span><span className="text-blue-500">باقي {um.remaining_days} يوم</span></div>
                 })}
              </div>
           </div>
        </div>
      )}

      {(tab === 'deposits' || tab === 'withdrawals') && !selectedUser && (
        <div className="space-y-6">
          <div className="flex bg-[#020617] p-1 rounded-2xl border border-white/5 max-w-[200px] mx-auto">
             <button onClick={() => setSubTab('pending')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase ${subTab === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'text-slate-600'}`}>معلق</button>
             <button onClick={() => setSubTab('resolved')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase ${subTab === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-600'}`}>السجل</button>
          </div>
          {txs.filter(t => t.type === (tab === 'deposits' ? 'deposit' : 'withdrawal') && (subTab === 'pending' ? t.status === 'pending' : t.status !== 'pending')).map(t => (
            <div key={t.id} className="bg-[#0b0f1a] border border-white/10 p-6 rounded-[2.5rem] text-right space-y-4">
               <div className="flex justify-between items-center flex-row-reverse">
                  <div className="text-right cursor-pointer" onClick={() => setSelectedUser(t.profiles)}>
                    <h5 className="font-black text-white italic text-sm underline decoration-blue-500/30">{t.profiles?.first_name} {t.profiles?.last_name}</h5>
                    <p className="text-[10px] text-slate-600 font-mono">{t.profiles?.email}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${t.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{t.status}</span>
               </div>
               <div className="flex justify-between flex-row-reverse border-t border-white/5 pt-3">
                  <span className="text-slate-500 text-[10px] font-black">المبلغ</span>
                  <span className="text-xl font-black italic text-white">{Math.abs(t.amount)} USDT</span>
               </div>
               {t.proof_url && <img src={t.proof_url} className="w-full h-auto max-h-40 object-contain rounded-2xl bg-black/40" onClick={() => window.open(t.proof_url, '_blank')} />}
               {t.status === 'pending' && (
                 <div className="flex gap-4 pt-2">
                   <button onClick={() => handleAction(t, 'completed')} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase">قبول</button>
                   <button onClick={() => handleAction(t, 'failed')} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase">رفض</button>
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {tab === 'support' && (
        <div className="space-y-4">
          {chats.map(c => (
            <div key={c.userId} onClick={() => setChatUserId(c.userId)} className="bg-[#0b0f1a] border border-white/10 p-5 rounded-[2rem] flex justify-between items-center flex-row-reverse cursor-pointer hover:border-blue-500/50">
               <div className="text-right flex-1">
                  <h4 className="font-black text-white italic">{c.profile?.first_name || 'Anonymous'}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{c.lastMsg?.message}</p>
               </div>
               {!c.lastMsg?.is_read && c.lastMsg?.receiver_id === 'ADMIN' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-4"></div>}
            </div>
          ))}
          {chats.length === 0 && <p className="text-center py-20 opacity-20 italic">لا يوجد رسائل دعم حالياً</p>}
        </div>
      )}

      {chatUserId && (
        <SupportChatModal lang="ar" t={t} onClose={() => setChatUserId(null)} userId="ADMIN" adminChatWithId={chatUserId} />
      )}
    </div>
  );
};

// --- بقية المكونات تظل كما هي مع تمرير الـ Props اللازمة ---

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

const RechargeModal = ({ t, lang, onClose, onDeposit, showToast, userId }: any) => {
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
    if (!amount || !image) return showToast("يرجى إكمال البيانات", "error");
    const { error } = await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: Number(amount), status: 'pending', proof_url: image });
    if (error) showToast(error.message, 'error');
    else { showToast(t('verificationPending'), 'success'); onDeposit(userId); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl overflow-y-auto">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] p-8 space-y-8 animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-4 rounded-3xl">
          <h3 className="font-black text-white text-xl italic">{t('recharge')}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={20} /></button>
        </div>
        <div className="bg-blue-600/10 p-5 rounded-3xl space-y-3 text-right">
           <p className="text-[10px] font-black text-blue-500 uppercase">رابط الإيداع المعتمد (BEP20)</p>
           <div className="bg-black/40 p-3 rounded-xl flex items-center gap-3">
              <button onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); showToast('تم النسخ!', 'success')}} className="p-2 bg-white/5 rounded-lg text-blue-500"><Copy size={16}/></button>
              <span className="text-[9px] font-mono text-slate-500 break-all flex-1">{DEPOSIT_ADDRESS}</span>
           </div>
        </div>
        <input type="number" placeholder="المبلغ USDT" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/5 p-5 rounded-2xl text-white font-black italic text-center text-xl outline-none" />
        <label className="block border-2 border-dashed border-white/10 rounded-[2.5rem] p-10 text-center bg-white/[0.02] cursor-pointer group">
           <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
           {image ? <img src={image} className="w-20 h-20 mx-auto rounded-xl object-cover" /> : <div className="text-blue-500 space-y-2"><UploadCloud size={32} className="mx-auto" /><p className="text-[10px] uppercase font-black">{t('clickToUpload')}</p></div>}
        </label>
        <button onClick={submit} className="w-full bg-white text-black font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[12px] shadow-xl">{t('confirmDeposit')}</button>
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
    if (amt > max) return showToast("الرصيد غير كافٍ", "error");
    
    await supabase.from('transactions').insert({ user_id: userId, type: 'withdrawal', amount: -amt, status: 'pending', details: `Address: ${address}` });
    await supabase.from('profiles').update({ balance: balance - amt, withdrawable_balance: max - amt }).eq('id', userId);
    onWithdraw(userId);
    onClose();
    showToast(t('verificationPending'), 'success');
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl">
      <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[3.5rem] p-8 space-y-8 animate-in zoom-in-95">
        <div className="flex justify-between items-center bg-gradient-to-br from-indigo-900/50 to-slate-950 p-4 rounded-3xl">
          <h3 className="font-black text-white text-xl italic">{t('withdraw')}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-slate-400"><X size={20} /></button>
        </div>
        <div className="bg-blue-600/5 p-4 rounded-2xl flex justify-between items-center flex-row-reverse">
           <span className="text-[9px] font-black text-slate-500">قابل للسحب</span>
           <span className="text-xl font-black text-blue-500 italic">{max.toFixed(2)} USDT</span>
        </div>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x... Wallet Address" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-white font-mono text-[10px] outline-none" />
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount (Min. 8)" className="w-full bg-black/50 border border-white/5 p-4 rounded-2xl text-white font-black italic text-center text-xl outline-none" />
        <button onClick={submit} className="w-full bg-blue-600 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-widest text-[12px] shadow-xl shadow-blue-500/20">تأكيد السحب</button>
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
    </div>
    <div className="space-y-8">
      {MACHINES.slice(0, 15).map(m => {
        const owned = user.ownedMachines.some((om: any) => om.machine_id === m.id);
        return (
          <div key={m.id} className="relative bg-[#0b0f1a] border border-white/10 rounded-[3rem] p-8 shadow-2xl text-right overflow-hidden group hover:border-blue-500/30 transition-all duration-500">
            <div className="flex justify-between items-start mb-8 relative z-10 flex-row-reverse">
                 <div className="flex gap-5 flex-row-reverse items-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl flex items-center justify-center border border-white/10"><Cpu size={32} className="text-blue-500" /></div>
                    <div className="space-y-2"><h3 className="font-black text-xl text-white uppercase italic tracking-tighter leading-none">{m.name}</h3><span className="text-[8px] font-black uppercase text-blue-500 tracking-[0.2em]">Alpha-Node v4.1</span></div>
                 </div>
                 <div className="text-left">
                    <p className="text-4xl font-black text-white tracking-tighter">{m.price}<span className="text-xs text-blue-500 ml-1 italic uppercase">USDT</span></p>
                 </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                <p className="text-[8px] font-black uppercase text-slate-600 italic">الربح اليومي</p>
                <p className="text-lg font-black text-emerald-500 italic">+{m.dailyProfit} USDT</p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-right">
                <p className="text-[8px] font-black uppercase text-slate-600 italic">دورة العمل</p>
                <p className="text-lg font-black text-white italic">{m.duration} يوم</p>
              </div>
            </div>
            <button onClick={() => onBuy(m)} disabled={owned} className={`w-full py-5 rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.4em] shadow-2xl transition-all ${owned ? 'bg-slate-900 text-slate-600' : 'bg-white text-black active:scale-95'}`}>
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
      <div className="space-y-6">
          {user.ownedMachines.map((um: UserMachine) => {
            const m = MACHINES.find(x => x.id === um.machine_id);
            const isDone = um.last_claim_date === today;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border ${isDone ? 'border-white/5 opacity-40' : 'border-blue-500/30'} rounded-[2.5rem] p-8 shadow-2xl text-right`}>
                <div className="flex justify-between items-center flex-row-reverse mb-8 relative z-10">
                  <div className="flex gap-4 flex-row-reverse items-center">
                    <div className="p-3 rounded-xl bg-blue-600/10 text-blue-500"><Cpu size={24}/></div>
                    <div className="text-right"><h4 className="font-black text-xl text-white uppercase italic">{m?.name}</h4></div>
                  </div>
                  <p className={`text-2xl font-black italic ${isDone ? 'text-slate-500' : 'text-emerald-500'}`}>+{m?.dailyProfit} USDT</p>
                </div>
                <button disabled={isDone} onClick={() => onComplete(um)} className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-[11px] tracking-[0.4em] transition-all ${isDone ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 text-white shadow-xl'}`}>
                  {isDone ? t('transactionCompleted') : t('completeTask')}
                </button>
              </div>
            );
          })}
          {user.ownedMachines.length === 0 && <p className="text-center py-20 opacity-20 italic">لا تملك ماكينات نشطة حالياً</p>}
      </div>
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
    </div>
    <div className="space-y-4">
      <p className="text-[10px] font-black uppercase text-slate-700 italic px-4 tracking-widest">معرف الإحالة الخاص بك</p>
      <div className="bg-[#0b0f1a] border border-white/10 p-10 rounded-[2.5rem] flex items-center gap-8 shadow-inner group">
        <button onClick={() => {navigator.clipboard.writeText(user.referral_code); alert('تم نسخ الكود!')}} className="p-5 bg-white/5 rounded-2xl text-blue-500"><Copy size={28} /></button>
        <div className="flex-1 text-right truncate"><span className="text-2xl font-mono text-slate-700 tracking-widest font-bold italic">{user.referral_code}</span></div>
      </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-12 animate-in fade-in duration-500">
    <div className="relative p-12 bg-white/[0.03] border border-white/5 rounded-[4rem] shadow-2xl flex items-center gap-10 flex-row-reverse justify-between overflow-hidden">
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
  </div>
);

const InfoModal = ({ t, onClose }: any) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/98 backdrop-blur-xl">
    <div className="bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[4rem] p-12 text-right space-y-8 animate-in zoom-in-95">
      <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 mx-auto"><ShieldCheck size={42}/></div>
      <h3 className="font-black text-white text-2xl uppercase italic text-center tracking-tighter">{t('securityTitle')}</h3>
      <p className="text-[13px] leading-relaxed text-slate-400 font-bold italic text-center">{t('securityText')}</p>
      <button onClick={onClose} className="w-full bg-white text-black font-black py-6 rounded-[2rem] uppercase tracking-[0.4em] text-[11px] shadow-2xl active:scale-[0.98] transition-all">Acknowledge Protocol</button>
    </div>
  </div>
);

export default App;
