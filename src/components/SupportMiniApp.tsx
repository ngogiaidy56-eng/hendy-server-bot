import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Search,
  User,
  History,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  KeyRound,
  Coins,
  RefreshCw,
  Send,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

export default function SupportMiniApp({ initialUserId = '777888999' }: { initialUserId?: string }) {
  const [searchUserId, setSearchUserId] = useState<string>(initialUserId);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Gemini AI Resolution Assistant state
  const [issueDescription, setIssueDescription] = useState<string>('Khách hàng báo chưa nhận được license key cho đơn hàng Hendy Bot VIP');
  const [aiResolution, setAiResolution] = useState<string>('');
  const [isAiResolving, setIsAiResolving] = useState<boolean>(false);

  useEffect(() => {
    fetchCustomerTimeline(searchUserId);
  }, []);

  const showToast = (text: string, error = false) => {
    setToastMsg({ text, error });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchCustomerTimeline = async (id: any) => {
    const cleanId = String(id || '').trim();
    if (!cleanId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/store/support/user/${cleanId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTimelineData(data.data);
      } else {
        showToast(data.error?.message || 'Customer not found', true);
      }
    } catch {
      showToast('Error loading customer support timeline', true);
    } finally {
      setLoading(false);
    }
  };

  const handleAiResolutionAssist = async () => {
    if (!issueDescription.trim() || isAiResolving) return;
    setIsAiResolving(true);
    try {
      const res = await fetch('/api/store/support/ai-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: searchUserId,
          issueDescription,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.resolution) {
        setAiResolution(data.data.resolution);
        showToast('Generated AI resolution recommendation!');
      } else {
        showToast('Could not generate AI resolution', true);
      }
    } catch {
      showToast('AI assistance error', true);
    } finally {
      setIsAiResolving(false);
    }
  };

  const handleGrantBonusCoins = async (amount = 1000) => {
    try {
      const res = await fetch(`/api/user/${searchUserId}/tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taps: amount / 2 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Granted +${amount} $HNDY support compensation!`);
        fetchCustomerTimeline(searchUserId);
      }
    } catch {
      showToast('Error granting compensation', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
            toastMsg.error ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Support Mini App Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 font-bold border border-purple-500/30">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Customer Support Mini App</h2>
              <span className="text-[10px] bg-purple-500/10 text-purple-400 font-bold px-2 py-0.5 rounded border border-purple-500/20">
                Staff Only
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time user transaction histories, order fulfillment inspection & Gemini resolution engine
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              placeholder="Search Telegram ID..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => fetchCustomerTimeline(searchUserId)}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Search</span>
          </button>
        </div>
      </div>

      {timelineData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Profile & Fast Action Widget */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg">
                  {timelineData.user?.firstName?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {timelineData.user?.firstName} {timelineData.user?.lastName || ''}
                  </h3>
                  <span className="text-xs text-slate-400">@{timelineData.user?.username}</span>
                  <div className="text-[10px] font-mono text-purple-400">ID: {timelineData.user?.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Current Balance</span>
                  <span className="text-sm font-black text-amber-300">
                    {timelineData.user?.coins?.toLocaleString()} $HNDY
                  </span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Streak & Level</span>
                  <span className="text-sm font-black text-white">
                    Lvl {timelineData.user?.level} ({timelineData.user?.streak}d)
                  </span>
                </div>
              </div>

              {/* Fast Action Tools */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Staff Compensation Actions
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleGrantBonusCoins(1000)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>+1,000 $HNDY</span>
                  </button>
                  <button
                    onClick={() => handleGrantBonusCoins(2500)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>+2,500 $HNDY</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Gemini AI Dispute Resolution Assistant */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white">Gemini 3.8 Flash Dispute Advisor</h4>
              </div>
              <p className="text-[11px] text-slate-400">
                Analyzes customer transactions and drafts polite resolution steps.
              </p>

              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                rows={3}
                placeholder="Enter customer inquiry or complaint..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={handleAiResolutionAssist}
                disabled={isAiResolving}
                className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiResolving ? 'animate-spin' : ''}`} />
                <span>{isAiResolving ? 'Analyzing with Gemini...' : 'Analyze & Draft Solution'}</span>
              </button>

              {aiResolution && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {aiResolution}
                </div>
              )}
            </div>
          </div>

          {/* Transaction & Order Timeline Feed */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  Chronological Transaction & Order History
                </h3>
                <span className="text-xs text-slate-400">
                  {timelineData.timeline?.length || 0} events recorded in Cloudflare D1
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Orders: <b className="text-white">{timelineData.stats?.totalOrders}</b></span>
                <span>•</span>
                <span>Deposits: <b className="text-white">{timelineData.stats?.totalDeposits}</b></span>
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {timelineData.timeline?.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  No transaction history recorded for this customer.
                </div>
              ) : (
                timelineData.timeline.map((event: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl text-xs font-bold ${
                        event.type === 'ORDER'
                          ? 'bg-blue-500/20 text-blue-400'
                          : event.type === 'DEPOSIT'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {event.type === 'ORDER' ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : event.type === 'DEPOSIT' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <KeyRound className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{event.title}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            event.status === 'completed' || event.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {event.status}
                          </span>
                        </div>

                        {event.details?.issuedCode && (
                          <div className="text-[11px] font-mono text-amber-300">
                            License Key: <b>{event.details.issuedCode}</b>
                          </div>
                        )}

                        {event.details?.txHash && (
                          <div className="text-[10px] font-mono text-slate-500 truncate max-w-sm">
                            TXID: {event.details.txHash}
                          </div>
                        )}

                        <span className="text-[10px] text-slate-500 block">
                          {new Date(event.date).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-black font-mono ${
                        event.amount?.startsWith('+') ? 'text-emerald-400' : 'text-amber-300'
                      }`}>
                        {event.amount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <User className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">Search for a customer Telegram ID above to inspect their timeline.</p>
        </div>
      )}
    </div>
  );
}
