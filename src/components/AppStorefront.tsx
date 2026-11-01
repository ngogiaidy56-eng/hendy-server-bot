import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  Download,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  Zap,
  CheckCircle,
  Coins,
  Tag,
  Gift,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Package,
  Layers,
  Check
} from 'lucide-react';

interface Product {
  id: string;
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  iconUrl: string;
  bannerUrl: string;
  rating: number;
  reviewsCount: number;
  priceHndy: number;
  priceUsd: number;
  downloadSize: string;
  developer: string;
  version: string;
  status: string;
  packageR2Key: string;
  features?: string[];
}

interface AppStorefrontProps {
  currentUser: any;
  onRefreshUser: () => void;
  onOpenDepositModal: () => void;
  onOpenGiftCodeModal: () => void;
}

export default function AppStorefront({
  currentUser,
  onRefreshUser,
  onOpenDepositModal,
  onOpenGiftCodeModal,
}: AppStorefrontProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ order: any } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'store' | 'library'>('store');

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'apps', label: 'Bots & Apps' },
    { id: 'gaming', label: 'Gaming & Mining' },
    { id: 'subscriptions', label: 'Subscriptions' },
    { id: 'ai_tools', label: 'AI & Developer' },
  ];

  useEffect(() => {
    fetchProducts();
    fetchUserPurchases();
  }, [selectedCategory]);

  const showToast = (text: string, error = false) => {
    setToastMsg({ text, error });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchProducts = async () => {
    try {
      const url = selectedCategory === 'all'
        ? '/api/store/products'
        : `/api/store/products?category=${selectedCategory}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setProducts(data.data);
      }
    } catch {
      // Offline fallback
    }
  };

  const fetchUserPurchases = async () => {
    try {
      const res = await fetch('/api/store/orders');
      const data = await res.json();
      if (data.success && data.data) {
        const userOrders = data.data.filter((o: any) => String(o.userId) === String(currentUser.id));
        setMyPurchases(userOrders);
      }
    } catch {
      // Fallback
    }
  };

  const handleBuyProduct = async (product: Product) => {
    if (currentUser.coins < product.priceHndy) {
      showToast(`Insufficient balance! You need ${product.priceHndy.toLocaleString()} $HNDY.`, true);
      return;
    }

    setIsPurchasing(true);
    try {
      const res = await fetch('/api/store/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          productId: product.id,
        }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        setPurchaseSuccess(data.data);
        onRefreshUser();
        fetchUserPurchases();
        showToast(`🎉 Purchased "${product.title}" successfully!`);
      } else {
        showToast(data.error?.message || 'Purchase could not be completed', true);
      }
    } catch (err: any) {
      showToast(err.message || 'Network error during purchase', true);
    } finally {
      setIsPurchasing(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.shortDescription.toLowerCase().includes(q) ||
      p.developer.toLowerCase().includes(q)
    );
  });

  const featuredProduct = products[0];

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

      {/* Sub-header Store Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 font-black">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">Hendy App Store</h2>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-semibold px-2 py-0.5 rounded-md border border-cyan-500/20">
                Cloudflare Pages Edition
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Discover verified Telegram bots, gaming boosters, and digital licenses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* User Balance pill */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-right">
              <div className="text-xs font-bold text-white leading-none">
                {currentUser?.coins?.toLocaleString() || 0}
              </div>
              <span className="text-[9px] text-cyan-400 font-semibold">$HNDY</span>
            </div>
          </div>

          <button
            onClick={onOpenDepositModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Deposit</span>
          </button>

          <button
            onClick={onOpenGiftCodeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700/80 transition-all"
          >
            <Gift className="w-3.5 h-3.5 text-purple-400" />
            <span>Redeem</span>
          </button>

          <button
            onClick={() => setActiveView(activeView === 'store' ? 'library' : 'store')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              activeView === 'library'
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {activeView === 'store' ? `My Library (${myPurchases.length})` : 'Storefront'}
          </button>
        </div>
      </div>

      {activeView === 'library' ? (
        /* ================= USER LIBRARY VIEW ================= */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                My Purchased Apps & Digital Licenses
              </h3>
              <p className="text-xs text-slate-400">
                Your instant digital gift codes, license keys, and packaged bundles
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {myPurchases.length} Items Purchased
            </span>
          </div>

          {myPurchases.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">You haven't purchased any items yet.</p>
              <button
                onClick={() => setActiveView('store')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl"
              >
                Browse Store Catalog
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myPurchases.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400">{order.id}</span>
                      <h4 className="text-sm font-bold text-white">{order.productTitle}</h4>
                      <span className="text-[11px] text-slate-400">
                        Paid: {order.totalHndy?.toLocaleString()} $HNDY • {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {order.status.toUpperCase()}
                    </span>
                  </div>

                  {order.issuedCode && (
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-mono">
                          License / Voucher Key
                        </span>
                        <code className="text-xs font-mono font-bold text-amber-300">
                          {order.issuedCode}
                        </code>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(order.issuedCode);
                          showToast('Copied license key to clipboard!');
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold"
                      >
                        Copy
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Cloudflare R2 Asset: Active</span>
                    <a
                      href="#download"
                      onClick={(e) => {
                        e.preventDefault();
                        showToast(`Simulating R2 download for "${order.productTitle}"...`);
                      }}
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3 h-3" />
                      Download Package
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= STOREFRONT BROWSING ================= */
        <div className="space-y-6">
          {/* Spotlight Hero Banner (App of the Day style) */}
          {featuredProduct && (
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 p-6 sm:p-8 shadow-2xl">
              <div className="relative z-10 max-w-xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border border-amber-400/30">
                    ★ Editor's Choice
                  </span>
                  <span className="text-xs text-slate-400">Featured Telegram Automation</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {featuredProduct.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {featuredProduct.shortDescription}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setSelectedProduct(featuredProduct)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/30"
                  >
                    <span>Get for {featuredProduct.priceHndy.toLocaleString()} $HNDY</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-amber-300">
                      <Star className="w-3.5 h-3.5 fill-amber-300" />
                      {featuredProduct.rating} ({featuredProduct.reviewsCount})
                    </span>
                    <span>•</span>
                    <span>{featuredProduct.downloadSize}</span>
                    <span>•</span>
                    <span>{featuredProduct.developer}</span>
                  </div>
                </div>
              </div>

              {/* Decorative background glow */}
              <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none bg-gradient-to-l from-cyan-500 to-transparent"></div>
            </div>
          )}

          {/* Search Bar & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps, bot tools, games..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid (Play Store Card Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer hover:shadow-xl hover:-translate-y-1"
              >
                <div className="space-y-3">
                  {/* Icon & Developer */}
                  <div className="flex items-start gap-3">
                    <img
                      src={product.iconUrl}
                      alt={product.title}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-800 shadow-md group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block truncate">
                        {product.category}
                      </span>
                      <h4 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-cyan-400 transition-colors">
                        {product.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {product.developer}
                      </p>
                    </div>
                  </div>

                  {/* Rating & Size */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-amber-300">
                      <Star className="w-3 h-3 fill-amber-300" />
                      {product.rating}
                    </span>
                    <span>•</span>
                    <span>{product.downloadSize}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">{product.version}</span>
                  </div>

                  {/* Short Description */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {product.shortDescription}
                  </p>
                </div>

                {/* Price & Action Button */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white">
                      {product.priceHndy.toLocaleString()} $HNDY
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      ≈ ${product.priceUsd} USD
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct(product);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-1"
                  >
                    <span>View</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => {
                setSelectedProduct(null);
                setPurchaseSuccess(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800"
            >
              ✕
            </button>

            {/* Header info */}
            <div className="flex items-start gap-4">
              <img
                src={selectedProduct.iconUrl}
                alt={selectedProduct.title}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-800 shadow-xl"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  {selectedProduct.category}
                </span>
                <h3 className="text-lg font-black text-white">{selectedProduct.title}</h3>
                <p className="text-xs text-slate-400">{selectedProduct.developer} • {selectedProduct.version}</p>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span className="flex items-center gap-1 font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded">
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    {selectedProduct.rating} ({selectedProduct.reviewsCount} reviews)
                  </span>
                  <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {selectedProduct.downloadSize}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">About this Item</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedProduct.fullDescription || selectedProduct.shortDescription}
              </p>
            </div>

            {/* Features checklist */}
            {selectedProduct.features && (
              <div className="space-y-2 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300">Package Deliverables</h4>
                <div className="space-y-1.5">
                  {selectedProduct.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cloudflare R2 Packaging & Storage Note */}
            <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
              <span>Cloudflare R2 Key: <code className="text-cyan-400">{selectedProduct.packageR2Key}</code></span>
              <span className="text-emerald-400 font-semibold">Instant Digital Delivery</span>
            </div>

            {/* Success Box if purchased */}
            {purchaseSuccess && (
              <div className="bg-emerald-950/50 border border-emerald-800/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>Item Activated & Licensed!</span>
                </div>
                <div className="text-xs text-slate-300">
                  Your License Voucher: <code className="font-mono text-amber-300 font-bold">{purchaseSuccess.order?.issuedCode}</code>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <div>
                <span className="text-base font-black text-white">
                  {selectedProduct.priceHndy.toLocaleString()} $HNDY
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Current balance: {currentUser?.coins?.toLocaleString()} $HNDY
                </span>
              </div>

              <button
                onClick={() => handleBuyProduct(selectedProduct)}
                disabled={isPurchasing || currentUser?.coins < selectedProduct.priceHndy}
                className="flex-1 max-w-xs py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isPurchasing
                    ? 'Processing...'
                    : currentUser?.coins < selectedProduct.priceHndy
                    ? 'Insufficient $HNDY'
                    : 'Get License & Package'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
