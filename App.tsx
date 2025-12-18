import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home as HomeIcon, 
  Cpu, 
  ListTodo, 
  Users, 
  User as UserIcon, 
  ArrowDownCircle, 
  ArrowUpCircle,
  History,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ShieldCheck,
  Lock,
  HelpCircle,
  X,
  Wallet,
  Activity,
  Copy,
  UploadCloud,
  ArrowDown,
  ArrowRight,
  Zap,
  Globe,
  Database,
  BarChart3,
  Crown,
  Info,
  Layers,
  Star,
  Timer,
  Gem,
  Flame,
  Rocket,
  ShieldAlert,
  Diamond,
  Medal,
  Cpu as CpuIcon,
  ShieldAlert as ShieldIcon
} from 'lucide-react';
import { Language, UserState, UserMachine, Machine } from './types';
import { TRANSLATIONS, MACHINES, DEPOSIT_ADDRESS, MIN_WITHDRAWAL, REFERRAL_PERCENT } from './constants';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getNextTaskTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState<Language>(() => {
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'ar' ? 'ar' : 'en';
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [user, setUser] = useState<UserState>(() => {
    const saved = localStorage.getItem('mining_pro_v11');
    if (saved) return JSON.parse(saved);
    return {
      balance: 0.00,
      withdrawableBalance: 0.00,
      totalRecharge: 0,
      totalWithdraw: 0,
      referralEarnings: 0,
      ownedMachines: [],
      transactions: [],
      lastWithdrawDate: null
    };
  });

  useEffect(() => {
    localStorage.setItem('mining_pro_v11', JSON.stringify(user));
  }, [user]);

  const t = (key: string) => TRANSLATIONS[key]?.[lang] || key;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const buyMachine = async (machine: Machine) => {
    if (user.ownedMachines.length >= 3) {
      showToast(t('maxMachinesReached'), 'error');
      return false;
    }
    if (user.balance < machine.price) {
      showToast(t('insufficientBalance'), 'error');
      return false;
    }

    showToast(lang === 'ar' ? 'جاري الاتصال بالعقدة المشفرة...' : 'Connecting to Encrypted Node...', 'info');
    await new Promise(r => setTimeout(r, 2000));
    
    const newUserMachine: UserMachine = {
      id: Date.now(),
      machineId: machine.id,
      purchaseDate: new Date().toISOString(),
      lastClaimDate: null,
      totalEarned: 0,
      remainingDays: machine.duration
    };

    setUser(prev => ({
      ...prev,
      balance: prev.balance - machine.price,
      ownedMachines: [...prev.ownedMachines, newUserMachine],
      referralEarnings: prev.referralEarnings + (machine.price * REFERRAL_PERCENT)
    }));

    showToast(t('transactionCompleted'), 'success');
    return true;
  };

  const completeTask = async (userMachineId: number) => {
    const userMachine = user.ownedMachines.find(m => m.id === userMachineId);
    if (!userMachine) return false;
    const machine = MACHINES.find(m => m.id === userMachine.machineId);
    if (!machine) return false;
    const today = formatDate(new Date());
    if (userMachine.lastClaimDate === today) return false;

    showToast(lang === 'ar' ? 'جاري تنقية الأصول وتحويلها لربح مشروع...' : 'Purifying Assets and Converting to Profits...', 'info');
    await new Promise(r => setTimeout(r, 2000));
    
    setUser(prev => ({
      ...prev,
      balance: prev.balance + machine.dailyProfit,
      withdrawableBalance: prev.withdrawableBalance + machine.dailyProfit,
      ownedMachines: prev.ownedMachines
        .map(m => m.id === userMachineId ? {
          ...m,
          lastClaimDate: today,
          totalEarned: m.totalEarned + machine.dailyProfit,
          remainingDays: m.remainingDays - 1
        } : m)
        .filter(m => m.remainingDays > 0)
    }));

    showToast(t('transactionCompleted'), 'success');
    return true;
  };

  const handleDeposit = (amount: number, screenshot: File | null) => {
    if (amount <= 0 || !screenshot) return;
    showToast(lang === 'ar' ? 'جاري فحص إشعار التحويل أمنياً...' : 'Security checking transfer notification...', 'info');
    setTimeout(() => {
      setUser(prev => ({
        ...prev,
        balance: prev.balance + amount,
        totalRecharge: prev.totalRecharge + amount
      }));
      showToast(t('transactionCompleted'), 'success');
      navigate('/');
    }, 4000);
  };

  const handleWithdraw = (amount: number, wallet: string) => {
    if (amount < MIN_WITHDRAWAL) return showToast(t('minWithdrawalError'), 'error');
    if (user.withdrawableBalance < amount) return showToast(t('insufficientProfit'), 'error');
    
    const today = formatDate(new Date());
    if (user.lastWithdrawDate === today) return showToast(t('oncePerDayError'), 'error');

    setUser(prev => ({
      ...prev,
      balance: prev.balance - amount,
      withdrawableBalance: prev.withdrawableBalance - amount,
      totalWithdraw: prev.totalWithdraw + amount,
      lastWithdrawDate: today
    }));
    showToast(t('transactionCompleted'), 'success');
    navigate('/');
  };

  return (
    <div className={`min-h-screen pb-28 ${lang === 'ar' ? 'rtl text-right font-["Cairo"]' : 'text-left font-sans'} bg-[#020617] text-[#f8fafc] overflow-x-hidden relative`}>
      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl">
          <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl text-center space-y-8">
            <div className="w-20 h-20 bg-blue-600/10 rounded-full mx-auto flex items-center justify-center border border-blue-500/30">
              <ShieldCheck className="text-blue-500" size={40} />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{t('welcomeTitle')}</h3>
              <p className="text-[13px] leading-relaxed text-slate-400 font-medium tracking-tight px-1">{t('welcomeMessage')}</p>
            </div>
            <button 
              onClick={() => setShowWelcome(false)}
              className="w-full bg-white text-black font-black py-4.5 rounded-2xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
            >
              دخول البوابة الآمنة
            </button>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md">
          <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3 text-right">
                <ShieldCheck className="text-blue-500" size={22} />
                <h3 className="font-black text-white text-lg uppercase tracking-tighter italic">{t('securityTitle')}</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="p-1.5 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-7 overflow-y-auto no-scrollbar space-y-7 text-right">
              <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Lock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('howItWorksBtn')}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-300 font-medium">{t('securityText')}</p>
              </div>
              <div className="bg-emerald-600/5 border border-emerald-500/10 p-6 rounded-2xl">
                 <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Our Profit Mechanism</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-300 font-medium">{t('ourProfit')}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="m-7 bg-white text-black font-black py-4.5 rounded-xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all shadow-xl"
            >
              استمرار بأمان تام
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] space-y-2.5 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3.5 p-4.5 rounded-2xl shadow-2xl pointer-events-auto backdrop-blur-3xl border ${
            toast.type === 'error' ? 'bg-red-500/30 border-red-500/50 text-red-100' : 
            toast.type === 'success' ? 'bg-blue-600/30 border-blue-600/50 text-blue-100' : 
            'bg-slate-900/80 border-slate-700/50 text-slate-100'
          }`}>
            <div className={`p-2 rounded-xl ${toast.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
              {toast.type === 'error' && <XCircle size={18} />}
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <span className="text-[13px] font-black tracking-tighter italic">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="p-5 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-40 bg-[#020617]/90">
        <div className="max-w-md mx-auto flex justify-between items-center px-1">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
              <Zap size={22} className="text-white fill-white relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-black italic tracking-tighter text-2xl leading-none">MINE<span className="text-blue-500">PRO</span></span>
              <span className="text-[8px] font-black uppercase tracking-[0.4em] text-blue-500/80 mt-1">V-PROTOCOL ELITE</span>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border border-white/5 transition-all flex items-center gap-2.5">
            <Globe size={14} className="text-blue-500" />
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-10 relative z-10">
        <Routes>
          <Route path="/" element={<HomeView user={user} t={t} onShowInfo={() => setShowInfo(true)} />} />
          <Route path="/recharge" element={<RechargeView user={user} onDeposit={handleDeposit} t={t} lang={lang} />} />
          <Route path="/withdraw" element={<WithdrawView user={user} onWithdraw={handleWithdraw} t={t} />} />
          <Route path="/machines" element={<MachinesView user={user} onBuy={buyMachine} t={t} lang={lang} />} />
          <Route path="/tasks" element={<TasksView user={user} onComplete={completeTask} t={t} lang={lang} />} />
          <Route path="/team" element={<TeamView user={user} t={t} />} />
          <Route path="/profile" element={<ProfileView user={user} t={t} />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-3xl border-t border-white/5 p-5 z-40">
        <div className="max-w-md mx-auto flex justify-around items-end">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/' || location.pathname === '/recharge' || location.pathname === '/withdraw'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          <NavItem icon={Users} label={t('team')} active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          <NavItem icon={UserIcon} label={t('profile')} active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2.5 transition-all duration-300 group ${active ? 'text-blue-500 -translate-y-2' : 'text-slate-600 hover:text-slate-400'}`}>
    <div className={`p-2.5 rounded-xl transition-all duration-300 ${active ? 'bg-blue-600/15 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : ''}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={`text-[8px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>{label}</span>
  </button>
);

const HomeView = ({ user, t, onShowInfo }: any) => {
  const navigate = useNavigate();
  const [activeUsers, setActiveUsers] = useState<any[]>([]);

  useEffect(() => {
    const names = ['Node_74', 'X_Hunter', 'Crypto_King', 'Vault_Alpha', 'Cipher_01', 'Miner_Elite'];
    const interval = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)];
      const amount = (Math.random() * 85 + 5).toFixed(1);
      setActiveUsers(prev => [{ id: Date.now(), name, amount }, ...prev].slice(0, 1));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[2.5rem] blur opacity-15"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden min-h-[320px] flex flex-col justify-between">
          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
                <p className="text-white/40 font-black text-[9px] uppercase tracking-[0.3em] italic">{t('balanceTitle')}</p>
              </div>
              <button 
                onClick={onShowInfo}
                className="bg-white/5 px-4 py-2 rounded-xl backdrop-blur-3xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2.5 active:scale-95"
              >
                 <HelpCircle size={14} className="text-blue-500" />
                 <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/90">{t('howItWorksBtn')}</span>
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5 text-right">
              <div className="flex items-baseline gap-3 justify-end">
                 <h2 className="text-6xl font-black tracking-tighter text-white">
                   {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                 </h2>
                 <span className="text-lg font-black text-blue-500 tracking-wider italic">USDT</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 py-3 px-5 bg-black/40 rounded-xl border border-white/5 w-fit backdrop-blur-xl mt-5 ml-auto">
               <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Wallet size={14} className="text-blue-400" />
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/60">
                {t('withdrawableBalance')}: <span className="text-emerald-400 text-sm ml-2">{user.withdrawableBalance.toFixed(2)} USDT</span>
               </span>
            </div>
          </div>

          <div className="flex gap-4 relative z-10 mt-8">
            <button onClick={() => navigate('/recharge')} className="flex-1 bg-white text-black font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-100 active:scale-[0.97] transition-all text-[10px] uppercase tracking-[0.2em]">
              <ArrowDownCircle size={18} className="text-blue-600" /> {t('recharge')}
            </button>
            <button onClick={() => navigate('/withdraw')} className="flex-1 bg-blue-600 text-white font-black py-4.5 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 active:scale-[0.97] transition-all text-[10px] uppercase tracking-[0.2em]">
              <ArrowUpCircle size={18} /> {t('withdraw')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-2xl py-3 px-6 flex items-center overflow-hidden shadow-inner h-12 relative">
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#020617] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#020617] to-transparent z-10"></div>
        {activeUsers.length > 0 ? (
          <div className="flex items-center gap-3 w-full justify-center">
            <Activity size={14} className="text-emerald-500" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              <span className="text-slate-200 font-black not-italic">{activeUsers[0].name}</span> harvested <span className="text-emerald-400 font-black">{activeUsers[0].amount} USDT</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full justify-center opacity-40">
             <Globe size={14} />
             <span className="text-[9px] font-black uppercase tracking-[0.4em]">تحديث البروتوكول...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden text-right">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4 border border-blue-500/20 text-blue-500 ml-auto">
               <Cpu size={20} />
            </div>
            <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-[0.2em]">{t('activeContracts')}</p>
            <p className="text-2xl font-black text-white italic tracking-tighter">{user.ownedMachines.length} <span className="text-[10px] text-slate-700 font-bold ml-1.5 uppercase not-italic">/ 3</span></p>
         </div>
         <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden text-right">
            <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20 text-emerald-500 ml-auto">
               <TrendingUp size={20} />
            </div>
            <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-[0.2em]">{t('machineEarnings')}</p>
            <p className="text-2xl font-black text-emerald-400 tracking-tighter italic">
               {user.ownedMachines.reduce((a: number, c: any) => a + c.totalEarned, 0).toFixed(2)} 
               <span className="text-[9px] text-emerald-900 ml-1.5 uppercase not-italic">USDT</span>
            </p>
         </div>
      </div>

      <button 
        onClick={() => navigate('/profile')}
        className="w-full bg-gradient-to-br from-slate-900 to-[#0b0f1a] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl relative overflow-hidden"
      >
          <div className="flex items-center gap-6 relative z-10 text-right">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
               <History size={28}/>
            </div>
            <div className="space-y-1">
               <h4 className="font-black text-base uppercase tracking-[0.1em] italic">{t('history')}</h4>
               <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.15em]">Auditing & Proof</p>
            </div>
          </div>
          <div className="p-3 bg-white/5 rounded-full border border-white/5 shadow-md">
            <ArrowRight size={20} className="text-slate-500" />
          </div>
      </button>

      <div className="flex flex-col items-center gap-2.5 pb-2">
        <div className="flex items-center gap-2.5 bg-white/[0.02] px-4 py-1.5 rounded-full border border-white/5 opacity-40">
          <ShieldCheck size={12} className="text-blue-500" />
          <span className="text-[7px] font-black uppercase tracking-[0.4em]">Protocol Secured v4.0.1</span>
        </div>
      </div>
    </div>
  );
};

const RechargeView = ({ onDeposit, t }: any) => {
  const [amount, setAmount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1 text-right">
         <h2 className="text-lg font-black flex items-center gap-3 uppercase italic tracking-tighter">
           {t('rechargeWallet')} <div className="p-1.5 bg-blue-500/10 rounded-full border border-blue-500/30 text-blue-500"><ArrowDown size={14}/></div>
         </h2>
      </div>

      <div className="bg-[#1c121a] border border-[#3d1a1e] rounded-2xl p-6 flex gap-4 shadow-xl">
         <div className="mt-0.5 flex-shrink-0">
           <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-black italic text-xs">!</div>
         </div>
         <div className="space-y-1 text-right">
            <h4 className="text-[#f87171] font-black text-xs uppercase tracking-widest">{t('securityWarningTitle')}</h4>
            <p className="text-[10px] text-[#fca5a5]/60 leading-relaxed font-bold tracking-tight">{t('securityWarningText')}</p>
         </div>
      </div>

      <div className="bg-[#0b0f1a] border border-white/10 p-8 rounded-[2rem] space-y-6 shadow-xl">
        <div className="space-y-4">
          <p className="text-[9px] text-blue-500 font-black uppercase text-center tracking-[0.2em] italic">
            {t('supportedNetwork')} <span className="text-white not-italic">BEP20 (BSC)</span>
          </p>
          <div className="bg-[#020617] border border-white/5 p-6 rounded-2xl flex items-center gap-4 group hover:border-blue-500/50 transition-all shadow-inner relative overflow-hidden">
            <Copy size={18} className="text-slate-600 cursor-pointer relative z-10" onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); alert('Copied!')}} />
            <span className="text-[9px] font-mono text-slate-500 truncate flex-1 leading-none relative z-10">{DEPOSIT_ADDRESS}</span>
          </div>
        </div>

        <div className="space-y-4 text-right">
           <p className="text-[10px] text-slate-500 font-black uppercase px-1 tracking-[0.1em] italic">{t('amountToDeposit')}</p>
           <div className="bg-[#020617] border border-white/5 p-7 rounded-2xl text-center shadow-inner group focus-within:border-blue-500/50 transition-all">
              <div className="flex items-center justify-center gap-4">
                 <span className="text-slate-800 font-black text-xs uppercase italic">USDT</span>
                 <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none outline-none text-3xl font-black text-white w-32 text-center placeholder:text-white/5" placeholder="0.00" />
              </div>
           </div>
        </div>

        <div className="space-y-4 text-right">
           <div className="space-y-2 px-1">
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.1em] italic">{t('paymentProof')}</p>
             <p className="text-[9px] text-slate-600 font-medium leading-relaxed">{t('paymentProofDesc')}</p>
           </div>
           <div className="relative rounded-[2rem] border-2 border-dashed border-white/10 bg-[#020617]/40 overflow-hidden">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="p-10 flex flex-col items-center gap-4">
                 <UploadCloud size={36} className="text-slate-800" />
                 <div className="text-center space-y-1.5">
                    <span className="text-xs font-black text-slate-500 block">{file ? file.name : t('clickToUpload')}</span>
                    <span className="text-[9px] text-slate-800 uppercase font-black tracking-[0.2em]">{t('maxFileSize')}</span>
                 </div>
              </div>
           </div>
        </div>

        <button 
           onClick={() => onDeposit(Number(amount), file)}
           disabled={!amount || !file}
           className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-900 disabled:text-slate-700 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-all shadow-lg mt-1"
        >
          {t('confirmDeposit')}
        </button>
      </div>
    </div>
  );
};

const WithdrawView = ({ user, onWithdraw, t }: any) => {
  const [amount, setAmount] = useState<string>('');
  const [wallet, setWallet] = useState<string>('');
  return (
    <div className="space-y-8">
      <h2 className="text-xl font-black flex items-center gap-3 italic tracking-tighter uppercase"><ArrowUpCircle size={22} className="text-blue-500"/> {t('withdraw')}</h2>
      <div className="bg-[#0b0f1a] border border-white/10 p-8 rounded-[2.5rem] space-y-8 shadow-xl">
         <div className="bg-blue-600/5 border border-blue-500/10 rounded-[1.8rem] p-8 text-center shadow-inner relative overflow-hidden group">
            <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] mb-3 italic relative z-10">{t('withdrawableBalance')}</p>
            <h3 className="text-4xl font-black text-blue-400 tracking-tighter relative z-10 drop-shadow-lg">{user.withdrawableBalance.toFixed(2)} <span className="text-[10px] font-black italic tracking-widest ml-1.5">USDT</span></h3>
         </div>
         <div className="space-y-6">
            <div className="space-y-3 text-right">
               <p className="text-[10px] text-slate-500 font-black uppercase px-2 tracking-[0.1em] italic">{t('walletAddress')}</p>
               <input type="text" value={wallet} onChange={(e) => setWallet(e.target.value)} className="w-full bg-[#020617] border border-white/5 p-4 rounded-xl font-mono text-[10px] outline-none focus:border-blue-500 transition-all text-slate-500 shadow-inner" placeholder="0x..." />
            </div>
            <div className="space-y-3 text-right">
               <p className="text-[10px] text-slate-500 font-black uppercase px-2 tracking-[0.1em] italic">{t('amount')} (USDT)</p>
               <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-[#020617] border border-white/5 p-4 rounded-xl font-black text-2xl outline-none focus:border-blue-500 transition-all shadow-inner" placeholder="0.00" />
            </div>
            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-4 text-right">
              <ShieldIcon size={16} className="text-red-400 shrink-0" />
              <p className="text-[9px] font-black text-red-400/80 uppercase tracking-wider italic leading-tight">{t('insufficientProfit')}</p>
            </div>
            <button onClick={() => onWithdraw(Number(amount), wallet)} disabled={!amount || !wallet} className="w-full bg-blue-600 hover:bg-blue-500 py-5.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-lg transition-all active:scale-95">
              {t('confirm')}
            </button>
         </div>
      </div>
    </div>
  );
};

const MachinesView = ({ user, onBuy, t, lang }: any) => {
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const getMachineStyle = (price: number) => {
    if (price < 100) return {
      card: "bg-[#0b0f1a] border-white/5",
      icon: "text-blue-500",
      badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      btn: "bg-white text-black hover:bg-slate-100",
      mainIcon: CpuIcon
    };
    if (price < 1000) return {
      card: "bg-gradient-to-br from-[#0b0f1a] to-[#064e3b] border-emerald-500/20",
      icon: "text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      btn: "bg-emerald-600 text-white hover:bg-emerald-500",
      mainIcon: Rocket
    };
    return {
      card: "bg-gradient-to-br from-[#0b0f1a] to-[#451a03] border-amber-500/30",
      icon: "text-amber-500",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      btn: "bg-amber-500 text-black hover:bg-amber-400",
      mainIcon: Gem
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1 text-right">
         <h2 className="text-lg font-black flex items-center gap-3 italic tracking-tighter uppercase">
           <Layers className="text-blue-500" size={18}/> {t('machines')}
         </h2>
         <div className="flex items-center gap-2.5 bg-white/5 px-4 py-2 rounded-xl border border-white/5 shadow-md">
           <Diamond size={12} className="text-blue-400" />
           <span className="text-[9px] font-black text-slate-400 tracking-[0.15em] uppercase">{user.ownedMachines.length} / 3</span>
         </div>
      </div>
      <div className="space-y-6">
        {MACHINES.map(m => {
          const owned = user.ownedMachines.some((om: any) => om.machineId === m.id);
          const loading = buyingId === m.id;
          const styles = getMachineStyle(m.price);
          const MIcon = styles.mainIcon;
          
          return (
            <div key={m.id} className={`${styles.card} border rounded-[2rem] p-6 relative overflow-hidden shadow-xl text-right`}>
              {loading && <div className="absolute inset-0 bg-slate-950/90 z-20 flex items-center justify-center backdrop-blur-md"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
              
              <div className="flex flex-wrap gap-2 mb-4 relative z-10 justify-end">
                <span className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.1em] shadow-sm ${styles.badge}`}>
                  {m.price >= 100000 ? t('godMode') : m.price >= 10000 ? t('legendary') : m.price >= 1000 ? t('limited') : t('recommended')}
                </span>
              </div>

              <div className="flex justify-between items-start mb-6 relative z-10 flex-row-reverse">
                 <div className="flex gap-4 flex-row-reverse">
                    <div className="w-16 h-16 bg-black/40 rounded-xl flex items-center justify-center border border-white/10">
                      <MIcon size={30} className={styles.icon} />
                    </div>
                    <div className="space-y-1.5">
                       <h3 className="font-black text-xl text-white uppercase italic tracking-tighter">{m.name}</h3>
                       <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.25em] italic opacity-60">Purification Node</p>
                    </div>
                 </div>
                 <div className="text-left flex flex-col items-start">
                    <p className={`text-3xl font-black ${styles.icon} tracking-tighter`}>
                      {m.price >= 1000 ? `${(m.price/1000).toFixed(0)}K` : m.price}
                    </p>
                    <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.3em] mt-1 italic">USDT</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                 <div className="bg-black/40 p-4 rounded-xl text-center border border-white/5 shadow-inner">
                    <p className="text-[9px] text-slate-700 font-black mb-1.5 uppercase tracking-[0.1em] italic">{t('dailyProfit')}</p>
                    <p className={`text-2xl font-black ${styles.icon} tracking-tighter italic`}>
                      +{m.dailyProfit.toFixed(1)} 
                      <span className="text-[10px] opacity-20 ml-1.5 font-bold not-italic">USDT</span>
                    </p>
                 </div>
                 <div className="bg-black/40 p-4 rounded-xl text-center border border-white/5 shadow-inner">
                    <p className="text-[9px] text-slate-700 font-black mb-1.5 uppercase tracking-[0.1em] italic">{t('totalProfit')}</p>
                    <p className="text-2xl font-black text-white tracking-tighter italic">
                      {(m.price * 2).toFixed(0)} 
                      <span className="text-[10px] opacity-20 ml-1.5 font-bold not-italic">USDT</span>
                    </p>
                 </div>
              </div>

              <button 
                onClick={async () => {
                   setBuyingId(m.id);
                   // Fix: Corrected function name from buyMachine to onBuy as passed in props.
                   await onBuy(m);
                   setBuyingId(null);
                }}
                disabled={owned || buyingId !== null}
                className={`w-full py-5 rounded-[1.2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-xl relative z-10 overflow-hidden border-t border-white/10 ${owned ? 'bg-slate-900 text-slate-800' : styles.btn + ' active:scale-95'}`}
              >
                {owned ? t('owned') : t('buyNow')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TasksView = ({ user, onComplete, t }: any) => {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>(getNextTaskTime());
  const today = formatDate(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getNextTaskTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-black flex items-center gap-3 italic tracking-tighter uppercase text-right"><ListTodo className="text-blue-500" size={20}/> {t('tasks')}</h2>
      {user.ownedMachines.length === 0 ? (
        <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[2.5rem] p-24 text-center text-slate-800 font-black italic text-[11px] tracking-[0.5em] uppercase">لا توجد عقود نشطة حالياً</div>
      ) : (
        <div className="space-y-6">
          {user.ownedMachines.map((um: any) => {
            const m = MACHINES.find(x => x.id === um.machineId);
            const done = um.lastClaimDate === today;
            const loading = loadingId === um.id;
            if (!m) return null;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden shadow-xl text-right ${done ? 'opacity-30' : ''}`}>
                {loading && <div className="absolute inset-0 bg-slate-950/90 z-20 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>}
                
                <div className="flex justify-between items-center mb-4 relative z-10 flex-row-reverse">
                   <div className="flex gap-4 items-center flex-row-reverse">
                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${done ? 'bg-slate-900 border-slate-800' : 'bg-blue-600/10 border-blue-500/40 text-blue-500'}`}><Clock size={26}/></div>
                      <div className="space-y-1">
                         <h4 className="font-black text-white italic uppercase tracking-tighter text-lg">{m.name}</h4>
                         <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.2em] italic mt-1.5">Authenticated Node</p>
                      </div>
                   </div>
                   <div className="text-left">
                      <p className="text-2xl font-black text-emerald-400 tracking-tighter">+{m.dailyProfit.toFixed(1)}</p>
                      <p className="text-[10px] text-slate-800 font-black uppercase tracking-[0.3em] mt-1">USDT</p>
                   </div>
                </div>

                {done ? (
                   <div className="bg-[#020617] py-4 px-8 rounded-xl text-center border border-white/5 shadow-inner">
                      <span className="text-[10px] text-slate-600 font-black uppercase tracking-[0.4em] italic">{t('nextTaskIn')}: <span className="text-blue-500 ml-4 font-mono text-sm not-italic">{countdown}</span></span>
                   </div>
                ) : (
                   <button onClick={async () => {
                      setLoadingId(um.id);
                      await onComplete(um.id);
                      setLoadingId(null);
                   }} className="w-full bg-[#1e293b] hover:bg-slate-800 py-4.5 rounded-xl font-black text-[11px] uppercase tracking-[0.4em] active:scale-95 transition-all">
                      {t('completeTask')}
                   </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TeamView = ({ user, t }: any) => (
  <div className="space-y-10">
    <h2 className="text-xl font-black flex items-center gap-4 italic tracking-tighter uppercase text-right"><Users className="text-blue-500" size={22}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/5 rounded-[2.5rem] p-16 text-center space-y-4 shadow-xl">
       <p className="text-slate-700 text-[11px] font-black uppercase tracking-[0.5em] italic">{t('referralEarnings')}</p>
       <h3 className="text-7xl font-black text-blue-500 tracking-tighter italic">{user.referralEarnings.toFixed(2)} <span className="text-sm text-slate-800 font-bold ml-2 uppercase not-italic tracking-[0.15em]">USDT</span></h3>
    </div>
    <div className="space-y-6 text-right">
       <p className="text-[11px] text-slate-700 font-black uppercase px-8 tracking-[0.4em] italic">{t('referralLink')}</p>
       <div className="bg-[#020617] border border-white/5 p-8 rounded-2xl flex items-center gap-7">
          <Copy size={24} className="text-blue-500 cursor-pointer active:scale-95" onClick={() => {navigator.clipboard.writeText('https://mine-pro.cc/ref/node_elite'); alert('Copied!')}}/>
          <span className="text-sm font-mono text-slate-700 truncate flex-1 tracking-tight">https://mine-pro.cc/ref/node_elite</span>
       </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-10">
    <div className="flex items-center gap-10 p-8 bg-white/[0.02] border border-white/5 rounded-[3.5rem] shadow-2xl justify-end">
       <div className="space-y-2.5 text-right">
          <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">Node_Elite</h3>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl">
             <ShieldCheck size={14} className="text-blue-500" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Tier-1 Cloud Operator</span>
          </div>
       </div>
       <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 border-4 border-[#020617] shadow-xl flex items-center justify-center overflow-hidden">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.balance + 101}`} alt="Avatar" className="w-full h-full object-cover"/>
       </div>
    </div>
    
    <div className="bg-[#0b0f1a] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-2xl">
       <div className="p-8 border-b border-white/5 font-black text-[11px] uppercase tracking-[0.4em] flex items-center gap-5 text-slate-600 italic flex-row-reverse">
          <History size={24} className="text-blue-500"/> {t('history')}
       </div>
       <div className="divide-y divide-white/[0.03] max-h-[450px] overflow-y-auto no-scrollbar">
          {user.transactions.length === 0 ? (
             <div className="p-24 text-center text-slate-800 text-[11px] font-black italic uppercase tracking-[0.7em] opacity-40">لا توجد سجلات حالية</div>
          ) : user.transactions.map((tx: any) => (
             <div key={tx.id} className="p-8 flex justify-between items-center flex-row-reverse">
                <div className="flex gap-8 items-center flex-row-reverse">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${tx.type === 'deposit' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                      {tx.type === 'deposit' ? <ArrowDownCircle size={28}/> : <ArrowUpCircle size={28}/>}
                   </div>
                   <div className="space-y-1.5 text-right">
                      <p className="text-base font-black text-white uppercase tracking-tighter italic">{t(tx.type)}</p>
                      <p className="text-[10px] text-slate-800 font-black uppercase tracking-[0.3em]">{new Date(tx.date).toLocaleDateString()}</p>
                   </div>
                </div>
                <div className="text-left space-y-1.5">
                   <p className={`text-2xl font-black tracking-tighter ${tx.type === 'withdrawal' ? 'text-red-400' : 'text-emerald-400'}`}>{tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toFixed(2)}</p>
                   <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-900">{tx.status}</p>
                </div>
             </div>
          ))}
       </div>
    </div>
  </div>
);

export default App;