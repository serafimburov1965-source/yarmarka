import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Search, Plus, X, MapPin, Phone, Smartphone, Wrench, Car,
  Shirt, Home, Gamepad2, Package, Check, Tag, ImagePlus,
  MessageCircle, LifeBuoy, User, LogOut, Send, ArrowLeft, Mail, Lock,
  Heart, Star, Flag, Trash2, Pencil, ArrowUpDown, Bookmark, Truck, Repeat, Eye, ChevronLeft, ChevronRight,
  QrCode, Timer, Video, PhoneCall, PhoneOff, Calendar, Users, TrendingDown, Clock,
  Upload, BarChart3, Store, RotateCw, Boxes, MessageSquareText, Briefcase
} from "lucide-react";
import Papa from "papaparse";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "./supabaseClient";
import { initTelegram, getTelegramUser, getStartParam } from "./telegram";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const MAX_PHOTOS = 5;
const FREE_LISTINGS_LIMIT = 5;
const SUPPORT_REF = "support";
const DELIVERY_OPTIONS = ["Самовывоз", "Курьером по городу", "СДЭК", "Boxberry", "Другое"];

function compressImage(file, maxDim = 900, quality = 0.65) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const CATEGORIES = [
  { id: "electronics", label: "Электроника", icon: Smartphone },
  { id: "tools", label: "Инструменты", icon: Wrench },
  { id: "transport", label: "Транспорт", icon: Car },
  { id: "clothes", label: "Одежда", icon: Shirt },
  { id: "home", label: "Для дома", icon: Home },
  { id: "hobby", label: "Хобби", icon: Gamepad2 },
  { id: "other", label: "Разное", icon: Package },
];

const CITIES = [
  "Москва", "Санкт-Петербург", "Новосибирск", "Екатеринбург", "Казань", "Нижний Новгород",
  "Челябинск", "Красноярск", "Самара", "Уфа", "Ростов-на-Дону", "Краснодар", "Омск",
  "Воронеж", "Пермь", "Волгоград", "Саратов", "Тюмень", "Тольятти", "Махачкала",
  "Барнаул", "Иркутск", "Ульяновск", "Хабаровск", "Ярославль", "Владивосток", "Томск",
  "Оренбург", "Кемерово", "Новокузнецк", "Рязань", "Астрахань", "Пенза", "Липецк",
  "Киров", "Чебоксары", "Тула", "Калининград", "Балашиха", "Курск", "Севастополь",
  "Ставрополь", "Симферополь", "Улан-Удэ", "Тверь", "Магнитогорск", "Сочи", "Иваново",
  "Брянск", "Белгород", "Сургут", "Владимир", "Нижний Тагил", "Архангельск", "Чита",
  "Калуга", "Смоленск", "Волжский", "Якутск", "Саранск", "Курган", "Орёл", "Череповец",
  "Вологда", "Владикавказ", "Мурманск", "Тамбов", "Стерлитамак", "Грозный", "Якутск",
  "Кострома", "Петрозаводск", "Нижневартовск", "Новороссийск", "Йошкар-Ола", "Комсомольск-на-Амуре",
  "Таганрог", "Сыктывкар", "Нальчик", "Шахты", "Дзержинск", "Орск", "Братск", "Ангарск",
  "Энгельс", "Благовещенск", "Королёв", "Псков", "Бийск", "Прокопьевск", "Армавир",
  "Балаково", "Рыбинск", "Абакан", "Северодвинск", "Норильск", "Волгодонск", "Уссурийск",
  "Пятигорск", "Дербент", "Новочеркасск", "Каменск-Уральский", "Батайск", "Нефтекамск",
  "Черкесск", "Майкоп", "Элиста", "Горно-Алтайск", "Анадырь", "Магадан", "Южно-Сахалинск",
  "Петропавловск-Камчатский", "Биробиджан", "Салехард", "Ханты-Мансийск", "Нарьян-Мар",
  "Другой",
];
const CARD_TINTS = ["#E7EFE6", "#F2E6D8", "#EAE3F0", "#E6ECF2", "#F2E0DD", "#E9F0E0"];

function catIcon(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.icon : Package;
}
function catLabel(id) {
  const c = CATEGORIES.find((c) => c.id === id);
  return c ? c.label : "Разное";
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} дн назад`;
}

const FONT_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;900&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
  .font-display { font-family: 'Unbounded', sans-serif; }
  .font-body { font-family: 'Manrope', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; }
`;

export default function App() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [boardMode, setBoardMode] = useState("sell"); // sell | want
  const [sortBy, setSortBy] = useState("newest"); // newest | price_asc | price_desc
  const [showCreate, setShowCreate] = useState(false);
  const [repostSource, setRepostSource] = useState(null);
  const [editListing, setEditListing] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const [toast, setToast] = useState("");
  const [configError, setConfigError] = useState(false);

  const [tab, setTab] = useState("feed"); // feed | favorites | chats | profile

  const [tgUser, setTgUser] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [activeChat, setActiveChat] = useState(null);
  const [deepLinkSeller, setDeepLinkSeller] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageIdsRef = useRef(new Set());
  const firstUnreadCheckRef = useRef(true);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [savedSearches, setSavedSearches] = useState([]);

  const currentUser = useMemo(() => {
    if (tgUser) {
      return { ref: `tg_${tgUser.id}`, defaultName: tgUser.username ? `@${tgUser.username}` : (tgUser.first_name || "Пользователь"), source: "telegram" };
    }
    if (authSession) {
      return { ref: authSession.user.id, defaultName: authSession.user.email, source: "site" };
    }
    return null;
  }, [tgUser, authSession]);

  useEffect(() => {
    initTelegram();
    setTgUser(getTelegramUser());
    loadListings();

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => setAuthSession(data.session));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setAuthSession(session));
      return () => sub.subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!listings.length) return;
    const params = new URLSearchParams(window.location.search);
    const deepLinkId = params.get("listing") || getStartParam();
    if (deepLinkId) {
      const found = listings.find((l) => l.id === deepLinkId);
      if (found) setShowDetail(found);
    }
    const sellerParam = params.get("seller");
    if (sellerParam) setDeepLinkSeller(sellerParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.length]);

  useEffect(() => {
    if (!currentUser || !supabase) {
      setProfile(null);
      setProfileChecked(true);
      return;
    }
    setProfileChecked(false);
    supabase.from("profiles").select("*").eq("ref", currentUser.ref).maybeSingle().then(({ data }) => {
      setProfile(data || null);
      setProfileChecked(true);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !supabase) {
      setFavoriteIds(new Set());
      setSavedSearches([]);
      return;
    }
    supabase.from("favorites").select("listing_id").eq("ref", currentUser.ref).then(({ data }) => {
      setFavoriteIds(new Set((data || []).map((f) => f.listing_id)));
    });
    supabase.from("saved_searches").select("*").eq("ref", currentUser.ref).order("created_at", { ascending: false }).then(({ data }) => {
      setSavedSearches(data || []);
    });
  }, [currentUser]);

  async function loadListings() {
    if (!supabase) {
      setConfigError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false });
    if (!error) setListings(data || []);
    setLoading(false);
  }

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  const myListings = useMemo(() => {
    if (!currentUser) return [];
    return listings.filter((l) => l.author_ref === currentUser.ref);
  }, [listings, currentUser]);

  useEffect(() => {
    if (!currentUser || !profile || !supabase) return;
    const storageKey = `yarmarka_last_read_${currentUser.ref}`;

    async function poll() {
      const lastRead = localStorage.getItem(storageKey) || new Date(0).toISOString();
      const { data } = await supabase
        .from("messages")
        .select("id, sender_name, content, created_at")
        .eq("receiver_ref", currentUser.ref)
        .gt("created_at", lastRead)
        .order("created_at", { ascending: false });
      const items = data || [];
      setUnreadCount(items.length);
      if (!firstUnreadCheckRef.current) {
        const newOnes = items.filter((m) => !lastMessageIdsRef.current.has(m.id));
        if (newOnes.length > 0 && tab !== "chats") {
          flashToast(`Новое сообщение от ${newOnes[0].sender_name || "пользователя"}`);
        }
      }
      firstUnreadCheckRef.current = false;
      lastMessageIdsRef.current = new Set(items.map((m) => m.id));
    }

    poll();
    const interval = setInterval(poll, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, profile, tab]);

  function openChatsTab() {
    setTab("chats");
    if (currentUser) {
      localStorage.setItem(`yarmarka_last_read_${currentUser.ref}`, new Date().toISOString());
      setUnreadCount(0);
    }
  }

  function requireAuth() {
    if (!currentUser) {
      setShowAuth(true);
      return false;
    }
    if (!profile) {
      flashToast("Сначала закончи регистрацию");
      return false;
    }
    return true;
  }

  async function handleCreate(payload) {
    if (!supabase || !currentUser || !profile) return;
    const row = {
      id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...payload,
      tint: CARD_TINTS[Math.floor(Math.random() * CARD_TINTS.length)],
      telegram_user_id: tgUser?.id || null,
      telegram_username: tgUser?.username || null,
      author_ref: currentUser.ref,
      author_name: profile.name,
      views: 0,
    };
    const { error } = await supabase.from("listings").insert(row);
    if (error) {
      flashToast("Не получилось опубликовать — попробуй ещё раз");
      return;
    }
    setShowCreate(false);
    setRepostSource(null);
    flashToast("Объявление опубликовано");
    loadListings();
  }

  async function handleUpdate(id, payload) {
    if (!supabase) return;
    const { error } = await supabase.from("listings").update(payload).eq("id", id);
    if (error) {
      flashToast("Не получилось сохранить изменения");
      return;
    }
    setEditListing(null);
    flashToast("Изменения сохранены");
    loadListings();
  }

  async function handleDelete(id) {
    if (!supabase) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      flashToast("Не получилось удалить");
      return;
    }
    flashToast("Объявление удалено");
    setShowDetail(null);
    loadListings();
  }

  async function toggleFavorite(listingId) {
    if (!requireAuth()) return;
    const isFav = favoriteIds.has(listingId);
    const next = new Set(favoriteIds);
    if (isFav) {
      next.delete(listingId);
      setFavoriteIds(next);
      await supabase.from("favorites").delete().eq("ref", currentUser.ref).eq("listing_id", listingId);
    } else {
      next.add(listingId);
      setFavoriteIds(next);
      await supabase.from("favorites").insert({ ref: currentUser.ref, listing_id: listingId });
    }
  }

  async function saveCurrentSearch() {
    if (!requireAuth()) return;
    if (!search.trim() && activeCat === "all") return flashToast("Сначала задай поиск или категорию");
    const { data, error } = await supabase.from("saved_searches").insert({ ref: currentUser.ref, query: search.trim(), category: activeCat }).select().single();
    if (!error) {
      setSavedSearches((prev) => [data, ...prev]);
      flashToast("Поиск сохранён");
    }
  }

  async function deleteSavedSearch(id) {
    await supabase.from("saved_searches").delete().eq("id", id);
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  }

  function applySavedSearch(s) {
    setSearch(s.query || "");
    setActiveCat(s.category || "all");
    setTab("feed");
  }

  const filtered = useMemo(() => {
    let list = listings
      .filter((l) => (l.post_type || "sell") === (boardMode === "wholesale" ? "sell" : boardMode))
      .filter((l) => boardMode === "wholesale" ? l.wholesale_only : !l.wholesale_only)
      .filter((l) => !(l.stock_quantity !== null && l.stock_quantity !== undefined && l.stock_quantity <= 0))
      .filter((l) => activeCat === "all" || l.category === activeCat)
      .filter((l) => !freeOnly || Number(l.price) === 0)
      .filter((l) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return l.title.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q);
      });
    if (sortBy === "price_asc") list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sortBy === "price_desc") list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    return list;
  }, [listings, activeCat, freeOnly, search, sortBy, boardMode]);

  const favoriteListings = useMemo(() => listings.filter((l) => favoriteIds.has(l.id)), [listings, favoriteIds]);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-body text-center" style={{ background: "#F2EFE4" }}>
        <div>
          <p className="font-display font-bold mb-2">База данных не подключена</p>
          <p className="text-sm" style={{ color: "#5B584E" }}>Заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — инструкция в README.md</p>
        </div>
      </div>
    );
  }

  const needsRegistration = currentUser && profileChecked && !profile;

  return (
    <div className="min-h-screen font-body pb-20" style={{ background: "#F2EFE4", color: "#1C1F1B" }}>
      <style>{FONT_STYLE}</style>

      <header style={{ background: "#1C1F1B" }} className="sticky top-0 z-30 border-b-4">
        <div style={{ borderColor: "#FFC93C" }} className="border-b-4">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
            <button onClick={() => { window.location.href = window.location.origin; }} className="flex items-center gap-2">
              <div style={{ background: "#FFC93C", color: "#1C1F1B" }} className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm rotate-[-8deg]">Я</div>
              <h1 className="font-display font-bold text-xl md:text-2xl tracking-tight" style={{ color: "#F2EFE4" }}>ЯРМАРКА</h1>
            </button>
            <div className="flex-1 min-w-[160px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B8677" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Найти что угодно..." className="w-full pl-9 pr-3 py-2.5 rounded-lg outline-none font-body text-sm" style={{ background: "#F2EFE4", color: "#1C1F1B" }} />
            </div>
            <button onClick={() => (requireAuth() ? setShowCreate(true) : null)} style={{ background: "#2F6B4F" }} className="flex items-center gap-1.5 text-white px-4 py-2.5 rounded-lg font-body font-bold text-sm hover:brightness-110 transition">
              <Plus size={16} strokeWidth={3} /> Разместить
            </button>
          </div>
        </div>
        {tab === "feed" && (
          <>
            <div className="max-w-6xl mx-auto px-4 pt-2 flex gap-2">
              {[["sell", "Продают"], ["want", "Ищут"]].map(([val, label]) => (
                <button key={val} onClick={() => setBoardMode(val)} className="px-3.5 py-1.5 rounded-full text-xs font-bold border"
                  style={boardMode === val ? { background: "#FFC93C", color: "#1C1F1B", borderColor: "#FFC93C" } : { background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}>
                  {label}
                </button>
              ))}
              {profile?.is_wholesaler && (
                <button onClick={() => setBoardMode("wholesale")} className="px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1"
                  style={boardMode === "wholesale" ? { background: "#FFC93C", color: "#1C1F1B", borderColor: "#FFC93C" } : { background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}>
                  <Briefcase size={11} /> B2B
                </button>
              )}
            </div>
            <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2">
              <CategorySwiper
                activeCat={activeCat}
                freeOnly={freeOnly}
                onSelect={(id) => { if (id === "free") { setFreeOnly(!freeOnly); } else { setActiveCat(id); setFreeOnly(false); } }}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs font-bold rounded-full px-2.5 py-2 border" style={{ background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}>
                  <option value="newest" style={{ color: "#000" }}>Сначала новые</option>
                  <option value="price_asc" style={{ color: "#000" }}>Дешевле</option>
                  <option value="price_desc" style={{ color: "#000" }}>Дороже</option>
                </select>
                {currentUser && (
                  <button onClick={saveCurrentSearch} title="Сохранить поиск" className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#3A3D37" }}>
                    <Bookmark size={13} color="#F2EFE4" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {needsRegistration ? (
        <RegisterScreen currentUser={currentUser} onDone={(p) => { setProfile(p); flashToast("Регистрация завершена"); }} />
      ) : (
        <>
          {tab === "feed" && (
            <>
              <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
                <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "#2F6B4F" }}>
                  <p className="font-display font-bold text-white text-base md:text-lg leading-snug">Безлимит объявлений. Всегда бесплатно.</p>
                  <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full rotate-[-4deg]" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
                    0 ₽ КОМИССИЯ
                  </span>
                </div>
              </div>
              <main className="max-w-6xl mx-auto px-4 py-6">
                {loading ? (
                  <div className="text-center py-24 font-body" style={{ color: "#8B8677" }}>Загружаем объявления...</div>
                ) : filtered.length === 0 ? (
                  <EmptyState onCreate={() => (requireAuth() ? setShowCreate(true) : null)} hasAny={listings.length > 0} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((l) => (
                      <ListingCard key={l.id} listing={l} onOpen={() => setShowDetail(l)} isFavorite={favoriteIds.has(l.id)} onToggleFavorite={() => toggleFavorite(l.id)} />
                    ))}
                  </div>
                )}
              </main>
            </>
          )}

          {tab === "favorites" && (
            currentUser ? (
              <div className="max-w-6xl mx-auto px-4 py-6">
                <h2 className="font-display font-bold text-lg mb-4">Избранное</h2>
                {favoriteListings.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8B8677" }}>Пока пусто — нажми на сердечко на карточке товара, чтобы сохранить</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {favoriteListings.map((l) => (
                      <ListingCard key={l.id} listing={l} onOpen={() => setShowDetail(l)} isFavorite onToggleFavorite={() => toggleFavorite(l.id)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <LoggedOutPrompt onLogin={() => setShowAuth(true)} text="Войди, чтобы видеть избранное" />
            )
          )}

          {tab === "events" && (
            <EventsTab currentUser={currentUser} profile={profile} onRequireAuth={requireAuth} />
          )}

          {tab === "chats" && (
            currentUser && profile ? (
              <ChatsTab currentUser={currentUser} onOpenChat={(c) => setActiveChat(c)} onOpenSupport={() => setActiveChat({ listingId: null, otherRef: SUPPORT_REF, otherName: "Поддержка" })} />
            ) : (
              <LoggedOutPrompt onLogin={() => setShowAuth(true)} text="Войди, чтобы видеть сообщения" />
            )
          )}

          {tab === "profile" && (
            currentUser && profile ? (
              <ProfileTab
                profile={profile}
                currentUser={currentUser}
                myListings={myListings}
                savedSearches={savedSearches}
                onApplySearch={applySavedSearch}
                onDeleteSearch={deleteSavedSearch}
                onOpenListing={(l) => setShowDetail(l)}
                onEditListing={(l) => setEditListing(l)}
                onDeleteListing={handleDelete}
                onRepost={(l) => { setRepostSource(l); setShowCreate(true); }}
                onSupport={() => setActiveChat({ listingId: null, otherRef: SUPPORT_REF, otherName: "Поддержка" })}
                onLogout={async () => { if (supabase && currentUser.source === "site") await supabase.auth.signOut(); }}
                onEdit={() => setShowEditProfile(true)}
              />
            ) : (
              <LoggedOutPrompt onLogin={() => setShowAuth(true)} text="Войди, чтобы посмотреть профиль" />
            )
          )}
        </>
      )}

      <BottomNav tab={tab} setTab={setTab} onOpenChats={openChatsTab} unreadCount={unreadCount} />

      {showCreate && (
        <ListingFormModal
          mode="create"
          onClose={() => { setShowCreate(false); setRepostSource(null); }}
          onSubmit={handleCreate}
          limitReached={false}
          isWholesaler={profile?.is_wholesaler || false}
          initial={repostSource}
        />
      )}

      {editListing && (
        <ListingFormModal
          mode="edit"
          initial={editListing}
          onClose={() => setEditListing(null)}
          onSubmit={(payload) => handleUpdate(editListing.id, payload)}
          limitReached={false}
          isWholesaler={profile?.is_wholesaler || false}
        />
      )}

      {showDetail && (
        <DetailModal
          listing={showDetail}
          currentUser={currentUser}
          isOwner={currentUser && showDetail.author_ref === currentUser.ref}
          isFavorite={favoriteIds.has(showDetail.id)}
          onToggleFavorite={() => toggleFavorite(showDetail.id)}
          onClose={() => setShowDetail(null)}
          onEdit={() => { setEditListing(showDetail); setShowDetail(null); }}
          onDelete={() => handleDelete(showDetail.id)}
          onMessageSeller={() => {
            if (!requireAuth()) return;
            const sellerRef = showDetail.author_ref;
            if (!sellerRef || sellerRef === currentUser.ref) { flashToast("Это твоё объявление"); return; }
            setActiveChat({ listingId: showDetail.id, otherRef: sellerRef, otherName: showDetail.author_name || "Продавец" });
            setShowDetail(null);
          }}
          requireAuth={requireAuth}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => { setShowAuth(false); flashToast("Готово"); }} />}

      {showEditProfile && profile && (
        <EditProfileModal profile={profile} onClose={() => setShowEditProfile(false)} onSaved={(p) => { setProfile(p); setShowEditProfile(false); flashToast("Профиль обновлён"); }} />
      )}

      {activeChat && currentUser && profile && (
        <ChatModal currentUser={currentUser} myName={profile.name} listingId={activeChat.listingId} otherRef={activeChat.otherRef} otherName={activeChat.otherName} onClose={() => setActiveChat(null)} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-body font-semibold text-sm shadow-lg z-50 flex items-center gap-2" style={{ background: "#1C1F1B", color: "#F2EFE4" }}>
          <Check size={16} style={{ color: "#FFC93C" }} />
          {toast}
        </div>
      )}

      {deepLinkSeller && (
        <SellerProfileModal sellerRef={deepLinkSeller} onClose={() => setDeepLinkSeller(null)} onOpenListing={() => {}} />
      )}
    </div>
  );
}

function BottomNav({ tab, setTab, onOpenChats, unreadCount }) {
  const items = [
    { id: "feed", label: "Лента", icon: Home },
    { id: "favorites", label: "Избранное", icon: Heart },
    { id: "events", label: "События", icon: Calendar },
    { id: "chats", label: "Сообщения", icon: MessageCircle },
    { id: "profile", label: "Профиль", icon: User },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-4" style={{ background: "#1C1F1B", borderColor: "#FFC93C" }}>
      <div className="max-w-6xl mx-auto flex">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => (it.id === "chats" ? onOpenChats() : setTab(it.id))} className="flex-1 flex flex-col items-center gap-1 py-2.5 relative">
              <div className="relative">
                <it.icon size={18} color={active ? "#FFC93C" : "#8B8677"} />
                {it.id === "chats" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "#E1543D", color: "#fff" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-bold font-body" style={{ color: active ? "#FFC93C" : "#8B8677" }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoggedOutPrompt({ onLogin, text }) {
  return (
    <div className="text-center py-24 px-4">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center rotate-[-6deg]" style={{ background: "#E8E3D2" }}>
        <User size={22} style={{ color: "#2F6B4F" }} />
      </div>
      <p className="font-body text-sm mb-4" style={{ color: "#5B584E" }}>{text}</p>
      <button onClick={onLogin} style={{ background: "#2F6B4F" }} className="text-white px-5 py-2.5 rounded-lg font-body font-bold text-sm">Войти</button>
    </div>
  );
}

function CategorySwiper({ activeCat, freeOnly, onSelect }) {
  const scrollRef = useRef(null);
  const items = [{ id: "all", label: "Всё", icon: null }, { id: "free", label: "Даром", icon: null }, ...CATEGORIES];

  function scrollBy(dir) {
    scrollRef.current?.scrollBy({ left: dir * 110, behavior: "smooth" });
  }

  return (
    <div className="relative flex-1 min-w-0 flex items-center gap-1">
      <button onClick={() => scrollBy(-1)} className="hidden sm:flex w-6 h-6 rounded-full items-center justify-center flex-shrink-0" style={{ background: "#3A3D37" }}>
        <ChevronLeft size={13} color="#F2EFE4" />
      </button>
      <div ref={scrollRef} className="flex-1 flex gap-2 overflow-x-auto" style={{ scrollSnapType: "x mandatory", scrollBehavior: "smooth" }}>
        {items.map((it) => {
          const isActive = it.id === "free" ? freeOnly : (it.id === "all" ? activeCat === "all" && !freeOnly : activeCat === it.id && !freeOnly);
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              className="flex flex-col items-center justify-center gap-1 px-4 py-1.5 rounded-xl flex-shrink-0 font-body font-bold text-[11px] whitespace-nowrap border"
              style={{
                scrollSnapAlign: "start",
                background: isActive ? "#FFC93C" : "transparent",
                color: isActive ? "#1C1F1B" : "#F2EFE4",
                borderColor: isActive ? "#FFC93C" : "#3A3D37",
                minWidth: 64,
              }}
            >
              {Icon ? <Icon size={15} /> : <span>{it.id === "free" ? "🎁" : "🏠"}</span>}
              {it.label}
            </button>
          );
        })}
      </div>
      <button onClick={() => scrollBy(1)} className="hidden sm:flex w-6 h-6 rounded-full items-center justify-center flex-shrink-0" style={{ background: "#3A3D37" }}>
        <ChevronRight size={13} color="#F2EFE4" />
      </button>
    </div>
  );
}

function MapClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function LocationPicker({ lat, lng, onChange }) {
  const center = lat && lng ? [lat, lng] : [55.751244, 37.618423];
  return (
    <div className="rounded-lg overflow-hidden border-2" style={{ borderColor: "#1C1F1B22", height: 220 }}>
      <MapContainer center={center} zoom={lat ? 13 : 4} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        {lat && lng && <Marker position={[lat, lng]} />}
        <MapClickHandler onPick={onChange} />
      </MapContainer>
    </div>
  );
}

function Pill({ active, onClick, label, Icon }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition font-body border flex-shrink-0"
      style={active ? { background: "#FFC93C", color: "#1C1F1B", borderColor: "#FFC93C" } : { background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}>
      {Icon && <Icon size={13} />}
      {label}
    </button>
  );
}

function ListingCard({ listing, onOpen, isFavorite, onToggleFavorite }) {
  const Icon = catIcon(listing.category);
  const isFree = Number(listing.price) === 0;
  const isWant = listing.post_type === "want";
  const isReserved = listing.reserved_until && new Date(listing.reserved_until) > new Date();
  const cover = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  return (
    <div onClick={onOpen} className="text-left rounded-2xl overflow-hidden border-2 relative transition hover:-translate-y-1 hover:shadow-xl cursor-pointer" style={{ background: listing.tint || "#EAE3F0", borderColor: "#1C1F1B22" }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
        style={{ background: "#1C1F1BAA" }}
      >
        <Heart size={14} color={isFavorite ? "#E1543D" : "#F2EFE4"} fill={isFavorite ? "#E1543D" : "none"} />
      </button>
      {isWant ? (
        <div className="absolute top-5 left-[-30px] rotate-[-38deg] font-mono font-bold text-[10px] px-8 py-1 shadow z-10" style={{ background: "#C7B8E8", color: "#1C1F1B" }}>ИЩУ</div>
      ) : isFree ? (
        <div className="absolute top-5 left-[-30px] rotate-[-38deg] font-mono font-bold text-[10px] px-8 py-1 shadow z-10" style={{ background: "#FFC93C", color: "#1C1F1B" }}>ДАРОМ</div>
      ) : null}
      {isReserved && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "#1C1F1BDD", color: "#FFC93C" }}>
          <Timer size={10} /> Придержано
        </div>
      )}
      {cover ? (
        <div className="w-full aspect-[4/3] overflow-hidden"><img src={cover} alt={listing.title} className="w-full h-full object-cover" /></div>
      ) : null}
      <div className={cover ? "p-4" : "p-4 pt-8"}>
        {!cover && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#1C1F1B" }}>
            <Icon size={18} color="#F2EFE4" />
          </div>
        )}
        <h3 className="font-body font-bold text-sm mb-1 line-clamp-2" style={{ color: "#1C1F1B" }}>{listing.title}</h3>
        <p className="font-mono font-bold text-lg mb-2" style={{ color: "#2F6B4F" }}>{isWant ? "Ищу" : isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}</p>
        {listing.barter && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2" style={{ background: "#E6ECF2", color: "#1C1F1B" }}>
            <Repeat size={10} /> Обмен
          </span>
        )}
        <div className="flex items-center justify-between text-[11px] font-body" style={{ color: "#5B584E" }}>
          <span className="flex items-center gap-1"><MapPin size={11} /> {listing.city}</span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, hasAny }) {
  return (
    <div className="text-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center rotate-[-6deg]" style={{ background: "#E8E3D2" }}>
        <Tag size={26} style={{ color: "#2F6B4F" }} />
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{hasAny ? "Ничего не нашлось" : "Здесь пока пусто"}</h3>
      <p className="font-body text-sm mb-5" style={{ color: "#5B584E" }}>{hasAny ? "Попробуй другой запрос или категорию." : "Стань первым, кто разместит объявление — это бесплатно и займёт минуту."}</p>
      <button onClick={onCreate} style={{ background: "#2F6B4F" }} className="text-white px-5 py-2.5 rounded-lg font-body font-bold text-sm inline-flex items-center gap-1.5">
        <Plus size={16} strokeWidth={3} /> Разместить объявление
      </button>
    </div>
  );
}

function ListingFormModal({ mode, initial, onClose, onSubmit, limitReached, isWholesaler }) {
  const isEdit = mode === "edit";
  const [postType, setPostType] = useState(initial?.post_type || "sell");
  const [title, setTitle] = useState(initial?.title || "");
  const [price, setPrice] = useState(initial ? String(initial.price ?? "") : "");
  const [category, setCategory] = useState(initial?.category || "electronics");
  const [city, setCity] = useState(initial?.city && CITIES.includes(initial.city) ? initial.city : (initial?.city ? "Другой" : "Пермь"));
  const [customCity, setCustomCity] = useState(initial?.city && !CITIES.includes(initial.city) ? initial.city : "");
  const [address, setAddress] = useState(initial?.address || "");
  const [lat, setLat] = useState(initial?.lat || null);
  const [lng, setLng] = useState(initial?.lng || null);
  const [showMap, setShowMap] = useState(false);
  const [condition, setCondition] = useState(initial?.condition || "used");
  const [description, setDescription] = useState(initial?.description || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [barter, setBarter] = useState(initial?.barter || false);
  const [delivery, setDelivery] = useState(initial?.delivery || DELIVERY_OPTIONS[0]);
  const [autoDiscount, setAutoDiscount] = useState(initial?.auto_discount_enabled || false);
  const [discountPercent, setDiscountPercent] = useState(initial?.auto_discount_percent || 5);
  const [discountDays, setDiscountDays] = useState(initial?.auto_discount_days || 3);
  const [stockQuantity, setStockQuantity] = useState(initial?.stock_quantity ?? "");
  const [wholesaleOnly, setWholesaleOnly] = useState(initial?.wholesale_only || false);
  const [images, setImages] = useState(initial?.images || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) return setError(`Максимум ${MAX_PHOTOS} фото`);
    setUploading(true);
    setError("");
    try {
      const compressed = await Promise.all(files.slice(0, room).map((f) => compressImage(f)));
      setImages((prev) => [...prev, ...compressed]);
    } catch {
      setError("Не получилось загрузить одно из фото");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (limitReached) return setError("Бесплатный лимит исчерпан — нужна подписка");
    if (!title.trim()) return setError("Укажи название товара");
    if (!contact.trim()) return setError("Укажи контакт для связи");
    const finalCity = city === "Другой" ? customCity.trim() : city;
    if (!finalCity) return setError("Укажи город");
    setError("");
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      price: price === "" ? 0 : Math.max(0, Number(price)),
      category, city: finalCity, address: address.trim(), lat, lng, condition,
      description: description.trim(), contact: contact.trim(),
      barter, delivery, images, post_type: postType,
      auto_discount_enabled: autoDiscount,
      auto_discount_percent: Number(discountPercent) || 5,
      auto_discount_days: Number(discountDays) || 3,
      stock_quantity: stockQuantity === "" ? null : Math.max(0, Number(stockQuantity)),
      wholesale_only: wholesaleOnly,
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">{isEdit ? "Редактировать объявление" : "Новое объявление"}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {limitReached ? (
          <div className="p-5">
            <p className="font-body text-sm mb-4">Бесплатный лимит — {FREE_LISTINGS_LIMIT} объявлений — исчерпан. Подписка на неограниченные объявления скоро появится.</p>
            <button onClick={onClose} style={{ background: "#1C1F1B" }} className="text-white py-3 rounded-lg font-body font-bold text-sm w-full">Понятно</button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex gap-2">
              {[["sell", "Продаю"], ["want", "Ищу"]].map(([val, label]) => (
                <button key={val} onClick={() => setPostType(val)} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold border-2 font-body"
                  style={postType === val ? { background: "#2F6B4F", color: "#fff", borderColor: "#2F6B4F" } : { background: "#fff", borderColor: "#1C1F1B22", color: "#1C1F1B" }}>
                  {label}
                </button>
              ))}
            </div>
            {isWholesaler && (
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
                <input type="checkbox" checked={wholesaleOnly} onChange={(e) => setWholesaleOnly(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><Briefcase size={13} /> Только для оптовиков (B2B-раздел)</span>
              </label>
            )}
            <Field label="Название"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: iPhone 13, 128GB" className="input" /></Field>
            <Field label={`Фото (до ${MAX_PHOTOS})`}>
              <div className="flex flex-wrap gap-2">
                {images.map((src, idx) => (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border-2" style={{ borderColor: "#1C1F1B22" }}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#1C1F1B" }}>
                      <X size={10} color="#F2EFE4" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_PHOTOS && (
                  <label className="w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer gap-0.5" style={{ borderColor: "#1C1F1B44", color: "#5B584E" }}>
                    {uploading ? <span className="text-[9px] font-bold">...</span> : (<><ImagePlus size={16} /><span className="text-[9px] font-bold">Фото</span></>)}
                    <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
                  </label>
                )}
              </div>
            </Field>
            <Field label="Цена, ₽ (0 = даром)"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" inputMode="numeric" className="input font-mono" /></Field>
            <Field label="Количество в наличии (необязательно)">
              <input value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Оставь пустым, если товар один" inputMode="numeric" className="input font-mono" />
            </Field>
            <Field label="Категория">
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.id} onClick={() => setCategory(c.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-2 font-body"
                    style={category === c.id ? { background: "#2F6B4F", color: "#fff", borderColor: "#2F6B4F" } : { background: "#fff", color: "#1C1F1B", borderColor: "#1C1F1B22" }}>
                    <c.icon size={13} /> {c.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Город">
              <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            {city === "Другой" && (
              <Field label="Укажи свой город">
                <input value={customCity} onChange={(e) => setCustomCity(e.target.value)} placeholder="Название города" className="input" />
              </Field>
            )}
            <Field label="Адрес / район (необязательно)">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Например: ул. Ленина, район Центр" className="input" />
            </Field>
            <button type="button" onClick={() => setShowMap(!showMap)} className="text-xs font-bold flex items-center gap-1.5" style={{ color: "#2F6B4F" }}>
              <MapPin size={13} /> {showMap ? "Скрыть карту" : lat ? "Точка отмечена на карте — изменить" : "Отметить точку на карте"}
            </button>
            {showMap && <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />}
            <Field label="Состояние">
              <div className="flex gap-2">
                {[["new", "Новое"], ["used", "Б/у"]].map(([val, label]) => (
                  <button key={val} onClick={() => setCondition(val)} className="flex-1 px-3 py-2 rounded-lg text-xs font-bold border-2 font-body"
                    style={condition === val ? { background: "#FFC93C", borderColor: "#FFC93C", color: "#1C1F1B" } : { background: "#fff", borderColor: "#1C1F1B22", color: "#1C1F1B" }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Способ передачи">
              <select value={delivery} onChange={(e) => setDelivery(e.target.value)} className="input">
                {DELIVERY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={barter} onChange={(e) => setBarter(e.target.checked)} className="w-4 h-4" />
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><Repeat size={13} /> Готов на обмен</span>
            </label>
            {Number(price) > 0 && (
              <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={autoDiscount} onChange={(e) => setAutoDiscount(e.target.checked)} className="w-4 h-4" />
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><TrendingDown size={13} /> Автоснижение цены</span>
                </label>
                {autoDiscount && (
                  <div className="flex gap-2 items-center text-xs" style={{ color: "#5B584E" }}>
                    снижать на
                    <input type="number" min="1" max="50" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-14 px-2 py-1 rounded border text-center" style={{ borderColor: "#1C1F1B22" }} />
                    % каждые
                    <input type="number" min="1" max="30" value={discountDays} onChange={(e) => setDiscountDays(e.target.value)} className="w-14 px-2 py-1 rounded border text-center" style={{ borderColor: "#1C1F1B22" }} />
                    дн.
                  </div>
                )}
              </div>
            )}
            <Field label="Описание"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Кратко расскажи о товаре" className="input resize-none" /></Field>
            <Field label="Контакт (телефон / телеграм)"><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username или +7..." className="input" /></Field>
            {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
            <button onClick={submit} disabled={submitting} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm mt-1 disabled:opacity-60">
              {submitting ? "Сохраняем..." : isEdit ? "Сохранить изменения" : "Опубликовать бесплатно"}
            </button>
          </div>
        )}
      </div>
      <style>{`
        .input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }
        .input:focus { border-color: #2F6B4F; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold" style={{ color: "#5B584E" }}>{label}</span>
      {children}
    </label>
  );
}

function StarRow({ value, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "#FFC93C" : "none"} color={n <= Math.round(value) ? "#FFC93C" : "#8B8677"} />
      ))}
    </div>
  );
}

function DetailModal({ listing, currentUser, isOwner, isFavorite, onToggleFavorite, onClose, onEdit, onDelete, onMessageSeller, requireAuth }) {
  const Icon = catIcon(listing.category);
  const isFree = Number(listing.price) === 0;
  const images = listing.images || [];
  const [activeImg, setActiveImg] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSeller, setShowSeller] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const viewedRef = useRef(false);

  const [reservedUntil, setReservedUntil] = useState(listing.reserved_until);
  const isReserved = reservedUntil && new Date(reservedUntil) > new Date();

  async function reserve() {
    if (!supabase) return;
    const until = new Date(Date.now() + 30 * 60000).toISOString();
    await supabase.from("listings").update({ reserved_until: until, reserved_by: currentUser.ref }).eq("id", listing.id);
    setReservedUntil(until);
  }

  useEffect(() => {
    if (!supabase) return;
    if (!viewedRef.current) {
      viewedRef.current = true;
      supabase.from("listings").update({ views: (listing.views || 0) + 1 }).eq("id", listing.id).then(() => {});
    }
    if (listing.author_ref) {
      supabase.from("reviews").select("*").eq("seller_ref", listing.author_ref).order("created_at", { ascending: false }).then(({ data }) => setReviews(data || []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        {images.length > 0 ? (
          <div className="relative">
            <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1C1F1BCC" }}>
              <X size={16} color="#F2EFE4" />
            </button>
            <button onClick={onToggleFavorite} className="absolute top-4 right-14 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1C1F1BCC" }}>
              <Heart size={16} color={isFavorite ? "#E1543D" : "#F2EFE4"} fill={isFavorite ? "#E1543D" : "none"} />
            </button>
            <div className="w-full aspect-[4/3]" style={{ background: listing.tint || "#EAE3F0" }}>
              <img src={images[activeImg]} alt={listing.title} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-1.5 px-4 py-2.5" style={{ background: listing.tint || "#EAE3F0" }}>
                {images.map((src, idx) => (
                  <button key={idx} onClick={() => setActiveImg(idx)} className="w-11 h-11 rounded-lg overflow-hidden border-2 flex-shrink-0" style={{ borderColor: idx === activeImg ? "#2F6B4F" : "transparent" }}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="p-4 pt-3" style={{ background: listing.tint || "#EAE3F0" }}>
              <h2 className="font-display font-bold text-lg mb-1 pr-8">{listing.title}</h2>
              <p className="font-mono font-black text-2xl" style={{ color: "#2F6B4F" }}>{isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}</p>
            </div>
          </div>
        ) : (
          <div style={{ background: listing.tint || "#EAE3F0" }} className="p-6 relative">
            <button onClick={onClose} className="absolute top-4 right-4"><X size={20} /></button>
            <button onClick={onToggleFavorite} className="absolute top-4 right-14"><Heart size={20} color={isFavorite ? "#E1543D" : "#1C1F1B"} fill={isFavorite ? "#E1543D" : "none"} /></button>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "#1C1F1B" }}>
              <Icon size={22} color="#F2EFE4" />
            </div>
            <h2 className="font-display font-bold text-lg mb-1 pr-8">{listing.title}</h2>
            <p className="font-mono font-black text-2xl" style={{ color: "#2F6B4F" }}>{isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}</p>
          </div>
        )}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap text-xs font-bold" style={{ color: "#5B584E" }}>
            <span className="flex items-center gap-1"><MapPin size={13} /> {listing.city}</span>
            <span>{catLabel(listing.category)}</span>
            <span>{listing.condition === "new" ? "Новое" : "Б/у"}</span>
            <span className="flex items-center gap-1"><Eye size={13} /> {listing.views || 0}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {listing.barter && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#E6ECF2", color: "#1C1F1B" }}>
                <Repeat size={11} /> Готов на обмен
              </span>
            )}
            {listing.delivery && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#E8E3D2", color: "#1C1F1B" }}>
                <Truck size={11} /> {listing.delivery}
              </span>
            )}
            {isReserved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
                <Timer size={11} /> Придержано до {new Date(reservedUntil).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {listing.address && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#5B584E" }}>
              <MapPin size={12} /> {listing.address}
            </p>
          )}
          {listing.lat && listing.lng && (
            <a href={`https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}&zoom=15`} target="_blank" rel="noreferrer" className="text-xs font-bold underline" style={{ color: "#2F6B4F" }}>
              Открыть точку на карте
            </a>
          )}
          {listing.description && <p className="text-sm font-body leading-relaxed">{listing.description}</p>}
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "#E8E3D2" }}>
            <Phone size={16} style={{ color: "#2F6B4F" }} />
            <span className="font-mono font-bold text-sm">{listing.contact}</span>
          </div>

          {listing.author_name && (
            <div className="flex items-center justify-between">
              <button onClick={() => setShowSeller(true)} className="text-xs underline" style={{ color: "#8B8677" }}>Продавец: {listing.author_name}</button>
              <div className="flex items-center gap-1.5">
                {reviews.length > 0 ? (
                  <>
                    <StarRow value={avgRating} size={12} />
                    <span className="text-[10px] font-bold" style={{ color: "#8B8677" }}>({reviews.length})</span>
                  </>
                ) : (
                  <span className="text-[10px]" style={{ color: "#8B8677" }}>Нет отзывов</span>
                )}
              </div>
            </div>
          )}

          {!isOwner && (
            <>
              <div className="flex gap-2">
                <button onClick={onMessageSeller} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-body font-bold text-sm text-white" style={{ background: "#1C1F1B" }}>
                  <MessageCircle size={16} /> Написать продавцу
                </button>
              </div>
              {!isReserved && (
                <button onClick={() => (requireAuth() ? reserve() : null)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
                  <Timer size={13} /> Придержать на 30 минут
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => (requireAuth() ? setShowReview(true) : null)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
                  <Star size={13} /> Оставить отзыв
                </button>
                <button onClick={() => setShowReport(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22", color: "#E1543D" }}>
                  <Flag size={13} /> Пожаловаться
                </button>
              </div>
            </>
          )}

          {isOwner && listing.auto_discount_enabled && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#5B584E" }}>
              <TrendingDown size={12} /> Цена снижается на {listing.auto_discount_percent}% каждые {listing.auto_discount_days} дн.
            </p>
          )}

          {isOwner && (
            <div className="flex gap-2">
              <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
                <Pencil size={13} /> Изменить
              </button>
              <button onClick={() => setShowQR(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
                <QrCode size={13} /> QR-стикер
              </button>
              <button onClick={() => setConfirmDelete(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22", color: "#E1543D" }}>
                <Trash2 size={13} /> Удалить
              </button>
            </div>
          )}

          {confirmDelete && (
            <div className="p-3 rounded-lg flex items-center justify-between gap-2" style={{ background: "#F2E0DD" }}>
              <span className="text-xs font-bold">Удалить объявление насовсем?</span>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#fff" }}>Нет</button>
                <button onClick={onDelete} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#E1543D" }}>Да</button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-center" style={{ color: "#8B8677" }}>Опубликовано {timeAgo(listing.created_at)}</p>
        </div>
      </div>

      {showReview && (
        <ReviewModal
          sellerRef={listing.author_ref}
          reviewerRef={currentUser.ref}
          onClose={() => setShowReview(false)}
          onSaved={(r) => { setReviews((prev) => [r, ...prev]); setShowReview(false); }}
        />
      )}
      {showReport && (
        <ReportModal listingId={listing.id} reporterRef={currentUser?.ref || null} onClose={() => setShowReport(false)} />
      )}
      {showSeller && (
        <SellerProfileModal sellerRef={listing.author_ref} onClose={() => setShowSeller(false)} onOpenListing={(l) => { setShowSeller(false); }} />
      )}
      {showQR && (
        <QRModal listing={listing} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}

function QRModal({ listing, onClose }) {
  const url = `${window.location.origin}/?listing=${listing.id}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl p-6 text-center" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base">QR-стикер</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl inline-block mb-3">
          <QRCodeSVG value={url} size={180} />
        </div>
        <p className="font-body font-bold text-sm mb-1">{listing.title}</p>
        <p className="text-xs mb-4" style={{ color: "#8B8677" }}>Наклей на товар — сканирование сразу откроет это объявление</p>
        <p className="text-[10px] break-all" style={{ color: "#8B8677" }}>{url}</p>
        <p className="text-[11px] mt-3" style={{ color: "#5B584E" }}>Сделай скриншот этого экрана, чтобы распечатать</p>
      </div>
    </div>
  );
}

function ReviewModal({ sellerRef, reviewerRef, onClose, onSaved }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!supabase) return;
    if (!sellerRef) { setError("У этого объявления нет привязанного продавца — отзыв оставить нельзя"); return; }
    setBusy(true);
    setError("");
    const { data, error } = await supabase.from("reviews").insert({ seller_ref: sellerRef, reviewer_ref: reviewerRef, rating, comment: comment.trim() }).select().single();
    setBusy(false);
    if (error) { setError("Не получилось отправить: " + error.message); return; }
    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base">Отзыв о продавце</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex gap-1 mb-4 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)}>
              <Star size={28} fill={n <= rating ? "#FFC93C" : "none"} color={n <= rating ? "#FFC93C" : "#8B8677"} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Как прошла сделка? (необязательно)" className="input resize-none mb-3" />
        {error && <p className="text-xs font-bold mb-3" style={{ color: "#E1543D" }}>{error}</p>}
        <button onClick={submit} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm w-full disabled:opacity-60">
          {busy ? "Отправляем..." : "Отправить отзыв"}
        </button>
        <style>{`.input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }`}</style>
      </div>
    </div>
  );
}

const REPORT_REASONS = ["Спам или реклама", "Мошенничество", "Запрещённый товар", "Дубликат объявления", "Другое"];

function ReportModal({ listingId, reporterRef, onClose }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!supabase) return;
    setBusy(true);
    await supabase.from("reports").insert({ listing_id: listingId, reporter_ref: reporterRef, reason });
    setBusy(false);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base">Пожаловаться</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {done ? (
          <p className="text-sm text-center py-6" style={{ color: "#5B584E" }}>Спасибо, мы посмотрим</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className="text-left px-3 py-2.5 rounded-lg text-sm font-body border-2"
                  style={reason === r ? { background: "#2F6B4F", color: "#fff", borderColor: "#2F6B4F" } : { background: "#fff", borderColor: "#1C1F1B22" }}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={submit} disabled={busy} style={{ background: "#E1543D" }} className="text-white py-3 rounded-lg font-body font-bold text-sm w-full disabled:opacity-60">
              {busy ? "Отправляем..." : "Отправить жалобу"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SellerProfileModal({ sellerRef, onClose }) {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !sellerRef) return;
    Promise.all([
      supabase.from("profiles").select("*").eq("ref", sellerRef).maybeSingle(),
      supabase.from("listings").select("*").eq("author_ref", sellerRef).order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").eq("seller_ref", sellerRef).order("created_at", { ascending: false }),
    ]).then(([p, l, r]) => {
      setProfile(p.data || null);
      setListings(l.data || []);
      setReviews(r.data || []);
      setLoading(false);
    });
  }, [sellerRef]);

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">Профиль продавца</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {loading ? (
          <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Загружаем...</p>
        ) : !profile ? (
          <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Профиль не найден</p>
        ) : (
          <div className="p-5 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#2F6B4F" }}>
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-xl text-white">{profile.name.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div>
                <p className="font-display font-bold text-base">{profile.name}</p>
                <p className="text-xs" style={{ color: "#8B8677" }}>{profile.city}</p>
                {reviews.length > 0 ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <StarRow value={avgRating} size={12} />
                    <span className="text-[10px] font-bold" style={{ color: "#8B8677" }}>({reviews.length} отзывов)</span>
                  </div>
                ) : (
                  <span className="text-[10px]" style={{ color: "#8B8677" }}>Нет отзывов</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-display font-bold text-sm mb-2">Объявления ({listings.length})</h3>
              {listings.length === 0 ? (
                <p className="text-xs" style={{ color: "#8B8677" }}>Пока ничего не выложено</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {listings.map((l) => <ListingCard key={l.id} listing={l} onOpen={() => {}} isFavorite={false} onToggleFavorite={() => {}} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterScreen({ currentUser, onDone }) {
  const [name, setName] = useState(currentUser.defaultName || "");
  const [city, setCity] = useState("Пермь");
  const [isWholesaler, setIsWholesaler] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase) return;
    if (!name.trim()) return setError("Укажи имя");
    setBusy(true);
    setError("");
    const row = { ref: currentUser.ref, name: name.trim(), city, source: currentUser.source, is_wholesaler: isWholesaler };
    const { data, error } = await supabase.from("profiles").insert(row).select().single();
    setBusy(false);
    if (error) {
      setError("Не получилось зарегистрироваться, попробуй ещё раз");
      return;
    }
    onDone(data);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="rounded-2xl p-6" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
        <h2 className="font-display font-bold text-lg mb-1">Регистрация</h2>
        <p className="text-xs mb-5" style={{ color: "#5B584E" }}>
          {currentUser.source === "telegram" ? "Заведи профиль на Ярмарке — привязывается к твоему Telegram-аккаунту." : "Заведи профиль, чтобы размещать объявления и писать в чат."}
        </p>
        <div className="flex flex-col gap-4">
          <Field label="Имя"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к тебе обращаться" className="input" /></Field>
          <Field label="Город">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isWholesaler} onChange={(e) => setIsWholesaler(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><Briefcase size={13} /> Я перекупщик/оптовик</span>
          </label>
          {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
          <button onClick={submit} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm disabled:opacity-60">
            {busy ? "Секунду..." : "Зарегистрироваться"}
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }
        .input:focus { border-color: #2F6B4F; }
      `}</style>
    </div>
  );
}

function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase) return;
    if (!email.trim() || !password) return setError("Заполни email и пароль");
    setBusy(true);
    setError("");
    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("already registered") ? "Такой email уже зарегистрирован — войди" :
        error.message.includes("not confirmed") ? "Email не подтверждён — попроси администратора выключить подтверждение почты" :
        "Ошибка: проверь email и пароль"
      );
      return;
    }
    onSuccess();
  }

  async function sendReset() {
    if (!supabase) return;
    if (!email.trim()) return setError("Укажи email");
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) {
      setError("Не получилось отправить письмо");
      return;
    }
    setInfo("Письмо со ссылкой для смены пароля отправлено на " + email.trim());
  }

  async function oauthSignIn(provider) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) {
      setBusy(false);
      setError("Не получилось войти через " + provider);
    }
  }

  if (mode === "reset") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
        <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl" style={{ background: "#F2EFE4" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1C1F1B22" }}>
            <h2 className="font-display font-bold text-base">Восстановление пароля</h2>
            <button onClick={onClose}><X size={20} /></button>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <Field label="Email">
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B8677" }} />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input pl-8" />
              </div>
            </Field>
            {info && <p className="text-xs font-bold" style={{ color: "#2F6B4F" }}>{info}</p>}
            {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
            <button onClick={sendReset} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm disabled:opacity-60">
              {busy ? "Секунду..." : "Отправить письмо"}
            </button>
            <button onClick={() => { setMode("signin"); setError(""); setInfo(""); }} className="text-xs font-bold text-center" style={{ color: "#2F6B4F" }}>
              Назад ко входу
            </button>
          </div>
          <style>{`
            .input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }
            .input:focus { border-color: #2F6B4F; }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">{mode === "signup" ? "Регистрация" : "Вход"}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs" style={{ color: "#5B584E" }}>Если открыл сайт из Telegram — вход и регистрация уже происходят автоматически. Это форма для входа с обычного сайта.</p>

          <button onClick={() => oauthSignIn("google")} disabled={busy} className="flex items-center justify-center gap-2 py-3 rounded-lg font-body font-bold text-sm border-2 disabled:opacity-60" style={{ borderColor: "#1C1F1B22", background: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.6C29.6 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.9 39.7 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
            Продолжить с Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "#1C1F1B22" }} />
            <span className="text-[10px] font-bold" style={{ color: "#8B8677" }}>ИЛИ EMAIL</span>
            <div className="flex-1 h-px" style={{ background: "#1C1F1B22" }} />
          </div>

          <Field label="Email">
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B8677" }} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input pl-8" />
            </div>
          </Field>
          <Field label="Пароль">
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B8677" }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" className="input pl-8" />
            </div>
          </Field>
          {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
          <button onClick={submit} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm disabled:opacity-60">
            {busy ? "Секунду..." : mode === "signup" ? "Зарегистрироваться" : "Войти"}
          </button>
          <div className="flex items-center justify-between">
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-xs font-bold" style={{ color: "#2F6B4F" }}>
              {mode === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
            </button>
            {mode === "signin" && (
              <button onClick={() => { setMode("reset"); setError(""); }} className="text-xs font-bold" style={{ color: "#8B8677" }}>
                Забыли пароль?
              </button>
            )}
          </div>
        </div>
        <style>{`
          .input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }
          .input:focus { border-color: #2F6B4F; }
        `}</style>
      </div>
    </div>
  );
}

function EditProfileModal({ profile, onClose, onSaved }) {
  const [name, setName] = useState(profile.name || "");
  const [city, setCity] = useState(profile.city || "Пермь");
  const [avatar, setAvatar] = useState(profile.avatar_url || null);
  const [isWholesaler, setIsWholesaler] = useState(profile.is_wholesaler || false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(profile.auto_reply_enabled || false);
  const [autoReplyText, setAutoReplyText] = useState(profile.auto_reply_text || "Спасибо за сообщение! Отвечу, как только смогу.");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file, 400, 0.7);
      setAvatar(compressed);
    } catch {
      setError("Не получилось загрузить фото");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!supabase) return;
    if (!name.trim()) return setError("Укажи имя");
    setBusy(true);
    setError("");
    const { data, error } = await supabase.from("profiles").update({
      name: name.trim(), city, avatar_url: avatar,
      is_wholesaler: isWholesaler,
      auto_reply_enabled: autoReplyEnabled,
      auto_reply_text: autoReplyText.trim(),
    }).eq("ref", profile.ref).select().single();
    setBusy(false);
    if (error) {
      setError("Не получилось сохранить, попробуй ещё раз");
      return;
    }
    onSaved(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">Редактировать профиль</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#2F6B4F" }}>
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-2xl text-white">{name.slice(0, 1).toUpperCase() || "?"}</span>}
            </div>
            <label className="px-3 py-2 rounded-lg font-body font-bold text-xs border-2 cursor-pointer" style={{ borderColor: "#1C1F1B22" }}>
              {uploading ? "Загрузка..." : "Загрузить фото"}
              <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
            </label>
          </div>
          <Field label="Имя"><input value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
          <Field label="Город">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isWholesaler} onChange={(e) => setIsWholesaler(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><Briefcase size={13} /> Я перекупщик/оптовик</span>
          </label>

          <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={autoReplyEnabled} onChange={(e) => setAutoReplyEnabled(e.target.checked)} className="w-4 h-4" />
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#5B584E" }}><MessageSquareText size={13} /> Автоответ в чате</span>
            </label>
            {autoReplyEnabled && (
              <textarea value={autoReplyText} onChange={(e) => setAutoReplyText(e.target.value)} rows={2} className="input resize-none" placeholder="Текст автоответа" />
            )}
          </div>

          {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
          <button onClick={submit} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm disabled:opacity-60">
            {busy ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
        <style>{`
          .input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }
          .input:focus { border-color: #2F6B4F; }
        `}</style>
      </div>
    </div>
  );
}

function ProfileTab({ profile, currentUser, myListings, savedSearches, onApplySearch, onDeleteSearch, onOpenListing, onEditListing, onDeleteListing, onRepost, onSupport, onLogout, onEdit }) {
  const [showBulk, setShowBulk] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!supabase || myListings.length === 0) { setStats({ views: 0, favorites: 0, messages: 0, topCategory: null }); return; }
    (async () => {
      const ids = myListings.map((l) => l.id);
      const totalViews = myListings.reduce((s, l) => s + (l.views || 0), 0);
      const { count: favCount } = await supabase.from("favorites").select("*", { count: "exact", head: true }).in("listing_id", ids);
      const { count: msgCount } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_ref", currentUser.ref);
      const byCat = {};
      myListings.forEach((l) => { byCat[l.category] = (byCat[l.category] || 0) + (l.views || 0); });
      const topCategory = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      setStats({ views: totalViews, favorites: favCount || 0, messages: msgCount || 0, topCategory });
    })();
  }, [myListings, currentUser.ref]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="rounded-2xl p-5 mb-6 flex items-center gap-4" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "#2F6B4F" }}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-xl text-white">{profile.name.slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-base truncate">{profile.name}</p>
          <p className="text-xs" style={{ color: "#8B8677" }}>{profile.city} · {currentUser.source === "telegram" ? "Telegram" : "Сайт"}{profile.is_wholesaler ? " · Оптовик" : ""}</p>
        </div>
        <button onClick={onEdit} className="px-3 py-2 rounded-lg font-body font-bold text-xs border-2 flex-shrink-0" style={{ borderColor: "#1C1F1B22" }}>Изменить</button>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setShowShare(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
          <Store size={14} /> Витрина
        </button>
        <button onClick={onSupport} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
          <LifeBuoy size={14} /> Поддержка
        </button>
        {currentUser.source === "site" && (
          <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
            <LogOut size={14} /> Выйти
          </button>
        )}
      </div>

      {stats && myListings.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
            <p className="text-[10px] font-bold flex items-center gap-1 mb-1" style={{ color: "#8B8677" }}><Eye size={11} /> Просмотров всего</p>
            <p className="font-mono font-bold text-lg">{stats.views}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
            <p className="text-[10px] font-bold flex items-center gap-1 mb-1" style={{ color: "#8B8677" }}><Heart size={11} /> В избранном</p>
            <p className="font-mono font-bold text-lg">{stats.favorites}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
            <p className="text-[10px] font-bold flex items-center gap-1 mb-1" style={{ color: "#8B8677" }}><MessageCircle size={11} /> Сообщений получено</p>
            <p className="font-mono font-bold text-lg">{stats.messages}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
            <p className="text-[10px] font-bold flex items-center gap-1 mb-1" style={{ color: "#8B8677" }}><BarChart3 size={11} /> Топ-категория</p>
            <p className="font-mono font-bold text-sm">{stats.topCategory ? catLabel(stats.topCategory) : "—"}</p>
          </div>
        </div>
      )}

      {profile.is_wholesaler && (
        <button onClick={() => setShowBulk(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-body font-bold text-sm text-white mb-6" style={{ background: "#1C1F1B" }}>
          <Upload size={16} /> Массовая загрузка из CSV
        </button>
      )}

      {savedSearches.length > 0 && (
        <div className="mb-6">
          <h3 className="font-display font-bold text-sm mb-3">Сохранённые поиски</h3>
          <div className="flex flex-col gap-2">
            {savedSearches.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "#fff", border: "2px solid #1C1F1B11" }}>
                <button onClick={() => onApplySearch(s)} className="text-left flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.query || "Все объявления"}</p>
                  <p className="text-[11px]" style={{ color: "#8B8677" }}>{s.category === "all" ? "Все категории" : catLabel(s.category)}</p>
                </button>
                <button onClick={() => onDeleteSearch(s.id)} className="flex-shrink-0 ml-2"><X size={16} color="#8B8677" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="font-display font-bold text-sm mb-3">Мои объявления ({myListings.length})</h3>
      {myListings.length === 0 ? (
        <p className="text-sm" style={{ color: "#8B8677" }}>Ты ещё ничего не разместил</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myListings.map((l) => (
            <div key={l.id} className="relative">
              <ListingCard listing={l} onOpen={() => onOpenListing(l)} isFavorite={false} onToggleFavorite={() => {}} />
              <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                <button onClick={(e) => { e.stopPropagation(); onRepost(l); }} title="Повторить" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#2F6B4F" }}>
                  <RotateCw size={13} color="#F2EFE4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onEditListing(l); }} title="Изменить" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1C1F1B" }}>
                  <Pencil size={13} color="#F2EFE4" />
                </button>
              </div>
              {l.stock_quantity !== null && l.stock_quantity !== undefined && (
                <span className="absolute bottom-3 left-3 z-10 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "#1C1F1BDD", color: "#F2EFE4" }}>
                  Остаток: {l.stock_quantity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {showShare && <ShareStorefrontModal profile={profile} currentUser={currentUser} onClose={() => setShowShare(false)} />}
      {showBulk && <BulkUploadModal currentUser={currentUser} profile={profile} onClose={() => setShowBulk(false)} />}
    </div>
  );
}

function ShareStorefrontModal({ profile, currentUser, onClose }) {
  const url = `${window.location.origin}/?seller=${currentUser.ref}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-xs rounded-t-2xl sm:rounded-2xl p-6 text-center" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base">Витрина «{profile.name}»</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="bg-white p-4 rounded-xl inline-block mb-3">
          <QRCodeSVG value={url} size={160} />
        </div>
        <p className="text-xs mb-2" style={{ color: "#8B8677" }}>Ссылка на твою витрину со всеми объявлениями:</p>
        <p className="text-[10px] break-all p-2 rounded" style={{ background: "#fff", color: "#5B584E" }}>{url}</p>
      </div>
    </div>
  );
}

function BulkUploadModal({ currentUser, profile, onClose }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setStatus("");
    setErrors([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const errs = [];
        const toInsert = [];
        rows.forEach((row, idx) => {
          const title = (row.title || row["название"] || "").trim();
          if (!title) { errs.push(`Строка ${idx + 2}: нет названия`); return; }
          const category = CATEGORIES.find((c) => c.id === (row.category || "").trim())?.id || "other";
          toInsert.push({
            id: `l_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
            title,
            price: Number(row.price || row["цена"] || 0) || 0,
            category,
            city: (row.city || row["город"] || profile.city || "Другой").trim(),
            condition: (row.condition || "used").trim() === "new" ? "new" : "used",
            description: (row.description || row["описание"] || "").trim(),
            contact: (row.contact || row["контакт"] || "").trim() || "см. в чате",
            stock_quantity: row.quantity ? Number(row.quantity) : null,
            images: [],
            barter: false,
            delivery: DELIVERY_OPTIONS[0],
            post_type: "sell",
            author_ref: currentUser.ref,
            author_name: profile.name,
            tint: CARD_TINTS[Math.floor(Math.random() * CARD_TINTS.length)],
            views: 0,
          });
        });
        if (toInsert.length > 0) {
          const { error } = await supabase.from("listings").insert(toInsert);
          if (error) errs.push("Ошибка при сохранении: " + error.message);
        }
        setErrors(errs);
        setStatus(`Загружено объявлений: ${toInsert.length} из ${rows.length}`);
        setBusy(false);
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">Массовая загрузка</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs" style={{ color: "#5B584E" }}>
            CSV-файл с колонками: <b>title, price, category, city, condition, description, contact, quantity</b>.
            Категория — одно из: {CATEGORIES.map((c) => c.id).join(", ")}. Заголовки строк можно и на русском (название, цена, город, описание, контакт).
          </p>
          <label className="flex items-center justify-center gap-2 py-3 rounded-lg font-body font-bold text-sm border-2 border-dashed cursor-pointer" style={{ borderColor: "#1C1F1B44" }}>
            <Upload size={16} /> {busy ? "Обрабатываем..." : "Выбрать CSV-файл"}
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" disabled={busy} />
          </label>
          {status && <p className="text-sm font-bold" style={{ color: "#2F6B4F" }}>{status}</p>}
          {errors.length > 0 && (
            <div className="p-3 rounded-lg text-xs" style={{ background: "#F2E0DD", color: "#E1543D" }}>
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventsTab({ currentUser, profile, onRequireAuth }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("events").select("*").gte("event_date", new Date(Date.now() - 86400000).toISOString()).order("event_date", { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg">Барахолки-события</h2>
        <button onClick={() => (onRequireAuth() ? setShowCreate(true) : null)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-body font-bold text-xs text-white" style={{ background: "#2F6B4F" }}>
          <Plus size={14} /> Создать
        </button>
      </div>
      {loading ? (
        <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Загружаем...</p>
      ) : events.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Пока нет запланированных встреч — стань первым, кто организует</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((ev) => (
            <button key={ev.id} onClick={() => setShowDetail(ev)} className="text-left p-4 rounded-xl" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-display font-bold text-sm">{ev.title}</p>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
                  {new Date(ev.event_date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
              </div>
              <p className="text-xs flex items-center gap-1" style={{ color: "#5B584E" }}><MapPin size={11} /> {ev.location}</p>
            </button>
          ))}
        </div>
      )}
      {showCreate && (
        <CreateEventModal
          currentUser={currentUser}
          profile={profile}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
      {showDetail && (
        <EventDetailModal
          event={showDetail}
          currentUser={currentUser}
          profile={profile}
          onClose={() => setShowDetail(null)}
          onRequireAuth={onRequireAuth}
        />
      )}
    </div>
  );
}

function CreateEventModal({ currentUser, profile, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim() || !location.trim() || !date) return setError("Заполни название, место и дату");
    setBusy(true);
    setError("");
    const { error } = await supabase.from("events").insert({
      title: title.trim(), description: description.trim(), location: location.trim(),
      event_date: new Date(date).toISOString(), lat, lng,
      creator_ref: currentUser.ref, creator_name: profile.name,
    });
    setBusy(false);
    if (error) { setError("Не получилось создать событие"); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">Новая барахолка</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <Field label="Название"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Барахолка в парке Горького" className="input" /></Field>
          <Field label="Место"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Адрес или ориентир" className="input" /></Field>
          <Field label="Дата и время"><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></Field>
          <button type="button" onClick={() => setShowMap(!showMap)} className="text-xs font-bold flex items-center gap-1.5" style={{ color: "#2F6B4F" }}>
            <MapPin size={13} /> {showMap ? "Скрыть карту" : "Отметить точку на карте"}
          </button>
          {showMap && <LocationPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />}
          <Field label="Описание"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Что за встреча, что можно принести продавать" className="input resize-none" /></Field>
          {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
          <button onClick={submit} disabled={busy} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm disabled:opacity-60">
            {busy ? "Создаём..." : "Создать событие"}
          </button>
        </div>
        <style>{`.input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }`}</style>
      </div>
    </div>
  );
}

function EventDetailModal({ event, currentUser, profile, onClose, onRequireAuth }) {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bringing, setBringing] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);

  async function load() {
    const { data } = await supabase.from("event_attendees").select("*").eq("event_id", event.id).order("created_at", { ascending: true });
    setAttendees(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const myAttendance = currentUser ? attendees.find((a) => a.ref === currentUser.ref) : null;

  async function join() {
    await supabase.from("event_attendees").upsert({ event_id: event.id, ref: currentUser.ref, name: profile.name, bringing: bringing.trim() });
    setShowJoinForm(false);
    load();
  }

  async function leave() {
    await supabase.from("event_attendees").delete().eq("event_id", event.id).eq("ref", currentUser.ref);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">{event.title}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs flex items-center gap-1" style={{ color: "#5B584E" }}><Calendar size={13} /> {new Date(event.event_date).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-xs flex items-center gap-1" style={{ color: "#5B584E" }}><MapPin size={13} /> {event.location}</p>
          {event.lat && event.lng && (
            <a href={`https://www.openstreetmap.org/?mlat=${event.lat}&mlon=${event.lng}&zoom=15`} target="_blank" rel="noreferrer" className="text-xs font-bold underline" style={{ color: "#2F6B4F" }}>Открыть точку на карте</a>
          )}
          {event.description && <p className="text-sm">{event.description}</p>}

          {myAttendance ? (
            <button onClick={leave} className="py-3 rounded-lg font-body font-bold text-sm border-2" style={{ borderColor: "#1C1F1B22" }}>Я не приду</button>
          ) : showJoinForm ? (
            <div className="flex flex-col gap-2">
              <input value={bringing} onChange={(e) => setBringing(e.target.value)} placeholder="Что принесёшь продавать? (необязательно)" className="input" />
              <button onClick={join} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm">Подтвердить участие</button>
            </div>
          ) : (
            <button onClick={() => (onRequireAuth() ? setShowJoinForm(true) : null)} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm flex items-center justify-center gap-2">
              <Users size={16} /> Я приду
            </button>
          )}

          <div>
            <h3 className="font-display font-bold text-sm mb-2">Участники ({attendees.length})</h3>
            {loading ? (
              <p className="text-xs" style={{ color: "#8B8677" }}>Загружаем...</p>
            ) : attendees.length === 0 ? (
              <p className="text-xs" style={{ color: "#8B8677" }}>Пока никто не отметился</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {attendees.map((a) => (
                  <div key={a.ref} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "#fff" }}>
                    <span className="text-xs font-bold">{a.name}</span>
                    {a.bringing && <span className="text-[11px]" style={{ color: "#8B8677" }}>{a.bringing}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <style>{`.input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 2px solid #1C1F1B22; background: #fff; font-family: 'Manrope', sans-serif; font-size: 13px; outline: none; }`}</style>
      </div>
    </div>
  );
}

function conversationKey(listingId, ref) {
  return `${listingId || "support"}::${ref}`;
}

function ChatsTab({ currentUser, onOpenChat, onOpenSupport }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from("messages").select("*").or(`sender_ref.eq.${currentUser.ref},receiver_ref.eq.${currentUser.ref}`).order("created_at", { ascending: false });
      const map = new Map();
      (data || []).forEach((m) => {
        const otherRef = m.sender_ref === currentUser.ref ? m.receiver_ref : m.sender_ref;
        const key = conversationKey(m.listing_id, otherRef);
        if (!map.has(key)) {
          map.set(key, { listingId: m.listing_id, otherRef, otherName: m.sender_ref === currentUser.ref ? otherRef : (m.sender_name || otherRef), lastMessage: m.content, lastAt: m.created_at });
        }
      });
      setItems(Array.from(map.values()));
      setLoading(false);
    })();
  }, [currentUser.ref]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg">Сообщения</h2>
        <button onClick={onOpenSupport} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-body font-bold text-xs" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
          <LifeBuoy size={13} /> Поддержка
        </button>
      </div>
      {loading ? (
        <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Загружаем...</p>
      ) : items.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "#8B8677" }}>Пока нет диалогов</p>
      ) : (
        items.map((c) => (
          <button key={conversationKey(c.listingId, c.otherRef)} onClick={() => onOpenChat(c)} className="w-full text-left flex items-center gap-3 p-3 rounded-xl mb-1.5" style={{ background: "#fff", border: "2px solid #1C1F1B11" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.otherRef === SUPPORT_REF ? "#FFC93C" : "#2F6B4F" }}>
              {c.otherRef === SUPPORT_REF ? <LifeBuoy size={16} color="#1C1F1B" /> : <User size={16} color="#fff" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body font-bold text-sm truncate">{c.otherRef === SUPPORT_REF ? "Поддержка" : c.otherName}</p>
              <p className="text-xs truncate" style={{ color: "#8B8677" }}>{c.lastMessage}</p>
            </div>
            <span className="text-[10px] flex-shrink-0" style={{ color: "#8B8677" }}>{timeAgo(c.lastAt)}</span>
          </button>
        ))
      )}
    </div>
  );
}

function ChatModal({ currentUser, myName, listingId, otherRef, otherName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [incomingCall, setIncomingCall] = useState(false);
  const [callMode, setCallMode] = useState(null); // 'caller' | 'callee' | null
  const scrollRef = useRef(null);
  const signalChannelRef = useRef(null);

  const roomKey = `call_${[currentUser.ref, otherRef].sort().join("_")}_${listingId || "support"}`;
  const [otherProfile, setOtherProfile] = useState(null);
  const [contextListing, setContextListing] = useState(null);
  const autoRepliedRef = useRef(false);

  useEffect(() => {
    if (!supabase || otherRef === SUPPORT_REF) return;
    supabase.from("profiles").select("auto_reply_enabled, auto_reply_text").eq("ref", otherRef).maybeSingle().then(({ data }) => setOtherProfile(data));
  }, [otherRef]);

  useEffect(() => {
    if (!supabase || !listingId) return;
    supabase.from("listings").select("id, title, images, price").eq("id", listingId).maybeSingle().then(({ data }) => setContextListing(data));
  }, [listingId]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(roomKey, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "call-request" }, () => setIncomingCall(true));
    channel.on("broadcast", { event: "call-cancel" }, () => setIncomingCall(false));
    channel.subscribe();
    signalChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  async function load() {
    if (!supabase) return;
    let query = supabase.from("messages").select("*").or(`and(sender_ref.eq.${currentUser.ref},receiver_ref.eq.${otherRef}),and(sender_ref.eq.${otherRef},receiver_ref.eq.${currentUser.ref})`).order("created_at", { ascending: true });
    query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null);
    const { data } = await query;
    setMessages(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, otherRef]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!text.trim() || !supabase) return;
    const content = text.trim();
    const wasEmpty = messages.length === 0;
    setText("");
    await supabase.from("messages").insert({ listing_id: listingId, sender_ref: currentUser.ref, receiver_ref: otherRef, sender_name: myName, content });
    if (wasEmpty && !autoRepliedRef.current && otherProfile?.auto_reply_enabled && otherProfile?.auto_reply_text) {
      autoRepliedRef.current = true;
      await supabase.from("messages").insert({ listing_id: listingId, sender_ref: otherRef, receiver_ref: currentUser.ref, sender_name: otherName, content: otherProfile.auto_reply_text });
    }
    load();
  }

  function startCall() {
    signalChannelRef.current?.send({ type: "broadcast", event: "call-request", payload: {} });
    setCallMode("caller");
  }

  function acceptCall() {
    setIncomingCall(false);
    setCallMode("callee");
  }

  function declineCall() {
    setIncomingCall(false);
    signalChannelRef.current?.send({ type: "broadcast", event: "call-cancel", payload: {} });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#1C1F1B", borderColor: "#1C1F1B" }}>
          <button onClick={onClose}><ArrowLeft size={20} color="#F2EFE4" /></button>
          <button
            onClick={() => { if (otherRef !== SUPPORT_REF) window.location.href = `${window.location.origin}/?seller=${otherRef}`; }}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: otherRef === SUPPORT_REF ? "#FFC93C" : "#2F6B4F" }}
          >
            {otherRef === SUPPORT_REF ? <LifeBuoy size={14} color="#1C1F1B" /> : <User size={14} color="#fff" />}
          </button>
          <button
            onClick={() => { if (otherRef !== SUPPORT_REF) window.location.href = `${window.location.origin}/?seller=${otherRef}`; }}
            className="flex-1 text-left"
          >
            <p className="font-body font-bold text-sm" style={{ color: "#F2EFE4" }}>{otherRef === SUPPORT_REF ? "Поддержка" : otherName}</p>
            {otherRef !== SUPPORT_REF && <p className="text-[10px] underline" style={{ color: "#8B8677" }}>профиль продавца</p>}
          </button>
          {otherRef !== SUPPORT_REF && (
            <button onClick={startCall} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2F6B4F" }}>
              <Video size={15} color="#fff" />
            </button>
          )}
        </div>

        {contextListing && (
          <button
            onClick={() => { window.location.href = `${window.location.origin}/?listing=${contextListing.id}`; }}
            className="flex items-center gap-2 px-4 py-2 border-b text-left"
            style={{ background: "#E8E3D2", borderColor: "#1C1F1B22" }}
          >
            {contextListing.images?.[0] && (
              <img src={contextListing.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{contextListing.title}</p>
              <p className="text-[10px]" style={{ color: "#8B8677" }}>Диалог по этому объявлению — открыть</p>
            </div>
          </button>
        )}

        {incomingCall && (
          <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ background: "#FFC93C" }}>
            <span className="text-xs font-bold" style={{ color: "#1C1F1B" }}>Входящий видеозвонок</span>
            <div className="flex gap-2">
              <button onClick={acceptCall} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2F6B4F" }}>Принять</button>
              <button onClick={declineCall} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#1C1F1B", color: "#fff" }}>Отклонить</button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading ? (
            <p className="text-center text-sm py-10" style={{ color: "#8B8677" }}>Загружаем...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "#8B8677" }}>{otherRef === SUPPORT_REF ? "Напиши, если что-то не работает или есть вопрос" : "Начни диалог с продавцом"}</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_ref === currentUser.ref;
              return (
                <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm font-body ${mine ? "self-end" : "self-start"}`} style={{ background: mine ? "#2F6B4F" : "#fff", color: mine ? "#fff" : "#1C1F1B" }}>
                  {m.content}
                </div>
              );
            })
          )}
        </div>
        <div className="p-3 border-t flex gap-2" style={{ borderColor: "#1C1F1B22" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Написать сообщение..." className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none border-2" style={{ borderColor: "#1C1F1B22" }} />
          <button onClick={send} className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#2F6B4F" }}>
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>

      {callMode && (
        <CallModal
          roomKey={roomKey}
          mode={callMode}
          onClose={() => setCallMode(null)}
        />
      )}
    </div>
  );
}

function CallModal({ roomKey, mode, onClose }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const [status, setStatus] = useState(mode === "caller" ? "Ждём собеседника..." : "Соединяемся...");

  useEffect(() => {
    let stream;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;

    const channel = supabase.channel(roomKey + "_rtc", { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    async function flushPendingCandidates() {
      const queued = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];
      for (const c of queued) {
        try { await pc.addIceCandidate(c); } catch {}
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) channel.send({ type: "broadcast", event: "ice", payload: { candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      const map = { connecting: "Соединяемся...", connected: "Соединено", disconnected: "Связь прервалась", failed: "Не удалось соединиться", closed: "Звонок завершён" };
      setStatus(map[pc.connectionState] || pc.connectionState);
    };

    channel.on("broadcast", { event: "ready" }, async () => {
      if (mode !== "caller") return;
      setStatus("Соединяемся...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
    });
    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (mode !== "callee") return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescSetRef.current = true;
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channel.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
    });
    channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (mode !== "caller") return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      remoteDescSetRef.current = true;
      await flushPendingCandidates();
    });
    channel.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (remoteDescSetRef.current) {
        try { await pc.addIceCandidate(payload.candidate); } catch {}
      } else {
        pendingCandidatesRef.current.push(payload.candidate);
      }
    });
    channel.on("broadcast", { event: "call-end" }, () => { onClose(); });

    channel.subscribe(async (subStatus) => {
      if (subStatus !== "SUBSCRIBED") return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (mode === "callee") {
          channel.send({ type: "broadcast", event: "ready", payload: {} });
        }
      } catch (err) {
        setStatus("Нет доступа к камере/микрофону");
      }
    });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      pc.close();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hangUp() {
    channelRef.current?.send({ type: "broadcast", event: "call-end", payload: {} });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "#1C1F1B" }}>
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-28 h-40 object-cover rounded-xl border-2" style={{ borderColor: "#FFC93C" }} />
        <p className="absolute top-4 left-4 text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: "#1C1F1BAA", color: "#F2EFE4" }}>{status}</p>
      </div>
      <div className="p-5 flex justify-center" style={{ background: "#1C1F1B" }}>
        <button onClick={hangUp} className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#E1543D" }}>
          <PhoneOff size={22} color="#fff" />
        </button>
      </div>
    </div>
  );
}
