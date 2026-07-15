import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, X, MapPin, Phone, Smartphone, Wrench, Car,
  Shirt, Home, Gamepad2, Package, Check, Tag, ImagePlus,
  MessageCircle, LifeBuoy, User, LogOut, Send, ArrowLeft, Mail, Lock
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { initTelegram, getTelegramUser } from "./telegram";

const MAX_PHOTOS = 5;
const FREE_LISTINGS_LIMIT = 5;
const SUPPORT_REF = "support";

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

const CITIES = ["Пермь", "Москва", "Санкт-Петербург", "Екатеринбург", "Казань", "Другой"];
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
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [toast, setToast] = useState("");
  const [configError, setConfigError] = useState(false);

  const [tab, setTab] = useState("feed"); // feed | chats | profile

  const [tgUser, setTgUser] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [showAuth, setShowAuth] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);

  const [activeChat, setActiveChat] = useState(null);

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
    if (!currentUser || !supabase) {
      setProfile(null);
      setProfileChecked(true);
      return;
    }
    setProfileChecked(false);
    supabase
      .from("profiles")
      .select("*")
      .eq("ref", currentUser.ref)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data || null);
        setProfileChecked(true);
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

  async function handleCreate(newListing) {
    if (!supabase || !currentUser || !profile) return;
    const row = {
      id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...newListing,
      tint: CARD_TINTS[Math.floor(Math.random() * CARD_TINTS.length)],
      telegram_user_id: tgUser?.id || null,
      telegram_username: tgUser?.username || null,
      author_ref: currentUser.ref,
      author_name: profile.name,
    };
    const { error } = await supabase.from("listings").insert(row);
    if (error) {
      flashToast("Не получилось опубликовать — попробуй ещё раз");
      return;
    }
    setShowCreate(false);
    flashToast("Объявление опубликовано");
    loadListings();
  }

  const filtered = useMemo(() => {
    return listings
      .filter((l) => activeCat === "all" || l.category === activeCat)
      .filter((l) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return l.title.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q);
      });
  }, [listings, activeCat, search]);

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
            <div className="flex items-center gap-2">
              <div style={{ background: "#FFC93C", color: "#1C1F1B" }} className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm rotate-[-8deg]">Я</div>
              <h1 className="font-display font-bold text-xl md:text-2xl tracking-tight" style={{ color: "#F2EFE4" }}>ЯРМАРКА</h1>
            </div>
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
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto">
            <Pill active={activeCat === "all"} onClick={() => setActiveCat("all")} label="Всё" />
            {CATEGORIES.map((c) => (
              <Pill key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.label} Icon={c.icon} />
            ))}
          </div>
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
                  <p className="font-display font-bold text-white text-base md:text-lg leading-snug">Первые {FREE_LISTINGS_LIMIT} объявлений — бесплатно навсегда</p>
                  {currentUser && profile && (
                    <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full rotate-[-4deg]" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
                      {myListings.length}/{FREE_LISTINGS_LIMIT} бесплатных
                    </span>
                  )}
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
                      <ListingCard key={l.id} listing={l} onOpen={() => setShowDetail(l)} />
                    ))}
                  </div>
                )}
              </main>
            </>
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
                onOpenListing={(l) => setShowDetail(l)}
                onSupport={() => setActiveChat({ listingId: null, otherRef: SUPPORT_REF, otherName: "Поддержка" })}
                onLogout={async () => { if (supabase && currentUser.source === "site") await supabase.auth.signOut(); }}
              />
            ) : (
              <LoggedOutPrompt onLogin={() => setShowAuth(true)} text="Войди, чтобы посмотреть профиль" />
            )
          )}
        </>
      )}

      <BottomNav tab={tab} setTab={setTab} />

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} limitReached={currentUser && profile ? myListings.length >= FREE_LISTINGS_LIMIT : false} />
      )}

      {showDetail && (
        <DetailModal
          listing={showDetail}
          onClose={() => setShowDetail(null)}
          onMessageSeller={() => {
            if (!requireAuth()) return;
            const sellerRef = showDetail.author_ref;
            if (!sellerRef || sellerRef === currentUser.ref) { flashToast("Это твоё объявление"); return; }
            setActiveChat({ listingId: showDetail.id, otherRef: sellerRef, otherName: showDetail.author_name || "Продавец" });
            setShowDetail(null);
          }}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={() => { setShowAuth(false); flashToast("Готово"); }} />}

      {activeChat && currentUser && profile && (
        <ChatModal currentUser={currentUser} myName={profile.name} listingId={activeChat.listingId} otherRef={activeChat.otherRef} otherName={activeChat.otherName} onClose={() => setActiveChat(null)} />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-body font-semibold text-sm shadow-lg z-50 flex items-center gap-2" style={{ background: "#1C1F1B", color: "#F2EFE4" }}>
          <Check size={16} style={{ color: "#FFC93C" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "feed", label: "Лента", icon: Home },
    { id: "chats", label: "Сообщения", icon: MessageCircle },
    { id: "profile", label: "Профиль", icon: User },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-4" style={{ background: "#1C1F1B", borderColor: "#FFC93C" }}>
      <div className="max-w-6xl mx-auto flex">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button key={it.id} onClick={() => setTab(it.id)} className="flex-1 flex flex-col items-center gap-1 py-2.5">
              <it.icon size={19} color={active ? "#FFC93C" : "#8B8677"} />
              <span className="text-[10px] font-bold font-body" style={{ color: active ? "#FFC93C" : "#8B8677" }}>{it.label}</span>
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

function Pill({ active, onClick, label, Icon }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition font-body border"
      style={active ? { background: "#FFC93C", color: "#1C1F1B", borderColor: "#FFC93C" } : { background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}>
      {Icon && <Icon size={13} />}
      {label}
    </button>
  );
}

function ListingCard({ listing, onOpen }) {
  const Icon = catIcon(listing.category);
  const isFree = Number(listing.price) === 0;
  const cover = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  return (
    <button onClick={onOpen} className="text-left rounded-2xl overflow-hidden border-2 relative transition hover:-translate-y-1 hover:shadow-xl" style={{ background: listing.tint || "#EAE3F0", borderColor: "#1C1F1B22" }}>
      <div className="absolute top-3 right-3 w-3 h-3 rounded-full border-2 z-10" style={{ borderColor: cover ? "#F2EFE4" : "#1C1F1B55" }} />
      {isFree && (
        <div className="absolute top-5 left-[-30px] rotate-[-38deg] font-mono font-bold text-[10px] px-8 py-1 shadow z-10" style={{ background: "#FFC93C", color: "#1C1F1B" }}>ДАРОМ</div>
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
        <p className="font-mono font-bold text-lg mb-2" style={{ color: "#2F6B4F" }}>{isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}</p>
        <div className="flex items-center justify-between text-[11px] font-body" style={{ color: "#5B584E" }}>
          <span className="flex items-center gap-1"><MapPin size={11} /> {listing.city}</span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </button>
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

function CreateModal({ onClose, onSubmit, limitReached }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("electronics");
  const [city, setCity] = useState("Пермь");
  const [condition, setCondition] = useState("used");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [images, setImages] = useState([]);
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
    setError("");
    setSubmitting(true);
    await onSubmit({ title: title.trim(), price: price === "" ? 0 : Math.max(0, Number(price)), category, city, condition, description: description.trim(), contact: contact.trim(), images });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: "#F2EFE4", borderColor: "#1C1F1B22" }}>
          <h2 className="font-display font-bold text-base">Новое объявление</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        {limitReached ? (
          <div className="p-5">
            <p className="font-body text-sm mb-4">Бесплатный лимит — {FREE_LISTINGS_LIMIT} объявлений — исчерпан. Подписка на неограниченные объявления скоро появится.</p>
            <button onClick={onClose} style={{ background: "#1C1F1B" }} className="text-white py-3 rounded-lg font-body font-bold text-sm w-full">Понятно</button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
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
            <Field label="Описание"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Кратко расскажи о товаре" className="input resize-none" /></Field>
            <Field label="Контакт (телефон / телеграм)"><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username или +7..." className="input" /></Field>
            {error && <p className="text-xs font-bold" style={{ color: "#E1543D" }}>{error}</p>}
            <button onClick={submit} disabled={submitting} style={{ background: "#2F6B4F" }} className="text-white py-3 rounded-lg font-body font-bold text-sm mt-1 disabled:opacity-60">
              {submitting ? "Публикуем..." : "Опубликовать бесплатно"}
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

function DetailModal({ listing, onClose, onMessageSeller }) {
  const Icon = catIcon(listing.category);
  const isFree = Number(listing.price) === 0;
  const images = listing.images || [];
  const [activeImg, setActiveImg] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" style={{ background: "#F2EFE4" }}>
        {images.length > 0 ? (
          <div className="relative">
            <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1C1F1BCC" }}>
              <X size={16} color="#F2EFE4" />
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
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "#1C1F1B" }}>
              <Icon size={22} color="#F2EFE4" />
            </div>
            <h2 className="font-display font-bold text-lg mb-1 pr-8">{listing.title}</h2>
            <p className="font-mono font-black text-2xl" style={{ color: "#2F6B4F" }}>{isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}</p>
          </div>
        )}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4 text-xs font-bold" style={{ color: "#5B584E" }}>
            <span className="flex items-center gap-1"><MapPin size={13} /> {listing.city}</span>
            <span>{catLabel(listing.category)}</span>
            <span>{listing.condition === "new" ? "Новое" : "Б/у"}</span>
          </div>
          {listing.description && <p className="text-sm font-body leading-relaxed">{listing.description}</p>}
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "#E8E3D2" }}>
            <Phone size={16} style={{ color: "#2F6B4F" }} />
            <span className="font-mono font-bold text-sm">{listing.contact}</span>
          </div>
          {listing.author_name && (
            <p className="text-xs" style={{ color: "#8B8677" }}>Продавец: {listing.author_name}</p>
          )}
          <button onClick={onMessageSeller} className="flex items-center justify-center gap-2 py-3 rounded-lg font-body font-bold text-sm text-white" style={{ background: "#1C1F1B" }}>
            <MessageCircle size={16} /> Написать продавцу
          </button>
          <p className="text-[11px] text-center" style={{ color: "#8B8677" }}>Опубликовано {timeAgo(listing.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ currentUser, onDone }) {
  const [name, setName] = useState(currentUser.defaultName || "");
  const [city, setCity] = useState("Пермь");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase) return;
    if (!name.trim()) return setError("Укажи имя");
    setBusy(true);
    setError("");
    const row = { ref: currentUser.ref, name: name.trim(), city, source: currentUser.source };
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
          {currentUser.source === "telegram"
            ? "Заведи профиль на Ярмарке — привязывается к твоему Telegram-аккаунту."
            : "Заведи профиль, чтобы размещать объявления и писать в чат."}
        </p>
        <div className="flex flex-col gap-4">
          <Field label="Имя">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к тебе обращаться" className="input" />
          </Field>
          <Field label="Город">
            <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
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
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase) return;
    if (!email.trim() || !password) return setError("Заполни email и пароль");
    setBusy(true);
    setError("");
    const fn = mode === "signup" ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError(error.message.includes("already registered") ? "Такой email уже зарегистрирован — войди" : "Ошибка: проверь email и пароль");
      return;
    }
    onSuccess();
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
          <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="text-xs font-bold text-center" style={{ color: "#2F6B4F" }}>
            {mode === "signup" ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
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

function ProfileTab({ profile, currentUser, myListings, onOpenListing, onSupport, onLogout }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="rounded-2xl p-5 mb-6 flex items-center gap-4" style={{ background: "#fff", border: "2px solid #1C1F1B22" }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2F6B4F" }}>
          <span className="font-display font-bold text-xl text-white">{profile.name.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-base truncate">{profile.name}</p>
          <p className="text-xs" style={{ color: "#8B8677" }}>{profile.city} · {currentUser.source === "telegram" ? "Telegram" : "Сайт"}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={onSupport} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
          <LifeBuoy size={14} /> Поддержка
        </button>
        {currentUser.source === "site" && (
          <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-body font-bold text-xs border-2" style={{ borderColor: "#1C1F1B22" }}>
            <LogOut size={14} /> Выйти
          </button>
        )}
      </div>

      <h3 className="font-display font-bold text-sm mb-3">Мои объявления ({myListings.length})</h3>
      {myListings.length === 0 ? (
        <p className="text-sm" style={{ color: "#8B8677" }}>Ты ещё ничего не разместил</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myListings.map((l) => <ListingCard key={l.id} listing={l} onOpen={() => onOpenListing(l)} />)}
        </div>
      )}
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
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_ref.eq.${currentUser.ref},receiver_ref.eq.${currentUser.ref}`)
        .order("created_at", { ascending: false });
      const map = new Map();
      (data || []).forEach((m) => {
        const otherRef = m.sender_ref === currentUser.ref ? m.receiver_ref : m.sender_ref;
        const key = conversationKey(m.listing_id, otherRef);
        if (!map.has(key)) {
          map.set(key, {
            listingId: m.listing_id,
            otherRef,
            otherName: m.sender_ref === currentUser.ref ? otherRef : (m.sender_name || otherRef),
            lastMessage: m.content,
            lastAt: m.created_at,
          });
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
  const scrollRef = useRef(null);

  async function load() {
    if (!supabase) return;
    let query = supabase
      .from("messages")
      .select("*")
      .or(`and(sender_ref.eq.${currentUser.ref},receiver_ref.eq.${otherRef}),and(sender_ref.eq.${otherRef},receiver_ref.eq.${currentUser.ref})`)
      .order("created_at", { ascending: true });
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
    setText("");
    await supabase.from("messages").insert({ listing_id: listingId, sender_ref: currentUser.ref, receiver_ref: otherRef, sender_name: myName, content });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#1C1F1BCC" }}>
      <div className="w-full sm:max-w-md h-[85vh] sm:h-[600px] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden" style={{ background: "#F2EFE4" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#1C1F1B", borderColor: "#1C1F1B" }}>
          <button onClick={onClose}><ArrowLeft size={20} color="#F2EFE4" /></button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: otherRef === SUPPORT_REF ? "#FFC93C" : "#2F6B4F" }}>
            {otherRef === SUPPORT_REF ? <LifeBuoy size={14} color="#1C1F1B" /> : <User size={14} color="#fff" />}
          </div>
          <div>
            <p className="font-body font-bold text-sm" style={{ color: "#F2EFE4" }}>{otherRef === SUPPORT_REF ? "Поддержка" : otherName}</p>
            {listingId && <p className="text-[10px]" style={{ color: "#8B8677" }}>по объявлению</p>}
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {loading ? (
            <p className="text-center text-sm py-10" style={{ color: "#8B8677" }}>Загружаем...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm py-10" style={{ color: "#8B8677" }}>
              {otherRef === SUPPORT_REF ? "Напиши, если что-то не работает или есть вопрос" : "Начни диалог с продавцом"}
            </p>
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
    </div>
  );
}
