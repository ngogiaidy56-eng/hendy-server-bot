export const DEFAULT_MENU_CONFIG = {
  version: 1,
  theme: { background: "#0b5263", radius: "12px" },
  buttons: [
    { id: "minigame", label: "🚀 MINIGAME LIVE", variant: "orange", layout: "half", enabled: true, href: "", tab: "" },
    { id: "tool_rental", label: "🧰 THUÊ TOOL (NEW)", variant: "cyan", layout: "half", enabled: true, href: "", tab: "" },
    { id: "gift_packs", label: "🎁 MUA LÌ XÌ · CODE MÀN · CODE TELE", variant: "green", layout: "full", enabled: true, href: "", tab: "" },
    { id: "topup", label: "💳 NẠP TIỀN", variant: "orange", layout: "half", enabled: true, href: "", tab: "" },
    { id: "otp_proxy", label: "⚙ OTP & PROXY", variant: "cyan", layout: "half", enabled: true, href: "", tab: "" },
    { id: "vip_tools", label: "🏆 VIP KHO CÔNG CỤ ĐẶC QUYỀN", variant: "cyan", layout: "full", enabled: true, href: "", tab: "" },
    { id: "customer_center", label: "💎 TRUNG TÂM KHÁCH HÀNG", variant: "cyan", layout: "full", enabled: true, href: "", tab: "" },
    { id: "matchmaking", label: "🎉 HỆ THỐNG GHÉP ĐÔI ĐẤU", variant: "orange", layout: "full", enabled: true, href: "", tab: "" },
    { id: "referral", label: "👥 Giới thiệu REF", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "vip_center", label: "🏅 TRUNG TÂM VIP", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "chat_group", label: "👑 NHÓM CHAT", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "announcements", label: "📢 KÊNH THÔNG BÁO", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "giftcode", label: "🎁 NHẬP GIFTCODE", variant: "green", layout: "half", enabled: true, href: "", tab: "" },
    { id: "support", label: "🧑🏻 LIÊN HỆ CSKH", variant: "green", layout: "half", enabled: true, href: "", tab: "" }
  ]
};

const ALLOWED_VARIANTS = new Set(["orange", "cyan", "green"]);
const ALLOWED_LAYOUTS = new Set(["half", "full"]);
const ALLOWED_TABS = new Set(["", "menu", "tap", "ai", "tasks", "leaderboard"]);

export function sanitizeMenuConfig(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.buttons)) {
    throw new TypeError("Menu config must contain a buttons array.");
  }

  const submitted = new Map(input.buttons.map((button) => [String(button?.id || ""), button]));
  const buttons = DEFAULT_MENU_CONFIG.buttons.map((base) => {
    const candidate = submitted.get(base.id) || base;
    const label = String(candidate.label ?? base.label).trim();
    const variant = String(candidate.variant ?? base.variant);
    const layout = String(candidate.layout ?? base.layout);
    const href = String(candidate.href ?? base.href).trim();
    const tab = String(candidate.tab ?? base.tab);

    if (!label || label.length > 64) throw new TypeError("Menu button labels must contain 1–64 characters.");
    if (!ALLOWED_VARIANTS.has(variant)) throw new TypeError("Unsupported menu button color.");
    if (!ALLOWED_LAYOUTS.has(layout)) throw new TypeError("Unsupported menu button layout.");
    if (!ALLOWED_TABS.has(tab)) throw new TypeError("Unsupported in-app menu target.");
    if (href) {
      let parsed;
      try { parsed = new URL(href); } catch { throw new TypeError("Menu links must be valid HTTPS or Telegram URLs."); }
      if (!["https:", "tg:"].includes(parsed.protocol)) {
        throw new TypeError("Menu links must use HTTPS or Telegram deep links.");
      }
    }
    return {
      id: base.id,
      label,
      variant,
      layout,
      enabled: candidate.enabled !== false,
      href,
      tab,
    };
  });

  return {
    version: 1,
    theme: { ...DEFAULT_MENU_CONFIG.theme },
    buttons,
  };
}

export function getDefaultMenuConfig() {
  return structuredClone(DEFAULT_MENU_CONFIG);
}
