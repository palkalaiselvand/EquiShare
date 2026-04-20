import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Check, PieChart, DollarSign, Users, Info, Paperclip } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../App';
import { Split } from '../types';
import { cn, formatCurrency } from '../lib/utils';

type SplitType = 'equal' | 'percentage' | 'manual';

export default function ExpenseForm({ groupId, members, onClose }: { groupId: string, members: string[], onClose: () => void }) {
  const { user } = useApp();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(members);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({}); // Stores percentages or manual amounts
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize custom splits when selected members change or split type changes
  useEffect(() => {
    if (splitType === 'equal') return;
    
    const newSplits: Record<string, string> = {};
    selectedMembers.forEach(m => {
      newSplits[m] = customSplits[m] || '';
    });
    setCustomSplits(newSplits);
  }, [selectedMembers, splitType]);

  const toggleMember = (email: string) => {
    setSelectedMembers(prev => 
      prev.includes(email) ? prev.filter(m => m !== email) : [...prev, email]
    );
  };

  const calculateFinalSplits = (): Split[] => {
    const totalAmount = parseFloat(amount) || 0;
    if (splitType === 'equal') {
      const splitVal = Math.floor((totalAmount / selectedMembers.length) * 100) / 100;
      return selectedMembers.map((email, idx) => {
        const isFirst = idx === 0;
        const remainder = totalAmount - (splitVal * selectedMembers.length);
        return { email, amount: isFirst ? splitVal + remainder : splitVal };
      });
    } else if (splitType === 'percentage') {
      return selectedMembers.map(email => ({
        email,
        amount: (totalAmount * (parseFloat(customSplits[email]) || 0)) / 100
      }));
    } else {
      return selectedMembers.map(email => ({
        email,
        amount: parseFloat(customSplits[email]) || 0
      }));
    }
  };

  const getValidationMessage = () => {
    const totalAmount = parseFloat(amount) || 0;
    if (!amount || totalAmount <= 0) return "Invalid amount";
    if (selectedMembers.length === 0) return "Select at least one participant";

    if (splitType === 'percentage') {
      const totalPercent = selectedMembers.reduce((sum, m) => sum + (parseFloat(customSplits[m]) || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) return `Percentages sum to ${totalPercent.toFixed(1)}% (must be 100%)`;
    }

    if (splitType === 'manual') {
      const totalSplit = selectedMembers.reduce((sum, m) => sum + (parseFloat(customSplits[m]) || 0), 0);
      if (Math.abs(totalSplit - totalAmount) > 0.01) return `Custom amounts sum to ${formatCurrency(totalSplit)} (must be ${formatCurrency(totalAmount)})`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getValidationMessage() || !user || isSubmitting) return;

    setIsSubmitting(true);
    const finalSplits = calculateFinalSplits();

    try {
      const payload: any = {
        description,
        amount: parseFloat(amount),
        paidBy: user.email,
        groupId,
        groupMembers: members,
        date: serverTimestamp(),
        splits: finalSplits,
        splitType,
      };

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      await addDoc(collection(db, 'groups', groupId, 'expenses'), payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const error = getValidationMessage();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Record Expense</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Financial Transaction Log</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">What was it for?</label>
              <input 
                autoFocus placeholder="Expense description..."
                className="w-full bg-slate-100 border-none px-4 py-3 rounded-xl text-sm font-semibold outline-none ring-2 ring-transparent focus:ring-accent/20 transition-all"
                value={description} onChange={e => setDescription(e.target.value)} required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Total Value ($)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                <input 
                  type="number" step="0.01" placeholder="0.00"
                  className="w-full bg-slate-100 border-none pl-8 pr-4 py-3 rounded-xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-accent/20 transition-all font-mono"
                  value={amount} onChange={e => setAmount(e.target.value)} required
                />
              </div>
            </div>
          </div>

          {/* Split Mode Logic */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Split Strategy</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button type="button" onClick={() => setSplitType('equal')} className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all", splitType === 'equal' ? "bg-white text-accent shadow-sm" : "text-slate-400 hover:text-slate-600")}>Equal</button>
                <button type="button" onClick={() => setSplitType('percentage')} className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all", splitType === 'percentage' ? "bg-white text-accent shadow-sm" : "text-slate-400 hover:text-slate-600")}>%</button>
                <button type="button" onClick={() => setSplitType('manual')} className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all", splitType === 'manual' ? "bg-white text-accent shadow-sm" : "text-slate-400 hover:text-slate-600")}>$</button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {members.map(member => {
                  const isSelected = selectedMembers.includes(member);
                  const isUser = member === user?.email;
                  return (
                    <div 
                      key={member}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all",
                        isSelected 
                          ? "bg-white border-accent shadow-sm" 
                          : "bg-transparent border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                      )}
                    >
                      <button type="button" onClick={() => toggleMember(member)} className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-colors", isSelected ? "bg-accent border-accent text-white" : "border-slate-300 hover:border-slate-400")}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-900 truncate">
                          {isUser ? 'Personal Position' : member.split('@')[0]}
                        </div>
                        {isSelected && splitType !== 'equal' && (
                          <div className="mt-1 flex items-center gap-2">
                             <input 
                              type="number"
                              placeholder={splitType === 'percentage' ? "0" : "0.00"}
                              className="w-full bg-slate-100 border-none px-2 py-1 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-accent/30"
                              value={customSplits[member] || ''}
                              onChange={e => setCustomSplits(prev => ({ ...prev, [member]: e.target.value }))}
                             />
                             <span className="text-[10px] font-bold text-slate-400">{splitType === 'percentage' ? '%' : '$'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes & Attachments */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 px-1">
               <Info className="w-3 h-3 text-slate-400" />
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata & Documentation</label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <textarea 
                    placeholder="Add contextual notes..."
                    rows={3}
                    className="w-full bg-slate-100 border-none px-4 py-3 rounded-xl text-xs font-medium outline-none ring-2 ring-transparent focus:ring-accent/20 transition-all resize-none"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 group hover:border-accent/40 transition-colors cursor-not-allowed opacity-60">
                    <Paperclip className="w-5 h-5 mb-1 group-hover:text-accent transition-colors" />
                    <span className="text-[10px] font-bold uppercase">Attach Receipt</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Footer Action */}
          <div className="pt-4 sticky bottom-0 bg-white">
            <div className="h-px bg-slate-100 mb-6" />
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                {error ? (
                  <div className="flex items-center gap-2 text-red-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{error}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-tight">Calculation Validated</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <button type="button" onClick={onClose} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Discard</button>
                <button 
                  type="submit"
                  disabled={!!error || isSubmitting || !description}
                  className="bg-brand text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-brand/10 hover:shadow-accent/20 hover:bg-accent disabled:opacity-20 transition-all flex items-center gap-2"
                >
                  {isSubmitting && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />}
                  Commit Transaction
                </button>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
