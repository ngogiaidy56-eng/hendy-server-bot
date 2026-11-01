/**
 * Hendy Ecosystem Root Application
 * Integrates:
 * 1. Web-based User Interface (Google Play / Apple App Store style)
 * 2. Administrative Dashboard (Cloudflare D1 + R2 + Order Queue + Deposits + Gift Codes)
 * 3. Customer Support "Mini App" (Transaction histories, order logs & Gemini AI resolution)
 * 4. Telegram Mini App (TMA) & Bot Simulator
 */

import React, { useState, useEffect } from 'react';
import AppStorefront from './components/AppStorefront.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import SupportMiniApp from './components/SupportMiniApp.tsx';
import MiniApp from '../mini-app/src/App.jsx';
import {
  ShoppingBag,
  SlidersHorizontal,
  Headphones,
  Smartphone,
  Coins,
  Zap,
  Gift,
  Server,
  Cloud,
  Database,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';

export default function App() {
  const [activeModule, setActiveModule] = useState<'store' | 'admin' | 'support' | 'telegram'>('store');
  const [currentUser, setCurrentUser] = useState<any>({
    id: '777888999',
    firstName: 'Alex Hendy',
    username: 'alex_hendy_vip',
    coins: 5250,
    level: 3,
    streak: 2,
  });

  // Deposit modal state
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [depositCurrency, setDepositCurrency] = useState<'TON' | 'USDT' | 'FIAT_VND'>('TON');
  const [depositAmount, setDepositAmount] = useState<number>(5.0);
  const [depositTxHash, setDepositTxHash] = useState<string>('');

  // Gift Code redeem modal state
  const [showGiftModal, setShowGiftModal] = useState<boolean>(false);
  const [giftCodeInput, setGiftCodeInput] = useState<string>('HNDY-WELCOME-2026-GIFT');
  const [isRedeeming, setIsRedeeming] = useState<boolean>(false);

  // Notifications
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const showToast = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/user/${currentUser.id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUser(data.data);
      }
    } catch {
      // Fallback
    }
  };

  // Submit deposit
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/store/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          currency: depositCurrency,
          amount: depositAmount,
          txHash: depositTxHash || `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Deposit submitted! Admin will verify and credit your balance.`);
        setShowDepositModal(false);
      } else {
        showToast(data.error?.message || 'Deposit submission failed', true);
      }
    } catch {
      showToast('Error submitting deposit', true);
    }
  };

  // Redeem gift code
  const handleRedeemGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCodeInput.trim()) return;

    setIsRedeeming(true);
    try {
      const res = await fetch('/api/store/gift-codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: giftCodeInput.trim(),
          userId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        showToast(`🎉 Redeemed! +${data.data.creditedHndy.toLocaleString()} $HNDY added to your wallet!`);
        setShowGiftModal(false);
        fetchUserData();
      } else {
        showToast(data.error?.message || 'Gift code could not be redeemed', true);
      }
    } catch (err: any) {
      showToast(err.message || 'Redemption error', true);
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
            toast.error ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Global Top Ecosystem Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Ecosystem tag */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-black text-slate-950 text-base">
                H
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm text-white tracking-tight">Hendy Ecosystem</h1>
                  <span className="text-[10px] bg-amber-400/10 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-400/20">
                    D1 + R2 + Pages
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Digital App Store, Admin Panel & Support Mini App</p>
              </div>
            </div>

            {/* User balance chip for mobile */}
            <div className="flex items-center gap-1.5 md:hidden bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-white">{currentUser?.coins?.toLocaleString() || 0}</span>
            </div>
          </div>

          {/* Module Switcher Buttons */}
          <nav className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveModule('store')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeModule === 'store'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>App Store</span>
            </button>

            <button
              onClick={() => setActiveModule('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeModule === 'admin'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>

            <button
              onClick={() => setActiveModule('support')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeModule === 'support'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Support Mini App</span>
            </button>

            <button
              onClick={() => setActiveModule('telegram')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeModule === 'telegram'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Telegram TMA</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Application Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeModule === 'store' && (
          <AppStorefront
            currentUser={currentUser}
            onRefreshUser={fetchUserData}
            onOpenDepositModal={() => setShowDepositModal(true)}
            onOpenGiftCodeModal={() => setShowGiftModal(true)}
          />
        )}

        {activeModule === 'admin' && (
          <AdminDashboard onCatalogUpdated={fetchUserData} />
        )}

        {activeModule === 'support' && (
          <SupportMiniApp initialUserId={currentUser.id} />
        )}

        {activeModule === 'telegram' && (
          <div className="flex flex-col items-center justify-center py-4">
            <div className="w-full max-w-sm">
              <div className="bg-slate-900 rounded-[38px] p-2.5 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/50">
                <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="font-semibold text-slate-300">Telegram WebApp (TMA)</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px]">
                    <span>HendyBot</span>
                    <span className="text-slate-500">• • •</span>
                  </div>
                </div>

                <div className="rounded-[28px] overflow-hidden bg-slate-950 border border-slate-800/60 h-[700px] flex flex-col">
                  <MiniApp />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Deposit Funds */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Deposit Crypto or Fiat</h3>
              </div>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitDeposit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Payment Asset</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['TON', 'USDT', 'FIAT_VND'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setDepositCurrency(curr)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        depositCurrency === curr
                          ? 'bg-cyan-600 text-white border-cyan-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {curr === 'FIAT_VND' ? 'VND' : curr}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Deposit Amount ({depositCurrency})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Conversion Rate:</span>
                  <span className="font-mono text-cyan-400">
                    1 {depositCurrency} = {depositCurrency === 'TON' ? '1,000' : depositCurrency === 'USDT' ? '500' : '0.1'} $HNDY
                  </span>
                </div>
                <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800/80">
                  <span>You will receive:</span>
                  <span className="text-amber-300 font-mono">
                    +{(depositAmount * (depositCurrency === 'TON' ? 1000 : depositCurrency === 'USDT' ? 500 : 0.1)).toLocaleString()} $HNDY
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Blockchain Hash / Transaction ID (Optional)
                </label>
                <input
                  type="text"
                  value={depositTxHash}
                  onChange={(e) => setDepositTxHash(e.target.value)}
                  placeholder="0x... (auto-generated if empty)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                >
                  Submit Deposit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redeem Gift Code */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Redeem Digital Gift Code</h3>
              </div>
              <button
                onClick={() => setShowGiftModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRedeemGiftCode} className="space-y-4">
              <p className="text-xs text-slate-400">
                Enter your cryptographic voucher code to instantly top up your $HNDY balance.
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Gift Code</label>
                <input
                  type="text"
                  required
                  value={giftCodeInput}
                  onChange={(e) => setGiftCodeInput(e.target.value.toUpperCase())}
                  placeholder="HNDY-XXXX-XXXX-XXXX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono uppercase tracking-wider text-center focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2">
                {['HNDY-WELCOME-2026-GIFT', 'HNDY-VIP7-MINER-BONUS'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setGiftCodeInput(sample)}
                    className="text-[10px] font-mono bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-lg truncate flex-1"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGiftModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRedeeming || !giftCodeInput.trim()}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-md"
                >
                  {isRedeeming ? 'Redeeming...' : 'Redeem Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer System Status Bar */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-4 py-3 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Cloudflare D1: <code>hendy_production_db</code>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              Cloudflare R2: <code>hendy-store-assets</code>
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gemini AI: <code>gemini-3.8-flash</code>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            wrangler.toml • Cloudflare Pages / Workers
          </span>
        </div>
      </footer>
    </div>
  );
}
