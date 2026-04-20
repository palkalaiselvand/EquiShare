import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ArrowLeft, 
  UserPlus,
  Trash2,
  CreditCard,
  Activity,
  Info
} from 'lucide-react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  updateDoc,
  arrayUnion,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../App';
import { Expense, Group } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import ExpenseForm from './ExpenseForm';

export default function GroupDetail({ groupId }: { groupId: string, key?: string }) {
  const { user, setActiveGroupId } = useApp();
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  useEffect(() => {
    const groupUnsub = onSnapshot(doc(db, 'groups', groupId), (d) => {
      if (d.exists()) setGroup({ id: d.id, ...d.data() } as Group);
    });

    const expensesQ = query(
      collection(db, 'groups', groupId, 'expenses'),
      where('groupMembers', 'array-contains', user?.email)
    );
    const expensesUnsub = onSnapshot(expensesQ, (snapshot) => {
      const expensesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      expensesData.sort((a, b) => {
        const timeA = a.date?.toDate?.()?.getTime() || 0;
        const timeB = b.date?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      setExpenses(expensesData);
    });

    return () => {
      groupUnsub();
      expensesUnsub();
    };
  }, [groupId]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !group) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        members: arrayUnion(newMemberEmail.toLowerCase().trim())
      });
      setNewMemberEmail('');
      setIsAddingMember(false);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
    } catch (err) {
      console.error(err);
    }
  };

  if (!group) return null;

  // Calculate Balances
  const memberBalances: Record<string, number> = {};
  group.members.forEach(m => memberBalances[m] = 0);

  expenses.forEach(exp => {
    memberBalances[exp.paidBy] += exp.amount;
    exp.splits.forEach(s => {
      memberBalances[s.email] -= s.amount;
    });
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-slate-50 overflow-hidden"
    >
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveGroupId(null)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{group.name}</h1>
            <p className="text-xs text-slate-500">{group.members.length} members • Active Session</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex -space-x-2 mr-2">
             {group.members.slice(0, 3).map((email, idx) => (
                <div 
                  key={email} 
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold uppercase",
                    idx === 1 ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {email.substring(0, 2)}
                </div>
             ))}
             {group.members.length > 3 && (
               <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                 +{group.members.length - 3}
               </div>
             )}
           </div>
           <button 
            onClick={() => setIsAddingMember(true)}
            className="p-2 text-slate-400 hover:text-brand transition-colors"
           >
             <UserPlus className="w-5 h-5" />
           </button>
           <button 
            onClick={() => setIsAddingExpense(true)}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-sm transition-all"
           >
             Add Expense
           </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard title="Total Group Spend" amount={expenses.reduce((acc, curr) => acc + curr.amount, 0)} />
              <SummaryCard title="You Paid" amount={expenses.filter(e => e.paidBy === user?.email).reduce((acc, curr) => acc + curr.amount, 0)} />
              <SummaryCard 
                title="You are Owed" 
                amount={Math.max(0, memberBalances[user?.email || ''] || 0)} 
                color="success" 
              />
            </div>

            {/* Expenses Activity */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Recent Activity</h3>
                <Activity className="w-4 h-4 text-slate-300" />
              </div>
              
              <div className="divide-y divide-slate-50 flex-1">
                {expenses.map((expense) => (
                  <div 
                    key={expense.id}
                    className="group px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                      {expense.amount > 100 ? '💰' : '🛒'}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                        {expense.description}
                        {expense.splitType !== 'equal' && (
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                            {expense.splitType}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                        Paid by {expense.paidBy === user?.email ? 'You' : expense.paidBy.split('@')[0]} • {format(expense.date?.toDate?.() || new Date(), 'MMM d, HH:mm')}
                      </div>
                      {expense.notes && (
                        <div className="text-[10px] text-slate-400 mt-1 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Info className="w-2.5 h-2.5 mt-0.5 text-slate-300" />
                          <span className="italic">{expense.notes}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-bold",
                        expense.paidBy === user?.email ? "text-indigo-600" : "text-slate-900"
                      )}>
                        {formatCurrency(expense.amount)}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                        {expense.paidBy === user?.email ? 'You paid' : 'Your share'}
                      </div>
                    </div>

                    <div className="pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {expense.paidBy === user?.email && (
                        <button 
                          onClick={() => deleteExpense(expense.id)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {expenses.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-300 font-bold">
                    <CreditCard className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-sm tracking-widest uppercase">No activity logged</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* Settlement Matrix */}
            <div className="bg-brand text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-6">Settlement Matrix</h3>
                <div className="space-y-4">
                  {group.members.map(email => {
                    const balance = memberBalances[email];
                    if (email === user?.email || Math.abs(balance) < 0.01) return null;
                    
                    return (
                      <div key={email} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold">
                            {email.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-200">{email.split('@')[0]}</span>
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
                          balance > 0 ? "text-red-400" : "text-emerald-400"
                        )}>
                          {balance > 0 ? '-' : '+'}{formatCurrency(Math.abs(balance))}
                        </span>
                      </div>
                    );
                  })}
                  {!group.members.some(m => m !== user?.email && Math.abs(memberBalances[m]) > 0.01) && (
                    <div className="py-4 text-center text-slate-500 italic text-xs">All accounts balanced.</div>
                  )}
                </div>
                <button className="w-full mt-8 py-3 bg-accent hover:bg-accent/80 rounded-xl text-xs font-bold transition-all shadow-lg shadow-accent/20">
                  Broadcast Reminders
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6">Spending insights</h3>
              <div className="space-y-6">
                 <DistributionItem label="Overall Utilization" value={expenses.length > 0 ? 100 : 0} color="accent" />
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">External Settlement Layer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingExpense && (
          <ExpenseForm groupId={groupId} members={group.members} onClose={() => setIsAddingExpense(false)} />
        )}

        {isAddingMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddingMember(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-1 tracking-tight">Expand Collective</h2>
              <p className="text-slate-500 text-sm mb-6 font-medium">Coordinate with a new participant.</p>
              
              <form onSubmit={addMember} className="space-y-4">
                <input 
                  autoFocus type="email" placeholder="email@precision.net"
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 font-medium"
                  value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} required
                />
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 bg-accent text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-accent/20">Add Member</button>
                  <button type="button" onClick={() => setIsAddingMember(false)} className="px-6 text-slate-500 font-bold text-sm">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SummaryCard({ title, amount, color }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{title}</div>
      <div className={cn(
        "text-2xl font-bold tracking-tight",
        color === 'success' ? "text-emerald-600" : "text-brand"
      )}>{formatCurrency(amount)}</div>
    </div>
  );
}

function DistributionItem({ label, value, color }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full bg-accent transition-all duration-1000")} style={{ width: `${value}%` }}></div>
      </div>
    </div>
  );
}
