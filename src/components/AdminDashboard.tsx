import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShoppingBag,
  CreditCard,
  Gift,
  Plus,
  CheckCircle,
  XCircle,
  Database,
  Cloud,
  FileCode,
  RefreshCw,
  Search,
  Filter,
  Package,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Upload,
  Coins,
  Send,
  Sparkles,
  KeyRound
} from 'lucide-react';

export default function AdminDashboard({ onCatalogUpdated }: { onCatalogUpdated?: () => void }) {
  const [activeTab, setActiveTab] = useState<'orders' | 'deposits' | 'products' | 'giftcodes' | 'cloudflare'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [giftCodes, setGiftCodes] = useState<any[]>([]);
  const [d1Stats, setD1Stats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // New Product Modal/Form state
  const [showNewProductModal, setShowNewProductModal] = useState<boolean>(false);
  const [productForm, setProductForm] = useState({
    title: '',
    category: 'apps',
    shortDescription: '',
    fullDescription: '',
    priceHndy: 2500,
    priceUsd: 6.99,
    developer: 'Hendy Verified Publisher',
    version: '1.0.0',
    downloadSize: '15.2 MB',
    iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200',
  });

  // Gift code generator state
  const [giftCodeForm, setGiftCodeForm] = useState({
    hndyValue: 2000,
    bonusXp: 100,
    maxRedemptions: 1,
    count: 1,
    batchId: 'ADMIN_PROMO_2026',
  });

  useEffect(() => {
    fetchAllAdminData();
  }, [activeTab]);

  const showToast = (text: string, error = false) => {
    setToastMsg({ text, error });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [ordersRes, depositsRes, productsRes, codesRes, d1Res] = await Promise.all([
        fetch('/api/store/orders').then((r) => r.json()),
        fetch('/api/store/deposits').then((r) => r.json()),
        fetch('/api/store/products').then((r) => r.json()),
        fetch('/api/store/gift-codes').then((r) => r.json()),
        fetch('/api/store/d1/stats').then((r) => r.json()),
      ]);

      if (ordersRes.success) setOrders(ordersRes.data || []);
      if (depositsRes.success) setDeposits(depositsRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (codesRes.success) setGiftCodes(codesRes.data || []);
      if (d1Res.success) setD1Stats(d1Res.data || null);
    } catch {
      showToast('Error loading administrative data', true);
    } finally {
      setLoading(false);
    }
  };

  // Order actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/store/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          notes: `Updated by Admin via Control Panel on ${new Date().toLocaleTimeString()}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Order ${orderId} marked as ${status}`);
        fetchAllAdminData();
      }
    } catch {
      showToast('Error updating order', true);
    }
  };

  // Deposit review actions
  const handleReviewDeposit = async (depositId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/store/deposits/${depositId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reviewer: 'Senior_Staff',
          notes: action === 'approve' ? 'Confirmed on blockchain explorer' : 'Invalid transaction hash',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Deposit ${depositId} ${action === 'approve' ? 'Approved & Credited' : 'Rejected'}`);
        fetchAllAdminData();
      }
    } catch {
      showToast('Failed to review deposit', true);
    }
  };

  // Package & Publish Product
  const handlePackageAndPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.title.trim()) {
      showToast('Product title is required', true);
      return;
    }

    try {
      // 1. Package to R2 simulation
      const r2Res = await fetch('/api/store/r2/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `${productForm.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${productForm.version}.zip`,
          sizeBytes: 15485760,
        }),
      });
      const r2Data = await r2Res.json();
      const r2Key = r2Data.data?.key || 'packages/app-bundle.zip';

      // 2. Publish product into Cloudflare D1 Catalog
      const prodRes = await fetch('/api/store/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          packageR2Key: r2Key,
          status: 'published',
        }),
      });
      const prodData = await prodRes.json();

      if (prodData.success) {
        showToast(`🚀 "${productForm.title}" packaged to R2 and published live!`);
        setShowNewProductModal(false);
        fetchAllAdminData();
        onCatalogUpdated?.();
      }
    } catch {
      showToast('Failed to package and publish product', true);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product from the catalog?')) return;
    try {
      const res = await fetch(`/api/store/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Product deleted from store');
        fetchAllAdminData();
        onCatalogUpdated?.();
      }
    } catch {
      showToast('Error deleting product', true);
    }
  };

  // Generate Gift Codes
  const handleGenerateGiftCodes = async () => {
    try {
      const res = await fetch('/api/store/gift-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(giftCodeForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Generated ${giftCodeForm.count} secure gift code(s)!`);
        fetchAllAdminData();
      }
    } catch {
      showToast('Failed to generate gift codes', true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
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

      {/* Admin Panel Header & Cloudflare Ecosystem Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white tracking-tight">Administrative Dashboard</h2>
            <span className="text-[10px] bg-amber-400/10 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-400/20">
              Cloudflare D1 + R2 + Pages
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Order processing queue, deposit approvals, digital catalog packaging, and cryptographic gift codes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllAdminData}
            disabled={loading}
            aria-label="Refresh admin data"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewProductModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Package & Publish App</span>
          </button>
        </div>
      </div>

      {/* Cloudflare D1/R2 Quick Stat Ribbon */}
      {d1Stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">D1 Database</span>
            <span className="text-sm font-black text-cyan-400">{d1Stats.database}</span>
            <span className="text-[10px] text-slate-500 block">Binding: {d1Stats.binding}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Orders in Queue</span>
            <span className="text-sm font-black text-white">{d1Stats.tables?.orders || 0}</span>
            <span className="text-[10px] text-emerald-400 block">Instant Fulfillment</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Pending Deposits</span>
            <span className="text-sm font-black text-amber-400">
              {deposits.filter((d) => d.status === 'pending').length}
            </span>
            <span className="text-[10px] text-slate-500 block">Total: {d1Stats.tables?.deposits || 0}</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Store Catalog</span>
            <span className="text-sm font-black text-white">{d1Stats.tables?.products || 0} Products</span>
            <span className="text-[10px] text-cyan-400 block">Live on Storefront</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">R2 Asset Bucket</span>
            <span className="text-sm font-black text-purple-400">{d1Stats.r2Bucket}</span>
            <span className="text-[10px] text-slate-500 block">Zero-Egress Object Storage</span>
          </div>
        </div>
      )}

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'orders', label: 'Order Queues', count: orders.length },
          { id: 'deposits', label: 'Deposit Approvals', count: deposits.filter((d) => d.status === 'pending').length },
          { id: 'products', label: 'Product Catalog', count: products.length },
          { id: 'giftcodes', label: 'Gift Code Generator', count: giftCodes.length },
          { id: 'cloudflare', label: 'Cloudflare D1 & R2 Specs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ================= TAB 1: ORDER QUEUES ================= */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Customer Purchase & Fulfillment Queue
            </h3>
            <span className="text-xs text-slate-400">{orders.length} orders total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer ID</th>
                  <th className="p-3">Product Title</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Issued Voucher / Key</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-400">{o.id}</td>
                    <td className="p-3 font-mono text-slate-400">{o.userId}</td>
                    <td className="p-3 font-semibold text-white">{o.productTitle}</td>
                    <td className="p-3 font-mono font-bold text-amber-300">{o.totalHndy.toLocaleString()} $HNDY</td>
                    <td className="p-3 font-mono text-xs">
                      {o.issuedCode ? (
                        <span className="text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {o.issuedCode}
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        o.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : o.status === 'refunded'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {o.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                        >
                          Fulfill
                        </button>
                      )}
                      {o.status === 'completed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(o.id, 'refunded')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: DEPOSIT APPROVALS ================= */}
      {activeTab === 'deposits' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Cryptocurrency & Fiat Deposit Queue
            </h3>
            <span className="text-xs text-slate-400">
              {deposits.filter((d) => d.status === 'pending').length} Pending Reviews
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Deposit ID</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Credited $HNDY</th>
                  <th className="p-3">Transaction Hash</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {deposits.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-400">{d.id}</td>
                    <td className="p-3 font-mono text-slate-400">{d.userId}</td>
                    <td className="p-3 font-bold text-white">
                      {d.amount} {d.currency}
                    </td>
                    <td className="p-3 font-mono font-bold text-amber-300">
                      +{d.creditedHndy.toLocaleString()} $HNDY
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                      {d.txHash}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        d.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : d.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {d.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleReviewDeposit(d.id, 'approve')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewDeposit(d.id, 'reject')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: PRODUCT CATALOG ================= */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Digital Catalog Items (Play Store & App Store format)
            </h3>
            <button
              onClick={() => setShowNewProductModal(true)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add & Package Product</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={p.iconUrl}
                    alt={p.title}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      {p.category} • {p.version}
                    </span>
                    <h4 className="text-xs font-bold text-white">{p.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{p.shortDescription}</p>
                    <div className="text-[11px] font-mono text-amber-300 font-bold mt-1">
                      {p.priceHndy.toLocaleString()} $HNDY (${p.priceUsd} USD)
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    R2: {p.packageR2Key}
                  </span>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    aria-label={`Delete ${p.title}`}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: GIFT CODE GENERATOR ================= */}
      {activeTab === 'giftcodes' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-white">
                Cryptographic Gift Code Issuer (SHA-256 Verified)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Value ($HNDY)</label>
                <input
                  type="number"
                  value={giftCodeForm.hndyValue}
                  onChange={(e) => setGiftCodeForm({ ...giftCodeForm, hndyValue: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Bonus XP</label>
                <input
                  type="number"
                  value={giftCodeForm.bonusXp}
                  onChange={(e) => setGiftCodeForm({ ...giftCodeForm, bonusXp: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Batch Count</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={giftCodeForm.count}
                  onChange={(e) => setGiftCodeForm({ ...giftCodeForm, count: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Campaign Tag</label>
                <input
                  type="text"
                  value={giftCodeForm.batchId}
                  onChange={(e) => setGiftCodeForm({ ...giftCodeForm, batchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateGiftCodes}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2"
            >
              <Gift className="w-4 h-4" />
              <span>Issue {giftCodeForm.count} Gift Code(s)</span>
            </button>
          </div>

          {/* List of Issued Gift Codes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Issued Gift Codes ({giftCodes.length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {giftCodes.map((code) => (
                <div
                  key={code.code}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <code className="text-xs font-mono font-bold text-amber-300 block">{code.code}</code>
                    <span className="text-[10px] text-slate-400">
                      Value: +{code.hndyValue.toLocaleString()} $HNDY • Redemptions: {code.redeemedCount}/{code.maxRedemptions}
                    </span>
                    <span className="text-[9px] font-mono text-slate-600 block truncate max-w-xs">
                      Hash: {code.codeHash}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      code.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {code.status}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(code.code);
                        showToast(`Copied ${code.code}`);
                      }}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: CLOUDFLARE SPECS ================= */}
      {activeTab === 'cloudflare' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Cloudflare D1 + R2 + Pages Infrastructure</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-cyan-400 block flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Cloudflare D1 SQL Database
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Relational SQLite engine running at Cloudflare edge with zero server maintenance.
              </p>
              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                <div>Binding: <code>DB</code></div>
                <div>Schema File: <code>/d1/schema.sql</code></div>
                <div>Tables: <code>users, products, orders, deposits, gift_codes</code></div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-purple-400 block flex items-center gap-1.5">
                <Package className="w-4 h-4" /> Cloudflare R2 Object Storage
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                High-performance S3-compatible asset and application bundle distribution without egress fees.
              </p>
              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                <div>Binding: <code>ASSETS_BUCKET</code></div>
                <div>Bucket: <code>hendy-store-assets</code></div>
                <div>Packages: <code>/packages/*.zip, /proofs/*.png</code></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package & Publish Modal */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                Package Digital Bundle & Publish to App Store
              </h3>
              <button
                onClick={() => setShowNewProductModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePackageAndPublish} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. Telegram Channel Auto-Poster AI"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="apps">Apps & Bots</option>
                    <option value="gaming">Gaming & Mining</option>
                    <option value="subscriptions">Subscriptions</option>
                    <option value="ai_tools">AI & Developer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Price ($HNDY)</label>
                  <input
                    type="number"
                    value={productForm.priceHndy}
                    onChange={(e) => setProductForm({ ...productForm, priceHndy: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Short Description</label>
                <input
                  type="text"
                  value={productForm.shortDescription}
                  onChange={(e) => setProductForm({ ...productForm, shortDescription: e.target.value })}
                  placeholder="Appears on store cards..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Version</label>
                  <input
                    type="text"
                    value={productForm.version}
                    onChange={(e) => setProductForm({ ...productForm, version: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Package Size</label>
                  <input
                    type="text"
                    value={productForm.downloadSize}
                    onChange={(e) => setProductForm({ ...productForm, downloadSize: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProductModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Package to R2 & Publish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
