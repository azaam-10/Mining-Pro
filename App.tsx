
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
    const saved = localStorage.getItem('mining_pro_prestige_v8');
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
    localStorage.setItem('mining_pro_prestige_v8', JSON.stringify(user));
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

    showToast(lang === 'ar' ? 'جاري الاتصال بالسيرفر...' : 'Connecting to Server...', 'info');
    await new Promise(r => setTimeout(r, 2000));
    showToast(lang === 'ar' ? 'جاري مزامنة عقد التعدين...' : 'Syncing Mining Node...', 'info');
    await new Promise(r => setTimeout(r, 1500));

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

    showToast(lang === 'ar' ? 'جاري تجميع الهاش...' : 'Collecting Hash...', 'info');
    await new Promise(r => setTimeout(r, 1500));
    showToast(lang === 'ar' ? 'جاري تنقية الأرباح...' : 'Purifying Profits...', 'info');
    await new Promise(r => setTimeout(r, 1500));
    
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
    showToast(lang === 'ar' ? 'جاري مراجعة إشعار التحويل...' : 'Verifying Notification Screenshot...', 'info');
    setTimeout(() => {
      setUser(prev => ({
        ...prev,
        balance: prev.balance + amount,
        totalRecharge: prev.totalRecharge + amount
      }));
      showToast(t('transactionCompleted'), 'success');
      navigate('/');
    }, 3000);
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
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none animate-pulse"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Welcome Reassurance Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" onClick={() => setShowWelcome(false)}></div>
          <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[2.5rem] p-10 shadow-[0_0_100px_rgba(37,99,235,0.2)] text-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-blue-600/10 rounded-full mx-auto flex items-center justify-center border border-blue-500/30 animate-pulse">
              <ShieldCheck className="text-blue-500" size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">{t('welcomeTitle')}</h3>
              <p className="text-sm leading-relaxed text-slate-400 font-medium tracking-tight px-2">{t('welcomeMessage')}</p>
            </div>
            <button 
              onClick={() => setShowWelcome(false)}
              className="w-full bg-white text-black font-black py-5 rounded-2xl uppercase tracking-[0.3em] text-[10px] hover:bg-slate-200 transition-all shadow-xl active:scale-95"
            >
              INITIALIZE INTERFACE
            </button>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={() => setShowInfo(false)}></div>
          <div className="relative bg-[#0b0f1a] border border-white/10 w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 bg-gradient-to-br from-[#1e293b] to-[#0f172a] border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-blue-500" size={22} />
                <h3 className="font-black text-white text-lg uppercase tracking-tighter italic">{t('securityTitle')}</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="p-1.5 bg-white/5 rounded-full text-slate-400 hover:text-white transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
              <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Lock size={16} className="animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">{t('howItWorksBtn')}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300 font-medium">{t('securityText')}</p>
              </div>
              <div className="bg-emerald-600/5 border border-emerald-500/10 p-5 rounded-2xl">
                 <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Our Profit Mechanism</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300 font-medium">{t('ourProfit')}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="m-6 bg-white text-black font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[9px] hover:bg-slate-200 transition-all shadow-xl active:scale-95"
            >
              PROCEED WITH CONFIDENCE
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[90%] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl animate-bounce-in pointer-events-auto backdrop-blur-3xl border ${
            toast.type === 'error' ? 'bg-red-500/30 border-red-500/50 text-red-100' : 
            toast.type === 'success' ? 'bg-blue-600/30 border-blue-600/50 text-blue-100' : 
            'bg-slate-900/80 border-slate-700/50 text-slate-100'
          }`}>
            <div className={`p-2 rounded-lg ${toast.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
              {toast.type === 'error' && <XCircle size={16} />}
              {toast.type === 'success' && <CheckCircle2 size={16} />}
              {toast.type === 'info' && <Info size={16} />}
            </div>
            <span className="text-xs font-black tracking-tighter italic">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="p-5 border-b border-white/5 backdrop-blur-2xl sticky top-0 z-40 bg-[#020617]/90">
        <div className="max-w-md mx-auto flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg relative overflow-hidden">
              <Zap size={20} className="text-white fill-white relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-black italic tracking-tighter text-xl leading-none">MINE<span className="text-blue-500">PRO</span></span>
              <span className="text-[7px] font-black uppercase tracking-[0.4em] text-blue-500/80 mt-1">ELITE MINING</span>
            </div>
          </div>
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border border-white/5 transition-all flex items-center gap-2">
            <Globe size={12} className="text-blue-500" />
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-5 space-y-8 relative z-10">
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

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/95 backdrop-blur-3xl border-t border-white/5 p-4 z-40">
        <div className="max-w-md mx-auto flex justify-around items-end">
          <NavItem icon={HomeIcon} label={t('home')} active={location.pathname === '/' || location.pathname === '/recharge' || location.pathname === '/withdraw'} onClick={() => navigate('/')} />
          <NavItem icon={Cpu} label={t('machines')} active={location.pathname === '/machines'} onClick={() => navigate('/machines')} />
          <NavItem icon={ListTodo} label={t('tasks')} active={location.pathname === '/tasks'} onClick={() => navigate('/tasks')} />
          <NavItem icon={Users} label={t('team')} active={location.pathname === '/team'} onClick={() => navigate('/team')} />
          <NavItem icon={UserIcon} label={t('profile')} active={location.pathname === '/profile'} onClick={() => navigate('/profile')} />
        </div>
      </nav>

      <style>{`
        @keyframes bounce-in { 0% { transform: translate(-50%, -30px); opacity: 0; } 100% { transform: translate(-50%, 0); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; }
        ::-webkit-scrollbar { width: 0; display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .perspective-aura { perspective: 1000px; }
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite linear;
        }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .pulse-soft { animation: pulse-soft 3s infinite ease-in-out; }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
        .machine-card-hover:active { transform: scale(0.98); }
        .haptic-click:active { transform: translateY(2px); transition: 0.1s; }
        @keyframes haptic-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(2px); }
          50% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
          100% { transform: translateX(0); }
        }
        .animate-haptic { animation: haptic-shake 0.2s ease-in-out; }
      `}</style>
    </div>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all duration-300 group ${active ? 'text-blue-500 -translate-y-1.5' : 'text-slate-600 hover:text-slate-400'}`}>
    <div className={`p-2 rounded-xl transition-all duration-300 ${active ? 'bg-blue-600/15 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : ''}`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    </div>
    <span className={`text-[7px] font-black uppercase tracking-[0.1em] transition-all ${active ? 'opacity-100 scale-105' : 'opacity-40'}`}>{label}</span>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-top-10 duration-700">
      <div className="relative group perspective-aura">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-[2rem] blur opacity-15 group-hover:opacity-30 transition-opacity duration-700 animate-pulse"></div>
        <div className="relative bg-[#0b0f1a] border border-white/10 rounded-[2rem] p-7 shadow-2xl overflow-hidden min-h-[300px] flex flex-col justify-between">
          <div className="absolute top-[-20%] right-[-10%] p-10 opacity-[0.03] scale-[2] rotate-12 pointer-events-none transition-transform duration-1000 group-hover:scale-[2.3]">
            <Crown size={120} />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping shadow-[0_0_8px_rgba(59,130,246,1)]"></div>
                <p className="text-white/40 font-black text-[8px] uppercase tracking-[0.3em] italic">{t('balanceTitle')}</p>
              </div>
              <button 
                onClick={onShowInfo}
                className="bg-white/5 px-3 py-1.5 rounded-lg backdrop-blur-3xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95 group/btn"
              >
                 <HelpCircle size={12} className="text-blue-500" />
                 <span className="text-[8px] font-black uppercase tracking-[0.1em] text-white/80">{t('howItWorksBtn')}</span>
              </button>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2.5">
                 <h2 className="text-5xl font-black tracking-tighter text-white drop-shadow-lg">
                   {user.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                 </h2>
                 <span className="text-sm font-black text-blue-500 tracking-wider italic animate-pulse">USDT</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 py-2.5 px-4 bg-black/40 rounded-xl border border-white/5 w-fit backdrop-blur-xl mt-4">
               <div className="p-1 bg-blue-500/10 rounded-md">
                <Wallet size={12} className="text-blue-400" />
               </div>
               <span className="text-[9px] font-black uppercase tracking-[0.1em] text-white/60">
                {t('withdrawableBalance')}: <span className="text-emerald-400 text-xs ml-1.5">{user.withdrawableBalance.toFixed(2)} USDT</span>
               </span>
            </div>
          </div>

          <div className="flex gap-3 relative z-10 mt-6">
            <button onClick={() => navigate('/recharge')} className="flex-1 bg-white text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2.5 hover:bg-slate-100 active:scale-[0.97] transition-all shadow-md text-[9px] uppercase tracking-[0.15em]">
              <ArrowDownCircle size={16} className="text-blue-600" /> {t('recharge')}
            </button>
            <button onClick={() => navigate('/withdraw')} className="flex-1 bg-blue-600 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2.5 hover:bg-blue-500 active:scale-[0.97] transition-all shadow-md text-[9px] uppercase tracking-[0.15em]">
              <ArrowUpCircle size={16} /> {t('withdraw')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl py-2.5 px-5 flex items-center overflow-hidden shadow-inner h-10 relative haptic-click">
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#020617] to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#020617] to-transparent z-10"></div>
        {activeUsers.length > 0 ? (
          <div className="flex items-center gap-2.5 animate-in slide-in-from-bottom-6 duration-700 w-full justify-center">
            <Activity size={12} className="text-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
              <span className="text-slate-200 font-black not-italic">{activeUsers[0].name}</span> harvested <span className="text-emerald-400 font-black">{activeUsers[0].amount} USDT</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 w-full justify-center opacity-40">
             <Globe size={12} className="animate-spin duration-1000" />
             <span className="text-[8px] font-black uppercase tracking-[0.3em]">Optimizing hashrate...</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
         <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/5 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-700 shadow-xl backdrop-blur-md">
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] rotate-12 group-hover:scale-125 transition-transform">
              <Database size={32} />
            </div>
            <div className="w-8 h-8 bg-blue-600/10 rounded-lg flex items-center justify-center mb-3 border border-blue-500/20 text-blue-500">
               <Cpu size={16} />
            </div>
            <p className="text-[8px] text-slate-500 font-black uppercase mb-1 tracking-[0.2em]">{t('activeContracts')}</p>
            <p className="text-xl font-black text-white italic tracking-tighter">{user.ownedMachines.length} <span className="text-[9px] text-slate-700 font-bold ml-1 uppercase not-italic">/ 3</span></p>
         </div>
         <div className="bg-white/5 p-5 rounded-[1.5rem] border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-700 shadow-xl backdrop-blur-md">
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] -rotate-12 group-hover:scale-125 transition-transform">
              <BarChart3 size={32} />
            </div>
            <div className="w-8 h-8 bg-emerald-600/10 rounded-lg flex items-center justify-center mb-3 border border-emerald-500/20 text-emerald-500">
               <TrendingUp size={16} />
            </div>
            <p className="text-[8px] text-slate-500 font-black uppercase mb-1 tracking-[0.2em]">{t('machineEarnings')}</p>
            <p className="text-xl font-black text-emerald-400 tracking-tighter italic">
               {user.ownedMachines.reduce((a: number, c: any) => a + c.totalEarned, 0).toFixed(2)} 
               <span className="text-[8px] text-emerald-900 ml-1 uppercase not-italic">USDT</span>
            </p>
         </div>
      </div>

      <button 
        onClick={() => navigate('/profile')}
        className="w-full bg-gradient-to-br from-slate-900 to-[#0b0f1a] border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-white/10 transition-all shadow-xl relative overflow-hidden haptic-click"
      >
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 group-hover:scale-105 transition-transform">
               <History size={24}/>
            </div>
            <div className="text-left space-y-0.5">
               <h4 className="font-black text-sm uppercase tracking-[0.1em] italic">{t('history')}</h4>
               <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.15em]">Auditing & Ledger</p>
            </div>
          </div>
          <div className="p-2.5 bg-white/5 rounded-full group-hover:translate-x-1 transition-transform border border-white/5">
            <ArrowRight size={16} className="text-slate-500 group-hover:text-white" />
          </div>
      </button>

      <div className="flex flex-col items-center gap-2 pb-2">
        <div className="flex items-center gap-2 bg-white/[0.02] px-3.5 py-1 rounded-full border border-white/5 opacity-40 hover:opacity-100 transition-opacity duration-1000">
          <ShieldCheck size={10} className="text-blue-500" />
          <span className="text-[6px] font-black uppercase tracking-[0.4em]">Protocol Secured v4.0.1</span>
        </div>
      </div>
    </div>
  );
};

const RechargeView = ({ onDeposit, t }: any) => {
  const [amount, setAmount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex justify-between items-center px-1">
         <h2 className="text-lg font-black flex items-center gap-2.5 uppercase italic tracking-tighter">
           {t('rechargeWallet')} <div className="p-1.5 bg-blue-500/10 rounded-full border border-blue-500/30 text-blue-500"><ArrowDown size={12}/></div>
         </h2>
      </div>

      <div className="bg-[#1c121a] border border-[#3d1a1e] rounded-2xl p-5 flex gap-3.5 shadow-xl">
         <div className="mt-0.5 flex-shrink-0">
           <div className="w-7 h-7 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-black italic text-[10px] animate-pulse">!</div>
         </div>
         <div className="space-y-1">
            <h4 className="text-[#f87171] font-black text-[10px] uppercase tracking-widest">{t('securityWarningTitle')}</h4>
            <p className="text-[9px] text-[#fca5a5]/60 leading-relaxed font-bold tracking-tight">{t('securityWarningText')}</p>
         </div>
      </div>

      <div className="bg-[#0b0f1a] border border-white/10 p-7 rounded-[1.5rem] space-y-5 shadow-xl">
        <div className="space-y-3">
          <p className="text-[8px] text-blue-500 font-black uppercase text-center tracking-[0.2em] italic">
            {t('supportedNetwork')} <span className="text-white not-italic">BEP20 (BSC)</span>
          </p>
          <div className="bg-[#020617] border border-white/5 p-5 rounded-xl flex items-center gap-3.5 group hover:border-blue-500/50 transition-all shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100"></div>
            <Copy size={16} className="text-slate-600 group-hover:text-blue-500 cursor-pointer haptic-click relative z-10" onClick={() => {navigator.clipboard.writeText(DEPOSIT_ADDRESS); alert('Copied!')}} />
            <span className="text-[8px] font-mono text-slate-500 truncate flex-1 leading-none relative z-10">{DEPOSIT_ADDRESS}</span>
          </div>
        </div>

        <div className="space-y-3">
           <p className="text-[9px] text-slate-500 font-black uppercase px-1 text-right tracking-[0.1em] italic">{t('amountToDeposit')}</p>
           <div className="bg-[#020617] border border-white/5 p-6 rounded-xl text-center shadow-inner group focus-within:border-blue-500/50 transition-all">
              <div className="flex items-center justify-center gap-3">
                 <span className="text-slate-800 font-black text-[10px] uppercase italic">USDT</span>
                 <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none outline-none text-2xl font-black text-white w-28 text-center placeholder:text-white/5" placeholder="0.00" />
              </div>
           </div>
        </div>

        <div className="space-y-4">
           <div className="space-y-1.5 text-right px-1">
             <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.1em] italic">{t('paymentProof')}</p>
             <p className="text-[8px] text-slate-600 font-medium leading-tight">{t('paymentProofDesc')}</p>
           </div>
           <div className="relative group rounded-[1.5rem] border-2 border-dashed border-white/10 hover:border-blue-500/50 transition-all bg-[#020617]/40 overflow-hidden">
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <div className="p-8 flex flex-col items-center gap-3">
                 <UploadCloud size={32} className="text-slate-800 group-hover:text-blue-500 transition-all duration-500 group-hover:-translate-y-1" />
                 <div className="text-center space-y-1">
                    <span className="text-[10px] font-black text-slate-500 group-hover:text-white block">{file ? file.name : t('clickToUpload')}</span>
                    <span className="text-[8px] text-slate-800 uppercase font-black tracking-[0.2em]">{t('maxFileSize')}</span>
                 </div>
              </div>
           </div>
        </div>

        <button 
           onClick={() => onDeposit(Number(amount), file)}
           disabled={!amount || !file}
           className="w-full bg-white text-black hover:bg-slate-200 disabled:bg-slate-900 disabled:text-slate-700 py-4.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 mt-1 haptic-click"
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
    <div className="space-y-7 animate-in slide-in-from-bottom-8 duration-600">
      <h2 className="text-lg font-black flex items-center gap-2.5 italic tracking-tighter uppercase"><ArrowUpCircle size={20} className="text-blue-500"/> {t('withdraw')}</h2>
      <div className="bg-[#0b0f1a] border border-white/10 p-7 rounded-[2rem] space-y-7 shadow-xl">
         <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-7 text-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100"></div>
            <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.3em] mb-2 italic relative z-10">{t('withdrawableBalance')}</p>
            <h3 className="text-3xl font-black text-blue-400 tracking-tighter relative z-10 drop-shadow-lg">{user.withdrawableBalance.toFixed(2)} <span className="text-[9px] font-black italic tracking-widest ml-1">USDT</span></h3>
         </div>
         <div className="space-y-5">
            <div className="space-y-2.5 text-right">
               <p className="text-[9px] text-slate-500 font-black uppercase px-1.5 tracking-[0.1em] italic">{t('walletAddress')}</p>
               <input type="text" value={wallet} onChange={(e) => setWallet(e.target.value)} className="w-full bg-[#020617] border border-white/5 p-3.5 rounded-lg font-mono text-[9px] outline-none focus:border-blue-500 transition-all text-slate-500" placeholder="0x..." />
            </div>
            <div className="space-y-2.5 text-right">
               <p className="text-[9px] text-slate-500 font-black uppercase px-1.5 tracking-[0.1em] italic">{t('amount')} (USDT)</p>
               <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-[#020617] border border-white/5 p-3.5 rounded-lg font-black text-xl outline-none focus:border-blue-500 transition-all" placeholder="0.00" />
            </div>
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center gap-3">
              <ShieldIcon size={14} className="text-red-400 shrink-0" />
              <p className="text-[8px] font-black text-red-400/80 text-right uppercase tracking-wider italic">{t('depositNote')}</p>
            </div>
            <button onClick={() => onWithdraw(Number(amount), wallet)} disabled={!amount || !wallet} className="w-full bg-blue-600 hover:bg-blue-500 py-4.5 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 haptic-click">
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
      glow: "opacity-[0.03]",
      icon: "text-blue-500",
      badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      btn: "bg-white text-black hover:bg-slate-100",
      aura: "",
      mainIcon: CpuIcon
    };
    if (price < 1000) return {
      card: "bg-gradient-to-br from-[#0b0f1a] to-[#064e3b] border-emerald-500/20",
      glow: "opacity-[0.06]",
      icon: "text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      btn: "bg-emerald-600 text-white hover:bg-emerald-500",
      aura: "glow-institutional",
      mainIcon: Rocket
    };
    if (price < 10000) return {
      card: "bg-gradient-to-br from-[#0b0f1a] to-[#451a03] border-amber-500/30",
      glow: "opacity-[0.10]",
      icon: "text-amber-500",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      btn: "bg-amber-500 text-black hover:bg-amber-400",
      aura: "glow-titan shimmer",
      mainIcon: Gem
    };
    if (price < 100000) return {
      card: "bg-gradient-to-br from-[#0b0f1a] to-[#450a0a] border-red-500/40",
      glow: "opacity-[0.15]",
      icon: "text-red-500",
      badge: "bg-red-500/20 text-red-300 border-red-500/50",
      btn: "bg-red-600 text-white hover:bg-red-500",
      aura: "glow-mainframe shimmer",
      mainIcon: Medal
    };
    return {
      card: "bg-gradient-to-br from-[#020617] via-[#2e1065] to-[#020617] border-purple-500/50",
      glow: "opacity-[0.20]",
      icon: "text-purple-400",
      badge: "bg-purple-500/30 text-purple-200 border-purple-500/50",
      btn: "bg-white text-purple-900 hover:bg-purple-100 shadow-lg",
      aura: "glow-galactic shimmer",
      mainIcon: Crown
    };
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-600">
      <div className="flex justify-between items-center px-1">
         <h2 className="text-lg font-black flex items-center gap-2.5 italic tracking-tighter uppercase">
           <Layers className="text-blue-500" size={18}/> {t('machines')}
         </h2>
         <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-md">
           <Diamond size={10} className="text-blue-400" />
           <span className="text-[8px] font-black text-slate-400 tracking-[0.1em] uppercase">{user.ownedMachines.length} / 3</span>
         </div>
      </div>
      <div className="space-y-5">
        {MACHINES.map(m => {
          const owned = user.ownedMachines.some((om: any) => om.machineId === m.id);
          const loading = buyingId === m.id;
          const styles = getMachineStyle(m.price);
          const MIcon = styles.mainIcon;
          
          return (
            <div key={m.id} className={`${styles.card} ${styles.aura} border rounded-[2rem] p-5 relative overflow-hidden group transition-all duration-700 shadow-xl backdrop-blur-2xl machine-card-hover ${loading ? 'animate-haptic' : ''}`}>
              {loading && <div className="absolute inset-0 bg-slate-950/90 z-20 flex items-center justify-center backdrop-blur-md"><Loader2 className="animate-spin text-blue-500" size={30}/></div>}
              
              <div className={`absolute top-0 right-0 p-5 ${styles.glow} scale-[1.4] rotate-12 pointer-events-none group-hover:scale-[1.6] transition-transform duration-1000`}>
                <MIcon size={80} />
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1.5 mb-3.5 relative z-10">
                <span className={`px-2.5 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-[0.1em] shadow-sm ${styles.badge}`}>
                  {m.price >= 100000 ? t('godMode') : m.price >= 10000 ? t('legendary') : m.price >= 1000 ? t('limited') : t('recommended')}
                </span>
                {m.price >= 500 && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-[0.1em] flex items-center gap-1 shadow-sm pulse-soft">
                    <Flame size={9} className="fill-red-500" /> High ROI
                  </span>
                )}
              </div>

              <div className="flex justify-between items-start mb-5 relative z-10">
                 <div className="flex gap-3.5">
                    <div className="w-14 h-14 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-105 transition-transform backdrop-blur-3xl">
                      <MIcon size={28} className={styles.icon} />
                    </div>
                    <div className="space-y-1">
                       <h3 className="font-black text-lg text-white uppercase italic tracking-tighter group-hover:translate-x-0.5 transition-transform drop-shadow-sm">{m.name}</h3>
                       <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] italic opacity-60">Tier {Math.floor(m.price/100)} Quantum Node</p>
                    </div>
                 </div>
                 <div className="text-right flex flex-col items-end">
                    <p className={`text-2xl font-black ${m.price >= 10000 ? 'text-amber-500' : m.price >= 100000 ? 'text-purple-400' : 'text-blue-500'} tracking-tighter drop-shadow-md`}>
                      {m.price >= 1000 ? `${(m.price/1000).toFixed(0)}K` : m.price}
                    </p>
                    <p className="text-[8px] text-slate-700 font-black uppercase tracking-[0.3em] mt-0.5 italic">USDT</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5 relative z-10">
                 <div className="bg-black/40 p-3.5 rounded-[1rem] text-center border border-white/5 shadow-inner transition-colors backdrop-blur-xl">
                    <p className="text-[8px] text-slate-700 font-black mb-1 uppercase tracking-[0.1em] italic">{t('dailyProfit')}</p>
                    <p className={`text-xl font-black ${styles.icon} tracking-tighter italic`}>
                      +{m.dailyProfit >= 1000 ? (m.dailyProfit/1000).toFixed(1)+'K' : m.dailyProfit.toFixed(1)} 
                      <span className="text-[9px] opacity-20 ml-1 font-bold not-italic">USDT</span>
                    </p>
                 </div>
                 <div className="bg-black/40 p-3.5 rounded-[1rem] text-center border border-white/5 shadow-inner transition-colors backdrop-blur-xl">
                    <p className="text-[8px] text-slate-700 font-black mb-1 uppercase tracking-[0.1em] italic">{t('totalProfit')}</p>
                    <p className="text-xl font-black text-white tracking-tighter italic">
                      {(m.price * 2 >= 1000) ? ((m.price * 2)/1000).toFixed(0)+'K' : (m.price * 2).toFixed(0)} 
                      <span className="text-[9px] opacity-20 ml-1 font-bold not-italic">USDT</span>
                    </p>
                 </div>
              </div>

              <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 rounded-xl mb-5 border border-white/10 relative z-10 shadow-md">
                <div className="flex items-center gap-2.5">
                  <Timer size={14} className="text-blue-400" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('contractDuration')}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white italic tracking-tighter">{m.duration}</span>
                  <span className="text-[9px] font-black text-slate-700 uppercase">{t('days')}</span>
                </div>
              </div>

              <button 
                onClick={async () => {
                   setBuyingId(m.id);
                   const success = await onBuy(m);
                   setBuyingId(null);
                }}
                disabled={owned || buyingId !== null}
                className={`w-full py-4 rounded-[1rem] font-black text-[10px] uppercase tracking-[0.4em] transition-all shadow-lg relative z-10 overflow-hidden group/btn border-t border-white/10 ${owned ? 'bg-slate-900 text-slate-800' : styles.btn + ' haptic-click'}`}
              >
                {!owned && <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity shimmer"></div>}
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
    <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-600">
      <h2 className="text-lg font-black flex items-center gap-2.5 italic tracking-tighter uppercase"><ListTodo className="text-blue-500" size={18}/> {t('tasks')}</h2>
      {user.ownedMachines.length === 0 ? (
        <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] p-24 text-center text-slate-800 font-black italic text-[10px] tracking-[0.4em] uppercase shadow-inner">SYSTEM IDLE - INITIATE NODE</div>
      ) : (
        <div className="space-y-5">
          {user.ownedMachines.map((um: any) => {
            const m = MACHINES.find(x => x.id === um.machineId);
            const done = um.lastClaimDate === today;
            const loading = loadingId === um.id;
            if (!m) return null;
            return (
              <div key={um.id} className={`bg-[#0b0f1a] border border-white/5 rounded-[1.8rem] p-5 relative overflow-hidden transition-all duration-700 shadow-xl ${done ? 'opacity-30 grayscale' : 'hover:border-blue-500/30'} ${loading ? 'animate-haptic' : ''}`}>
                {loading && <div className="absolute inset-0 bg-slate-950/90 z-20 flex items-center justify-center backdrop-blur-md"><Loader2 className="animate-spin text-blue-500" size={30}/></div>}
                
                <div className="flex justify-between items-center mb-3 relative z-10">
                   <div className="flex gap-3.5 items-center">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner ${done ? 'bg-slate-900 border-slate-800' : 'bg-blue-600/10 border-blue-500/40 text-blue-500 animate-pulse'}`}><Clock size={22}/></div>
                      <div className="space-y-0.5">
                         <h4 className="font-black text-white italic uppercase tracking-tighter text-base">{m.name}</h4>
                         <p className="text-[8px] text-slate-700 font-black uppercase tracking-[0.2em] italic mt-1">Authenticated Node</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xl font-black text-emerald-400 tracking-tighter">+{m.dailyProfit.toFixed(1)}</p>
                      <p className="text-[9px] text-slate-800 font-black uppercase tracking-[0.3em] mt-0.5">USDT</p>
                   </div>
                </div>

                <div className="flex items-center justify-between px-5 py-2.5 bg-white/5 rounded-xl mb-5 border border-white/5 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <Timer size={14} className="text-blue-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('contractDuration')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black text-white italic tracking-tighter">{um.remainingDays}</span>
                    <span className="text-[9px] font-black text-slate-600 uppercase">{t('days')}</span>
                  </div>
                </div>

                {done ? (
                   <div className="bg-[#020617] py-3.5 px-6 rounded-lg text-center border border-white/5 shadow-inner relative z-10">
                      <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] italic">{t('nextTaskIn')}: <span className="text-blue-500 ml-3 font-mono text-xs not-italic">{countdown}</span></span>
                   </div>
                ) : (
                   <button onClick={async () => {
                      setLoadingId(um.id);
                      await onComplete(um.id);
                      setLoadingId(null);
                   }} className="w-full bg-[#1e293b] hover:bg-slate-800 py-3.5 rounded-lg font-black text-[10px] uppercase tracking-[0.3em] shadow-lg transition-all haptic-click relative z-10">
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
  <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-600">
    <h2 className="text-xl font-black flex items-center gap-3.5 italic tracking-tighter uppercase"><Users className="text-blue-500" size={22}/> {t('team')}</h2>
    <div className="bg-[#0b0f1a] border border-white/5 rounded-[2rem] p-12 text-center space-y-3.5 shadow-xl relative overflow-hidden group">
       <div className="absolute -inset-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] blur opacity-[0.05] transition-opacity duration-1000"></div>
       <p className="text-slate-700 text-[10px] font-black uppercase tracking-[0.4em] relative z-10 italic">{t('referralEarnings')}</p>
       <h3 className="text-6xl font-black text-blue-500 tracking-tighter relative z-10 italic drop-shadow-lg">{user.referralEarnings.toFixed(2)} <span className="text-xs text-slate-800 font-bold ml-2 uppercase not-italic tracking-[0.15em]">USDT</span></h3>
    </div>
    <div className="space-y-5">
       <p className="text-[10px] text-slate-700 font-black uppercase px-6 tracking-[0.3em] italic">{t('referralLink')}</p>
       <div className="bg-[#020617] border border-white/5 p-7 rounded-2xl flex items-center gap-6 group shadow-inner relative overflow-hidden border-t border-white/10">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100"></div>
          <Copy size={20} className="text-blue-500 cursor-pointer haptic-click relative z-10" onClick={() => {navigator.clipboard.writeText('https://mine-pro.cc/ref/node_elite'); alert('Copied!')}}/>
          <span className="text-xs font-mono text-slate-700 truncate flex-1 tracking-tight relative z-10">https://mine-pro.cc/ref/node_elite</span>
       </div>
    </div>
  </div>
);

const ProfileView = ({ user, t }: any) => (
  <div className="space-y-10 animate-in fade-in duration-1000">
    <div className="flex items-center gap-8 p-6 bg-white/[0.02] border border-white/5 rounded-[3rem] shadow-2xl relative overflow-hidden group">
       <div className="absolute -inset-1 bg-blue-600/5 blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
       <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 border-4 border-[#020617] shadow-xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-700 haptic-click">
          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user.balance + 101}`} alt="Avatar" className="w-full h-full object-cover scale-110"/>
       </div>
       <div className="space-y-2 relative z-10">
          <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white drop-shadow-md">Node_Elite</h3>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-xl shadow-inner backdrop-blur-3xl">
             <ShieldCheck size={12} className="text-blue-500" />
             <span className="text-[9px] font-black uppercase tracking-[0.1em] text-blue-500">Tier-1 Cloud Operator</span>
          </div>
       </div>
    </div>
    
    <div className="bg-[#0b0f1a] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl border-t border-white/10">
       <div className="p-8 border-b border-white/5 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-4 text-slate-600 italic">
          <History size={20} className="text-blue-500"/> {t('history')}
       </div>
       <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto no-scrollbar">
          {user.transactions.length === 0 ? (
             <div className="p-24 text-center text-slate-800 text-[10px] font-black italic uppercase tracking-[0.5em] opacity-40">LEDGER SECURED - NO ACTIVITY</div>
          ) : user.transactions.map((tx: any) => (
             <div key={tx.id} className="p-8 flex justify-between items-center hover:bg-white/[0.02] transition-all duration-500 group">
                <div className="flex gap-6 items-center">
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${tx.type === 'deposit' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                      {tx.type === 'deposit' ? <ArrowDownCircle size={24}/> : <ArrowUpCircle size={24}/>}
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black text-white uppercase tracking-tighter italic">{t(tx.type)}</p>
                      <p className="text-[9px] text-slate-800 font-black uppercase tracking-[0.3em]">{new Date(tx.date).toLocaleDateString()}</p>
                   </div>
                </div>
                <div className="text-right space-y-1">
                   <p className={`text-xl font-black tracking-tighter ${tx.type === 'withdrawal' ? 'text-red-400' : 'text-emerald-400'}`}>{tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toFixed(2)}</p>
                   <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-900">{tx.status}</p>
                </div>
             </div>
          ))}
       </div>
    </div>
  </div>
);

export default App;
