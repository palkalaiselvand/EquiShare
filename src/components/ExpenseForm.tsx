import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../App';
import { Split } from '../types';
import { cn, formatCurrency } from '../lib/utils';

export default function ExpenseForm({ groupId, members, onClose }: { groupId: string, members: string[], onClose: () => void }) {
  const { user } = useApp();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleMember = (email: string) => {
    setSelectedMembers(prev => 
      prev.includes(email) ? prev.filter(m => m !== email) : [...prev, email]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !user || selectedMembers.length === 0) return;

    setIsSubmitting(true);
    const totalAmount = parseFloat(amount);
    
    // Calculate equal splits for selected members
    const splitAmount = Math.floor((totalAmount / selectedMembers.length) * 100) / 100;
    const splits: Split[] = selectedMembers.map((email, idx) => {
       const isFirst = idx === 0;
       const remainder = totalAmount - (splitAmount * selectedMembers.length);
       return {
         email,
         amount: isFirst ? splitAmount + remainder : splitAmount
       };
    });

    try {
      await addDoc(collection(db, 'groups', groupId, 'expenses'), {
        description,
        amount: totalAmount,
        paidBy: user.email,
        groupId,
        groupMembers: members,
        date: Timestamp.now(),
        splits
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">Add Expense</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
            <input 
              autoFocus
              placeholder="e.g. Dinner, Groceries"
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Amount ($)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
              <input 
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 pl-8 pr-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-accent/20 transition-all font-mono"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Participation</label>
             <div className="grid grid-cols-2 gap-2">
               {members.map(member => {
                 const isSelected = selectedMembers.includes(member);
                 return (
                   <button
                     key={member}
                     type="button"
                     onClick={() => toggleMember(member)}
                     className={cn(
                       "flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left truncate",
                       isSelected 
                        ? "bg-accent/5 border-accent text-accent" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                     )}
                   >
                     <span className="truncate">{member.split('@')[0]}</span>
                     {isSelected && <Check className="w-3 h-3" />}
                   </button>
                 )
               })}
             </div>
          </div>

          <div className="pt-4 space-y-3">
            <button 
              type="submit"
              disabled={isSubmitting || !description || !amount || selectedMembers.length === 0}
              className="w-full bg-accent text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-accent/20 disabled:opacity-50 hover:bg-accent/90 transition-all"
            >
              {isSubmitting ? 'Synchronizing...' : 'Log Expense'}
            </button>
            <p className="text-[10px] text-slate-400 text-center font-medium">Equal distribution across {selectedMembers.length} participants</p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
