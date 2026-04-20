import { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  orderBy
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  Plus, 
  ArrowRight, 
  LogOut, 
  Search,
  Activity,
  Settings
} from 'lucide-react';
import { auth, db, googleProvider, testConnection } from './lib/firebase';
import { cn } from './lib/utils';
import { Group, User } from './types';
import Dashboard from './components/Dashboard';
import GroupDetail from './components/GroupDetail';

// Context for App State
const AppContext = createContext<{
  user: User | null;
  groups: Group[];
  loading: boolean;
  activeGroupId: string | null;
  totalBalances: { overall: number, owedToYou: number, youOwe: number };
  setActiveGroupId: (id: string | null) => void;
  signIn: () => void;
  logout: () => void;
} | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [totalBalances, setTotalBalances] = useState({ overall: 0, owedToYou: 0, youOwe: 0 });

  useEffect(() => {
    if (!userProfile || groups.length === 0) {
      setTotalBalances({ overall: 0, owedToYou: 0, youOwe: 0 });
      return;
    }

    // This is a simple implementation: fetch all expenses for all groups
    // In a production app, we might use a more efficient denormalization or collection group query
    const unsubscibers: (() => void)[] = [];
    const groupBalances: Record<string, { overall: number, owedToYou: number, youOwe: number }> = {};

    groups.forEach(group => {
      const q = query(
        collection(db, 'groups', group.id, 'expenses'),
        where('groupMembers', 'array-contains', userProfile.email)
      );
      const unsub = onSnapshot(q, (snapshot) => {
        let groupOwed = 0;
        let groupYouOwe = 0;

        snapshot.docs.forEach(doc => {
          const expense = doc.data();
          const userSplit = expense.splits?.find((s: any) => s.email === userProfile.email);
          
          if (expense.paidBy === userProfile.email) {
            // You paid. Others owe you the sum of their splits (excluding yours)
            const othersOwe = (expense.amount || 0) - (userSplit?.amount || 0);
            groupOwed += othersOwe;
          } else if (userSplit) {
            // Someone else paid. You owe your split amount
            groupYouOwe += (userSplit.amount || 0);
          }
        });

        groupBalances[group.id] = {
          overall: groupOwed - groupYouOwe,
          owedToYou: groupOwed,
          youOwe: groupYouOwe
        };

        // Combine results
        const totals = Object.values(groupBalances).reduce((acc, curr) => ({
          overall: acc.overall + curr.overall,
          owedToYou: acc.owedToYou + curr.owedToYou,
          youOwe: acc.youOwe + curr.youOwe
        }), { overall: 0, owedToYou: 0, youOwe: 0 });

        setTotalBalances(totals);
      });
      unsubscibers.push(unsub);
    });

    return () => unsubscibers.forEach(u => u());
  }, [groups, userProfile]);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.email) {
        // Sync user profile
        const profile: User = {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          avatarUrl: user.photoURL || `https://picsum.photos/seed/${user.email}/200`
        };
        await setDoc(doc(db, 'users', user.email), profile, { merge: true });
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userProfile) {
      setGroups([]);
      return;
    }

    const q = query(
      collection(db, 'groups'),
      where('members', 'array-contains', userProfile.email)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      // Sort client-side to avoid index requirements
      groupsData.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      setGroups(groupsData);
    });

    return unsub;
  }, [userProfile]);

  const signIn = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-muted">
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="font-bold text-2xl text-accent tracking-tighter"
        >
          DIVVY
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-screen w-screen grid grid-cols-1 md:grid-cols-2 bg-muted overflow-hidden">
        <div className="p-12 md:p-24 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
              <div className="w-5 h-5 border-2 border-white rotate-45" />
            </div>
            <span className="font-bold text-2xl tracking-tighter text-brand">DIVVY</span>
          </div>
          
          <div className="space-y-8 max-w-md">
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight text-brand">
              Professional Expense Sharing.
            </h1>
            <p className="text-slate-500 text-lg">
              Manage shared costs with precision. Real-time settlements for teams, trips, and collectives.
            </p>
            <button 
              onClick={signIn}
              className="w-full flex items-center justify-center gap-3 bg-accent text-white py-4 rounded-xl font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
            >
              Continue with Google
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="hidden md:block relative bg-brand overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/finance/1920/1080?grayscale')] bg-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="relative">
               <div className="w-64 h-64 border-2 border-white/10 rounded-full animate-pulse" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-32 h-32 bg-white/5 rounded-3xl backdrop-blur-xl border border-white/20" />
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  const contextValue = {
    user: userProfile,
    groups,
    loading,
    activeGroupId,
    totalBalances,
    setActiveGroupId,
    signIn,
    logout
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-muted overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-50">
          <div className="p-6 flex items-center gap-3 border-b border-slate-50">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center cursor-pointer" onClick={() => setActiveGroupId(null)}>
              <div className="w-4 h-4 border-2 border-white rotate-45" />
            </div>
            <span className="font-bold text-xl tracking-tight text-brand">DIVVY</span>
          </div>

          <div className="px-4 py-6 flex-1 space-y-1 overflow-y-auto">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-4">Navigation</div>
            <SidebarItem icon={LayoutGrid} label="Dashboard" active={!activeGroupId} onClick={() => setActiveGroupId(null)} />
            <SidebarItem icon={Activity} label="Activity" />
            <SidebarItem icon={Search} label="Search" />
            
            <div className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-4">Groups</div>
            <div className="space-y-1">
              {groups.map(g => (
                <button 
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeGroupId === g.id ? "bg-accent/5 text-accent" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", activeGroupId === g.id ? "bg-accent" : "bg-slate-300")} />
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-4">Account</div>
            <div className="px-3 py-2 flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Authorized As</span>
              <span className="text-sm font-semibold truncate text-brand">{userProfile?.email}</span>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 space-y-2">
            <button 
              onClick={logout}
              className="w-full py-2.5 bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {!activeGroupId ? (
              <Dashboard key="dashboard" />
            ) : (
              <GroupDetail key={activeGroupId} groupId={activeGroupId} />
            )}
          </AnimatePresence>
        </main>
      </div>
    </AppContext.Provider>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
        active ? "bg-accent text-white shadow-md shadow-accent/20" : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-white" : "text-slate-400 group-hover:text-brand")} />
      {label}
    </button>
  );
}
