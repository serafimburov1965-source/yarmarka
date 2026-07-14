import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, X, MapPin, Phone, Smartphone, Wrench, Car,
  Shirt, Home, Gamepad2, Package, Check, Tag, ImagePlus
} from "lucide-react";
import { supabase } from "./supabaseClient";
import { initTelegram, getTelegramUser } from "./telegram";

const MAX_PHOTOS = 5;
const FREE_LISTINGS_LIMIT = 5;

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
  const [tgUser, setTgUser] = useState(null);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    initTelegram();
    setTgUser(getTelegramUser());
    loadListings();
  }, []);

  async function loadListings() {
    if (!supabase) {
      setConfigError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setListings(data || []);
    setLoading(false);
  }

  function flashToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  const myListingsCount = useMemo(() => {
    if (!tgUser) return 0;
    return listings.filter((l) => l.telegram_user_id === tgUser.id).length;
  }, [listings, tgUser]);

  async function handleCreate(newListing) {
    if (!supabase) return;
    const row = {
      id: `l_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...newListing,
      tint: CARD_TINTS[Math.floor(Math.random() * CARD_TINTS.length)],
      telegram_user_id: tgUser?.id || null,
      telegram_username: tgUser?.username || null,
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
        return (
          l.title.toLowerCase().includes(q) ||
          (l.description || "").toLowerCase().includes(q)
        );
      });
  }, [listings, activeCat, search]);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-body text-center" style={{ background: "#F2EFE4" }}>
        <div>
          <p className="font-display font-bold mb-2">База данных не подключена</p>
          <p className="text-sm" style={{ color: "#5B584E" }}>
            Заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — инструкция в README.md
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-body" style={{ background: "#F2EFE4", color: "#1C1F1B" }}>
      <style>{FONT_STYLE}</style>

      <header style={{ background: "#1C1F1B" }} className="sticky top-0 z-30 border-b-4">
        <div style={{ borderColor: "#FFC93C" }} className="border-b-4">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div style={{ background: "#FFC93C", color: "#1C1F1B" }} className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm rotate-[-8deg]">
                Я
              </div>
              <h1 className="font-display font-bold text-xl md:text-2xl tracking-tight" style={{ color: "#F2EFE4" }}>
                ЯРМАРКА
              </h1>
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8B8677" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Найти что угодно..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg outline-none font-body text-sm"
                style={{ background: "#F2EFE4", color: "#1C1F1B" }}
              />
            </div>

            <button
              onClick={() => setShowCreate(true)}
              style={{ background: "#2F6B4F" }}
              className="flex items-center gap-1.5 text-white px-4 py-2.5 rounded-lg font-body font-bold text-sm hover:brightness-110 transition"
            >
              <Plus size={16} strokeWidth={3} />
              Разместить
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-2.5 flex gap-2 overflow-x-auto">
          <Pill active={activeCat === "all"} onClick={() => setActiveCat("all")} label="Всё" />
          {CATEGORIES.map((c) => (
            <Pill key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} label={c.label} Icon={c.icon} />
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "#2F6B4F" }}>
          <p className="font-display font-bold text-white text-base md:text-lg leading-snug">
            Первые {FREE_LISTINGS_LIMIT} объявлений — бесплатно навсегда
          </p>
          {tgUser && (
            <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-full rotate-[-4deg]" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
              {myListingsCount}/{FREE_LISTINGS_LIMIT} бесплатных
            </span>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-24 font-body" style={{ color: "#8B8677" }}>Загружаем объявления...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} hasAny={listings.length > 0} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onOpen={() => setShowDetail(l)} />
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          limitReached={tgUser ? myListingsCount >= FREE_LISTINGS_LIMIT : false}
        />
      )}
      {showDetail && <DetailModal listing={showDetail} onClose={() => setShowDetail(null)} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full font-body font-semibold text-sm shadow-lg z-50 flex items-center gap-2" style={{ background: "#1C1F1B", color: "#F2EFE4" }}>
          <Check size={16} style={{ color: "#FFC93C" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Pill({ active, onClick, label, Icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition font-body border"
      style={active ? { background: "#FFC93C", color: "#1C1F1B", borderColor: "#FFC93C" } : { background: "transparent", color: "#F2EFE4", borderColor: "#3A3D37" }}
    >
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
    <button
      onClick={onOpen}
      className="text-left rounded-2xl overflow-hidden border-2 relative transition hover:-translate-y-1 hover:shadow-xl"
      style={{ background: listing.tint || "#EAE3F0", borderColor: "#1C1F1B22" }}
    >
      <div className="absolute top-3 right-3 w-3 h-3 rounded-full border-2 z-10" style={{ borderColor: cover ? "#F2EFE4" : "#1C1F1B55" }} />
      {isFree && (
        <div className="absolute top-5 left-[-30px] rotate-[-38deg] font-mono font-bold text-[10px] px-8 py-1 shadow z-10" style={{ background: "#FFC93C", color: "#1C1F1B" }}>
          ДАРОМ
        </div>
      )}
      {cover ? (
        <div className="w-full aspect-[4/3] overflow-hidden">
          <img src={cover} alt={listing.title} className="w-full h-full object-cover" />
        </div>
      ) : null}
      <div className={cover ? "p-4" : "p-4 pt-8"}>
        {!cover && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#1C1F1B" }}>
            <Icon size={18} color="#F2EFE4" />
          </div>
        )}
        <h3 className="font-body font-bold text-sm mb-1 line-clamp-2" style={{ color: "#1C1F1B" }}>{listing.title}</h3>
        <p className="font-mono font-bold text-lg mb-2" style={{ color: "#2F6B4F" }}>
          {isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}
        </p>
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
      <p className="font-body text-sm mb-5" style={{ color: "#5B584E" }}>
        {hasAny ? "Попробуй другой запрос или категорию." : "Стань первым, кто разместит объявление — это бесплатно и займёт минуту."}
      </p>
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
    await onSubmit({
      title: title.trim(),
      price: price === "" ? 0 : Math.max(0, Number(price)),
      category,
      city,
      condition,
      description: description.trim(),
      contact: contact.trim(),
      images,
    });
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
            <p className="font-body text-sm mb-4">
              Бесплатный лимит — {FREE_LISTINGS_LIMIT} объявлений — исчерпан. Подписка на неограниченные объявления скоро появится.
            </p>
            <button onClick={onClose} style={{ background: "#1C1F1B" }} className="text-white py-3 rounded-lg font-body font-bold text-sm w-full">Понятно</button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <Field label="Название">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: iPhone 13, 128GB" className="input" />
            </Field>

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

            <Field label="Цена, ₽ (0 = даром)">
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" inputMode="numeric" className="input font-mono" />
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

            <Field label="Описание">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Кратко расскажи о товаре" className="input resize-none" />
            </Field>

            <Field label="Контакт (телефон / телеграм)">
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@username или +7..." className="input" />
            </Field>

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

function DetailModal({ listing, onClose }) {
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
              <p className="font-mono font-black text-2xl" style={{ color: "#2F6B4F" }}>
                {isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ background: listing.tint || "#EAE3F0" }} className="p-6 relative">
            <button onClick={onClose} className="absolute top-4 right-4"><X size={20} /></button>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "#1C1F1B" }}>
              <Icon size={22} color="#F2EFE4" />
            </div>
            <h2 className="font-display font-bold text-lg mb-1 pr-8">{listing.title}</h2>
            <p className="font-mono font-black text-2xl" style={{ color: "#2F6B4F" }}>
              {isFree ? "Даром" : `${Number(listing.price).toLocaleString("ru-RU")} ₽`}
            </p>
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
          <p className="text-[11px] text-center" style={{ color: "#8B8677" }}>Опубликовано {timeAgo(listing.created_at)}</p>
        </div>
      </div>
    </div>
  );
}
