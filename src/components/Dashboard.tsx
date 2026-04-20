import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Users, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../App';
import { cn, formatCurrency } from '../lib/utils';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Dashboard({ key }: { key?: string }) {
  const { groups, user, setActiveGroupId } = useApp();
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        members: [user.email],
        createdBy: user.email,
        createdAt: Timestamp.now(),
      });
      setNewGroupName('');
      setIsCreating(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-slate-50 overflow-hidden"
    >
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workspace Overview</h1>
          <p className="text-xs text-slate-500">Aggregate Financial Standing</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard title="Overall Balance" amount={0} />
              <StatCard title="Owed to you" amount={0} color="success" />
              <StatCard title="You Owe" amount={0} color="red" />
            </div>

            {/* Groups Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Active Groups</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{groups.length} Total</span>
              </div>
              
              <div className="divide-y divide-slate-50">
                {groups.map((group) => (
                  <button 
                    key={group.id}
                    onClick={() => setActiveGroupId(group.id)}
                    className="w-full px-6 py-5 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl">📁</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{group.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{group.members.length} participants</div>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                      Open <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}

                {isCreating && (
                  <div className="px-6 py-5 bg-indigo-50/30">
                    <form onSubmit={createGroup} className="flex gap-4 items-center">
                       <input 
                        autoFocus
                        placeholder="Enter group name..."
                        className="flex-1 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent/20"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                       />
                       <button type="submit" className="bg-accent text-white px-4 py-2 rounded-lg text-xs font-bold">Create</button>
                       <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 text-xs font-bold">Cancel</button>
                    </form>
                  </div>
                )}

                {groups.length === 0 && !isCreating && (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">No active groups in your workspace.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div className="bg-brand text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Financial Pulse</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Net Standing</span>
                    <span className="text-sm font-bold">$0.00</span>
                  </div>
                </div>
                <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all backdrop-blur-sm border border-white/10">
                  Global Report
                </button>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-accent/20 rounded-full blur-2xl"></div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Spending insights</h3>
              <p className="text-slate-400 text-xs italic">Aggregate insights will appear as you log activity.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, amount, color }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</div>
      <div className={cn(
        "text-2xl font-bold tracking-tight",
        color === 'success' ? "text-emerald-600" : color === 'red' ? "text-red-500" : "text-brand"
      )}>
        {formatCurrency(amount)}
      </div>
    </div>
  );
}
