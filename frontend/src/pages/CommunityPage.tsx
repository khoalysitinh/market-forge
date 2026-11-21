import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type Channel = { id: string; label: string; unread?: number };
type SampleRoom = { id: string; name: string; topic: string; people: number; accent: string };

const INITIAL_ROOMS: SampleRoom[] = [
  { id: "futures", name: "Futures desk", topic: "Phân tích xu hướng · mô phỏng", people: 8, accent: "blue" },
  { id: "forex", name: "Forex lounge", topic: "EUR/USD · phiên London", people: 5, accent: "pink" },
  { id: "arena", name: "Demo arena", topic: "Thử thách nhóm · 12 phút", people: 3, accent: "ice" },
];

const TEXT_CHANNELS: Channel[] = [
  { id: "welcome", label: "welcome" },
  { id: "announcements", label: "announcements", unread: 2 },
  { id: "market-floor", label: "market-floor", unread: 4 },
  { id: "trade-journal", label: "trade-journal" },
];

const MEMBERS = [
  { name: "Minh Khoa", role: "Moderator", initials: "MK", color: "blue", status: "Đang phân tích EUR/USD" },
  { name: "Linh Trần", role: "Moderator", initials: "LT", color: "pink", status: "Đang ở Futures desk" },
  { name: "An Nguyễn", role: "Member", initials: "AN", color: "ice", status: "Vừa tham gia" },
  { name: "Bao Pham", role: "Member", initials: "BP", color: "blue", status: "Đang xem market-floor" },
  { name: "Nhi Le", role: "Member", initials: "NL", color: "pink", status: "Đang ở Demo arena" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: "M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5z M9 21v-7h6v7",
    plus: "M12 5v14M5 12h14",
    compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M15.8 8.2 13 13l-4.8 2.8L11 11z",
    search: "m20 20-4.2-4.2 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
    chevron: "m7 10 5 5 5-5",
    hash: "M4 9h16M4 15h16M10 3 8 21m8-18-2 18",
    speaker: "M4 9v6h4l5 4V5L8 9H4Z M17 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12",
    people: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7.5a4 4 0 0 1 0 7.7M20 15a4 4 0 0 1 2 3.5V21",
    inbox: "M4 4h16v16H4z M4 13h4l2 3h4l2-3h4",
    menu: "M4 6h16M4 12h16M4 18h16",
    help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-2.7-12a2.8 2.8 0 1 1 4.8 2c-1.3 1.2-2.1 1.5-2.1 3m0 3h.01",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
    gift: "M20 12v10H4V12m18-5H2v5h20zM12 7v15M12 7H7.5a2.5 2.5 0 1 1 2.5-2c0 2 2 2 2 2Zm0 0h4.5a2.5 2.5 0 1 0-2.5-2c0 2-2 2-2 2Z",
    smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0",
    pin: "M16 3l5 5-4 1-4 5-1 4-3-3-5 5-1-1 5-5-3-3 4-1 5-4z",
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] ?? paths.hash} />
    </svg>
  );
}

function Avatar({ initials, color, online = false, size = "md" }: { initials: string; color: string; online?: boolean; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-[22px] text-[7px]" : size === "lg" ? "size-[42px] text-[11px]" : "size-[34px] text-[9px]";
  const colorClass =
    color === "pink"
      ? "bg-linear-to-br from-[#FF2D95] to-[#0A0A0A] text-[#DBF2FC]"
      : color === "ice"
        ? "bg-linear-to-br from-[#DBF2FC]/30 to-[#007BA7]/40 text-[#DBF2FC]"
        : "bg-linear-to-br from-[#007BA7] to-[#0A0A0A] text-[#DBF2FC]";

  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full font-extrabold tracking-[-0.04em] ${sizeClass} ${colorClass}`}>
      {initials}
      {online && <i aria-label="Online" className="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[#0A0A0A] bg-[#007BA7]" />}
    </span>
  );
}

const roomAccentClasses = (accent: string) =>
  accent === "pink"
    ? "bg-[#FF2D95]/20 text-[#FF2D95]"
    : accent === "ice"
      ? "bg-[#DBF2FC]/15 text-[#DBF2FC]"
      : "bg-[#007BA7]/25 text-[#DBF2FC]";

export function CommunityPage() {
  const [channel, setChannel] = useState("market-floor");
  const [activeRoom, setActiveRoom] = useState("futures");
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [notice, setNotice] = useState("");
  const createTrigger = useRef<HTMLElement | null>(null);
  const createDialog = useRef<HTMLFormElement | null>(null);
  const filteredChannels = useMemo(() => TEXT_CHANNELS.filter((item) => item.label.includes(search.trim().toLowerCase())), [search]);
  const selectedRoom = rooms.find((room) => room.id === activeRoom) ?? rooms[0];
  const selectedChannel = TEXT_CHANNELS.find((item) => item.id === channel) ?? { id: "market-floor", label: "market-floor" };

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 460px)");
    const compactQuery = window.matchMedia("(max-width: 820px)");
    const syncViewport = () => { setIsMobile(mobileQuery.matches); setIsCompact(compactQuery.matches); };
    syncViewport();
    mobileQuery.addEventListener("change", syncViewport);
    compactQuery.addEventListener("change", syncViewport);
    return () => { mobileQuery.removeEventListener("change", syncViewport); compactQuery.removeEventListener("change", syncViewport); };
  }, []);

  function openCreateRoom(trigger: HTMLElement) {
    createTrigger.current = trigger;
    setShowCreate(true);
  }

  function closeCreateRoom() {
    setShowCreate(false);
    window.requestAnimationFrame(() => createTrigger.current?.focus());
  }

  function trapDialogFocus(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") { closeCreateRoom(); return; }
    if (event.key !== "Tab" || !createDialog.current) return;
    const focusable = Array.from(createDialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  function createPreviewRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = roomName.trim();
    if (!name) return;
    const id = `preview-${Date.now()}`;
    setRooms((current) => [...current, { id, name, topic: "Phòng mẫu · chưa kết nối máy chủ", people: 1, accent: "blue" }]);
    setActiveRoom(id);
    setRoomName("");
    closeCreateRoom();
    setNotice("Đã thêm phòng minh họa vào bản xem trước. Chưa tạo room trên máy chủ.");
    window.setTimeout(() => setNotice(""), 3600);
  }

  function sendPreviewMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setNotice("Khung chat đang là bản xem trước; tin nhắn chưa được gửi hoặc lưu.");
    setMessage("");
    window.setTimeout(() => setNotice(""), 3600);
  }

  return (
    <div className="relative flex size-full min-h-0 overflow-hidden bg-[#0A0A0A] font-sans text-[13px] text-[#DBF2FC]">
      {/* Server Rail */}
      <aside className="z-10 flex w-[56px] shrink-0 flex-col items-center gap-2.5 border-r border-[#DBF2FC]/10 bg-[#0A0A0A] pb-2.5 pt-3 sm:w-[72px]" aria-label="Server navigation">
        <a
          href="/"
          className="grid size-[42px] shrink-0 place-items-center rounded-full bg-[#DBF2FC]/10 text-[#DBF2FC] transition hover:rounded-2xl hover:bg-[#007BA7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007BA7] sm:size-12"
          aria-label="Market Forge home"
        >
          <Icon name="home" size={21} />
        </a>
        <span className="my-0.5 h-0.5 w-8 rounded-sm bg-[#DBF2FC]/15" />
        <button
          className="relative grid size-[42px] shrink-0 cursor-pointer place-items-center rounded-2xl bg-[#007BA7] text-[#DBF2FC] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007BA7] sm:size-12"
          aria-label="Market Forge community"
        >
          <span className="grid size-8 place-items-center rounded-[11px] bg-linear-to-br from-[#007BA7] to-[#FF2D95] text-[11px] font-black tracking-[-0.06em] text-[#DBF2FC]">MF</span>
          <i className="absolute -left-3 h-[30px] w-1 rounded-r bg-[#DBF2FC]" />
        </button>
        <button
          className="grid size-[42px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#DBF2FC]/10 text-[#007BA7] transition hover:rounded-2xl hover:bg-[#007BA7] hover:text-[#DBF2FC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007BA7] sm:size-12"
          onClick={(event) => openCreateRoom(event.currentTarget)}
          aria-label="Tạo phòng mới"
        >
          <Icon name="plus" />
        </button>
        <button
          className="grid size-[42px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#DBF2FC]/10 text-[#FF2D95] transition hover:rounded-2xl hover:bg-[#FF2D95] hover:text-[#0A0A0A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007BA7] sm:size-12"
          onClick={() => setNotice("Khám phá community sẽ được kết nối sau khi có API danh sách công khai.")}
          aria-label="Khám phá community"
        >
          <Icon name="compass" />
        </button>
        <div className="mt-auto grid justify-items-center gap-2.5">
          <button
            className="grid size-[42px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#DBF2FC]/10 text-[#DBF2FC]/80 transition hover:rounded-2xl hover:bg-[#007BA7] hover:text-[#DBF2FC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007BA7] sm:size-12"
            onClick={() => setNotice("Đây là prototype community của Market Forge.")}
            aria-label="Thông tin"
          >
            <Icon name="help" />
          </button>
          <Avatar initials="TB" color="blue" online />
        </div>
      </aside>

      {/* Channel Sidebar */}
      <aside
        id="community-channel-sidebar"
        aria-hidden={isMobile && !showChannels}
        inert={isMobile && !showChannels}
        className={`flex min-h-0 flex-col border-r border-[#DBF2FC]/10 bg-[#0E1116] transition-transform duration-200 max-[460px]:absolute max-[460px]:inset-y-0 max-[460px]:left-[56px] max-[460px]:z-[9] max-[460px]:w-[min(250px,calc(100vw-112px))] max-[460px]:shadow-[12px_0_30px_rgba(0,0,0,0.45)] ${
          showChannels ? "max-[460px]:translate-x-0" : "max-[460px]:-translate-x-[110%]"
        } min-[461px]:w-[192px] min-[461px]:shrink-0 min-[621px]:w-[228px] min-[821px]:w-[250px]`}
      >
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#DBF2FC]/10 px-4">
          <div>
            <p className="m-0 text-sm font-extrabold tracking-[0.04em] text-[#DBF2FC]">MARKET FORGE</p>
            <span className="text-[10px] text-[#DBF2FC]/50">Trading dojo · community</span>
          </div>
          <button
            className="grid size-7 cursor-pointer place-items-center rounded bg-transparent text-[#DBF2FC]/65 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]"
            aria-label="Tùy chọn server"
            onClick={() => setNotice("Cài đặt server sẽ được bổ sung sau.")}
          >
            <Icon name="chevron" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2.5 py-3">
          <div className="flex items-center gap-1.5 px-2 pb-3 font-mono text-[8px] tracking-[0.12em] text-[#DBF2FC]/70">
            <span className="size-1.5 rounded-full bg-[#007BA7] shadow-[0_0_8px_rgba(0,123,167,0.8)]" /> BẢN XEM TRƯỚC <span className="text-[#DBF2FC]/40">· DATA MINH HỌA</span>
          </div>

          <button
            className="mb-4 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-[#007BA7]/35 bg-linear-to-r from-[#007BA7]/20 to-[#007BA7]/5 px-2 py-2.5 text-left transition hover:border-[#007BA7]/70 hover:bg-[#007BA7]/25"
            onClick={() => setNotice("API hiện hỗ trợ room riêng bằng mã mời; chưa có public discovery.")}
          >
            <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-[#007BA7]/30 text-[#DBF2FC]"><Icon name="compass" /></span>
            <span>
              <b className="block text-[11px] text-[#DBF2FC]">Tìm đồng đội</b>
              <small className="mt-0.5 block text-[9px] text-[#DBF2FC]/60">Khám phá các phòng đang mở</small>
            </span>
            <span className="ml-auto rounded border border-[#FF2D95]/35 px-1 py-0.5 font-mono text-[7px] text-[#FF2D95]">SẮP CÓ</span>
          </button>

          <div className="flex h-[31px] items-center justify-between pl-2 pr-1 text-[9px] font-extrabold tracking-[0.08em] text-[#DBF2FC]/55">
            <span>KÊNH CỘNG ĐỒNG</span>
            <button className="grid size-6 cursor-pointer place-items-center rounded text-[#DBF2FC]/60 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]" aria-label="Tùy chọn category">
              <Icon name="more" />
            </button>
          </div>

          <nav aria-label="Community channels" className="grid gap-0.5">
            {filteredChannels.map((item) => (
              <button
                key={item.id}
                onClick={() => { setChannel(item.id); setShowChannels(false); }}
                className={`flex h-[33px] w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left transition ${
                  channel === item.id
                    ? "bg-[#007BA7]/25 text-[#DBF2FC]"
                    : "bg-transparent text-[#DBF2FC]/60 hover:bg-[#DBF2FC]/5 hover:text-[#DBF2FC]"
                }`}
              >
                <Icon name="hash" size={17} />
                <span className="flex-1">{item.label}</span>
                {item.unread && (
                  <b className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF2D95] px-1 text-[10px] text-[#0A0A0A]">
                    {item.unread}
                  </b>
                )}
              </button>
            ))}
            {filteredChannels.length === 0 && <p className="p-2 text-[11px] text-[#DBF2FC]/50">Không tìm thấy kênh.</p>}
          </nav>

          <div className="mt-3 flex h-[31px] items-center justify-between pl-2 pr-1 text-[9px] font-extrabold tracking-[0.08em] text-[#DBF2FC]/55">
            <span>PHÒNG LUYỆN TẬP <b className="ml-1 text-[8px] text-[#DBF2FC]/40">{rooms.length}</b></span>
            <button className="grid size-6 cursor-pointer place-items-center rounded text-[#DBF2FC]/60 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]" aria-label="Tạo phòng luyện tập" onClick={(event) => openCreateRoom(event.currentTarget)}>
              <Icon name="plus" />
            </button>
          </div>

          <div className="grid gap-1">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`flex min-h-[49px] min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                  activeRoom === room.id
                    ? "bg-[#007BA7]/20 shadow-[inset_2px_0_#007BA7]"
                    : "bg-transparent hover:bg-[#DBF2FC]/5"
                }`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xl ${roomAccentClasses(room.accent)}`}>⌁</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[10px] font-semibold text-[#DBF2FC]">{room.name}</b>
                  <small className="mt-0.5 block truncate text-[8px] text-[#DBF2FC]/55">{room.topic}</small>
                </span>
                <span className="flex items-center gap-1 text-[9px] text-[#DBF2FC]/65">
                  <i className="size-[5px] rounded-full bg-[#007BA7]" />{room.people}
                </span>
              </button>
            ))}
          </div>

          <button
            className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-[#DBF2FC]/20 bg-transparent p-2.5 text-[10px] text-[#DBF2FC]/75 transition hover:border-[#007BA7] hover:text-[#DBF2FC]"
            onClick={(event) => openCreateRoom(event.currentTarget)}
          >
            <Icon name="plus" size={16} /> Tạo phòng luyện tập
          </button>
          <button
            className="mx-1 my-2 flex cursor-pointer gap-2 bg-transparent text-left text-[11px] text-[#DBF2FC]/55 transition hover:text-[#DBF2FC]"
            onClick={() => setNotice("Join room sẽ dùng invite code 10 ký tự qua API /rooms/join.")}
          >
            ↗ <span>Tham gia bằng mã mời</span>
          </button>
        </div>

        <div className="flex h-[58px] shrink-0 items-center gap-2.5 border-t border-[#DBF2FC]/10 bg-[#0A0A0A] px-2.5">
          <Avatar initials="TB" color="blue" online />
          <div className="min-w-0 flex-1">
            <b className="block text-[10px] text-[#DBF2FC]">tranb</b>
            <small className="mt-0.5 block text-[8px] text-[#DBF2FC]/55">Member · preview</small>
          </div>
          <button className="grid size-7 cursor-pointer place-items-center rounded text-[#DBF2FC]/65 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]" aria-label="Tùy chọn người dùng" onClick={() => setNotice("Tài khoản sẽ lấy từ /auth/me khi kết nối backend.")}>
            <Icon name="more" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#0A0A0A]">
        <header className="z-[1] flex h-[58px] shrink-0 items-center justify-between gap-3.5 border-b border-[#DBF2FC]/10 px-2.5 sm:px-[18px]">
          <div className="flex min-w-0 items-center gap-2 text-[#DBF2FC]">
            <button
              className="hidden size-7 cursor-pointer place-items-center rounded bg-transparent text-[#DBF2FC]/75 hover:bg-[#DBF2FC]/10 max-[460px]:grid"
              aria-label="Mở danh sách kênh"
              aria-controls="community-channel-sidebar"
              aria-expanded={showChannels}
              onClick={() => setShowChannels((open) => !open)}
            >
              <Icon name="menu" size={17} />
            </button>
            <Icon name="hash" size={19} />
            <strong className="truncate text-[13px]">{selectedChannel.label}</strong>
            <span className="mx-1 hidden h-5 w-px bg-[#DBF2FC]/15 sm:block" />
            <span className="hidden truncate text-[10px] text-[#DBF2FC]/60 sm:block">Nơi cả nhóm cùng đọc thị trường và chia sẻ luận điểm</span>
          </div>

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            <button className="hidden size-[29px] shrink-0 cursor-pointer place-items-center text-[#DBF2FC]/70 hover:text-[#DBF2FC] min-[461px]:grid" aria-label="Thông báo" onClick={() => setNotice("Thông báo mẫu · chưa kết nối.")}>
              <Icon name="bell" />
            </button>
            <button className="grid size-[29px] shrink-0 cursor-pointer place-items-center text-[#DBF2FC]/70 hover:text-[#DBF2FC]" aria-label="Danh sách thành viên" aria-controls="community-member-sidebar" aria-expanded={showMembers} onClick={() => setShowMembers((open) => !open)}>
              <Icon name="people" />
            </button>
            <label className="hidden h-[29px] w-[115px] items-center gap-1.5 rounded bg-[#141820] px-2 text-[#DBF2FC]/60 min-[361px]:flex sm:w-[166px]">
              <Icon name="search" size={15} />
              <input
                aria-label="Tìm kênh"
                placeholder="Tìm kênh"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-[57px] min-w-0 flex-1 bg-transparent text-[9px] text-[#DBF2FC] outline-none placeholder:text-[#DBF2FC]/45 sm:w-[83px]"
              />
              <kbd className="hidden rounded border border-[#DBF2FC]/15 px-1 py-0.5 text-[8px] text-[#DBF2FC]/55 sm:inline">⌘ K</kbd>
            </label>
            <button className="hidden size-[29px] shrink-0 cursor-pointer place-items-center text-[#DBF2FC]/70 hover:text-[#DBF2FC] min-[361px]:grid" aria-label="Hộp thư" onClick={() => setNotice("Inbox sẽ được thiết kế trong phiên sau.")}>
              <Icon name="inbox" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[970px] px-3 pb-7 pt-4 sm:px-[clamp(18px,4vw,48px)] sm:pt-5">
            {/* Hero Banner */}
            <div className="relative flex min-h-[158px] items-center overflow-hidden rounded-[11px] border border-[#007BA7]/30 bg-linear-to-br from-[#007BA7]/25 via-[#0A0A0A] to-[#FF2D95]/15 px-4 py-4 sm:min-h-[173px] sm:px-7 sm:py-6">
              <div className="pointer-events-none absolute -top-[130px] right-[10%] size-[340px] rounded-full bg-[radial-gradient(circle,rgba(0,123,167,0.35),transparent_70%)] blur-xl" />
              <div className="relative z-[1] max-w-[570px]">
                <div className="flex items-center gap-2 font-mono text-[8px] tracking-[0.17em] text-[#DBF2FC]/85">
                  <span className="size-1.5 rounded-full bg-[#007BA7] shadow-[0_0_8px_#007BA7]" /> MARKET FORGE · TRADING DOJO
                </div>
                <h1 className="mb-1.5 mt-3 max-w-[590px] text-[clamp(23px,3.2vw,36px)] font-bold leading-[1.08] tracking-[-0.045em] text-[#DBF2FC]">
                  {channel === "welcome" ? "Chào mừng đến với dojo." : channel === "announcements" ? "Thông báo từ cộng đồng." : channel === "trade-journal" ? "Nhật ký quyết định." : "Cùng đọc nhịp thị trường."}
                </h1>
                <p className="m-0 max-w-[520px] text-[11px] leading-relaxed text-[#DBF2FC]/75">
                  {channel === "market-floor" ? "Một nơi để đặt giả thuyết, lắng nghe góc nhìn khác và rèn quy trình giao dịch cùng nhau." : "Cộng đồng học tập và thực hành trên dữ liệu thị trường mô phỏng."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[8px] text-[#DBF2FC]/75">
                  <span className="flex items-center gap-1.5">
                    <i className="size-1.5 rounded-full bg-[#007BA7]" /> 18 thành viên online <em className="not-italic text-[#DBF2FC]/50">· minh họa</em>
                  </span>
                  <span className="h-3 w-px bg-[#DBF2FC]/20" />
                  <span>THỰC HÀNH · TRAO ĐỔI · TIẾN BỘ</span>
                </div>
              </div>
              <div className="absolute -right-7 top-1/2 grid size-[135px] place-items-center rounded-full border border-[#007BA7]/35 opacity-40 shadow-[0_0_35px_rgba(0,123,167,0.15),inset_0_0_28px_rgba(255,45,149,0.12)] [transform:translateY(-50%)_rotate(-18deg)_scaleY(0.62)] sm:right-[8%] sm:opacity-100" aria-hidden="true">
                <div className="absolute inset-[13px] rounded-full border border-[#FF2D95]/30" />
                <div className="absolute inset-7 rounded-full border border-[#DBF2FC]/15" />
                <span className="grid size-[52px] place-items-center rounded-[17px] border border-[#DBF2FC]/20 bg-linear-to-br from-[#007BA7] to-[#0A0A0A] font-extrabold text-[#DBF2FC] [transform:scaleY(1.61)_rotate(18deg)]">MF</span>
                <i className="absolute right-[30px] top-[5px] size-2 rounded-full bg-[#FF2D95] shadow-[0_0_13px_#FF2D95]" />
              </div>
            </div>

            {/* Section Heading */}
            <div className="mb-3 mt-7 flex items-end justify-between gap-4">
              <div>
                <span className="flex items-center gap-2 font-mono text-[8px] tracking-[0.17em] text-[#007BA7]">
                  ĐANG DIỄN RA <i className="size-[3px] rounded-full bg-[#DBF2FC]/40" /> PREVIEW
                </span>
                <h2 className="mb-0.5 mt-1.5 text-base font-bold tracking-[-0.02em] text-[#DBF2FC] sm:text-lg">Phòng luyện tập</h2>
                <p className="m-0 text-[10px] text-[#DBF2FC]/55">Chọn một nhóm để xem không gian hoạt động.</p>
              </div>
              <button
                className="flex h-[33px] cursor-pointer items-center gap-1.5 rounded-md border border-[#DBF2FC]/15 bg-[#DBF2FC]/[0.04] px-2.5 text-[10px] text-[#DBF2FC] transition hover:border-[#007BA7] hover:bg-[#007BA7]/25"
                onClick={(event) => openCreateRoom(event.currentTarget)}
              >
                <Icon name="plus" size={16} /> Tạo room
              </button>
            </div>

            {/* Room Cards */}
            <div className="grid grid-cols-1 gap-2.5 min-[461px]:grid-cols-2 min-[1121px]:grid-cols-[repeat(3,minmax(0,1fr))_minmax(145px,0.75fr)]">
              {rooms.map((room, index) => (
                <button
                  key={room.id}
                  className={`relative flex min-h-[126px] min-w-0 cursor-pointer flex-col items-stretch overflow-hidden rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:border-[#007BA7]/60 ${
                    activeRoom === room.id
                      ? "border-[#007BA7] bg-[#007BA7]/10 shadow-[inset_0_0_0_1px_rgba(0,123,167,0.15),0_5px_20px_rgba(0,123,167,0.1)]"
                      : "border-[#DBF2FC]/10 bg-[#12161D] hover:bg-[#161B24]"
                  }`}
                  onClick={() => setActiveRoom(room.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid size-[29px] place-items-center rounded-lg text-[21px] ${roomAccentClasses(room.accent)}`}>
                      {index === 0 ? "↗" : index === 1 ? "⌁" : "◈"}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[7px] text-[#DBF2FC]/70">
                      <i className="size-[5px] rounded-full bg-[#007BA7]" /> {room.people} ĐANG Ở ĐÂY
                    </span>
                  </div>
                  <h3 className="mb-0.5 mt-2.5 truncate text-xs font-bold text-[#DBF2FC]">{room.name}</h3>
                  <p className="m-0 truncate text-[9px] text-[#DBF2FC]/55">{room.topic}</p>
                  <div className="mt-auto flex items-center gap-1.5 pt-2.5 text-[8px] text-[#DBF2FC]/55">
                    <div className="flex pl-1">
                      <Avatar initials="MK" color="blue" size="sm" />
                      <span className="-ml-1.5 rounded-full border-2 border-[#12161D]"><Avatar initials="LT" color="pink" size="sm" /></span>
                      <span className="-ml-1.5 rounded-full border-2 border-[#12161D]"><Avatar initials="AN" color="ice" size="sm" /></span>
                    </div>
                    <span className="flex-1">{room.people} người · phiên nhóm</span>
                    <b className="text-[13px] text-[#FF2D95]">↗</b>
                  </div>
                </button>
              ))}
              <button
                className="flex min-h-[126px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#DBF2FC]/20 bg-[#DBF2FC]/[0.02] p-3 text-[#DBF2FC]/80 transition hover:border-[#007BA7] hover:bg-[#007BA7]/10"
                onClick={(event) => openCreateRoom(event.currentTarget)}
              >
                <span className="mb-0.5 grid size-[29px] place-items-center rounded-full bg-[#007BA7]/25 text-[#DBF2FC]"><Icon name="plus" size={20} /></span>
                <b className="text-[9px]">Mở một phòng mới</b>
                <small className="max-w-[120px] text-center text-[8px] leading-normal text-[#DBF2FC]/50">Tạo không gian luyện tập cho nhóm bạn</small>
              </button>
            </div>

            {/* Active Room Banner */}
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#DBF2FC]/10 bg-[#12161D] p-3">
              <div className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] text-[25px] ${roomAccentClasses(selectedRoom?.accent ?? "blue")}`}>⌁</div>
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[7px] tracking-[0.12em] text-[#007BA7]">PHÒNG ĐANG CHỌN · MINH HỌA</span>
                <h2 className="my-0.5 truncate text-xs font-bold text-[#DBF2FC]">{selectedRoom?.name ?? "Chưa có phòng"}</h2>
                <p className="m-0 truncate text-[9px] text-[#DBF2FC]/60">{selectedRoom?.topic ?? "Tạo phòng đầu tiên để bắt đầu."}</p>
              </div>
              <button
                className="flex h-[29px] cursor-pointer items-center gap-2 rounded bg-[#007BA7] px-2.5 text-[9px] font-bold text-[#DBF2FC] transition hover:bg-[#FF2D95] hover:text-[#0A0A0A]"
                onClick={() => setNotice("Room API hiện hỗ trợ phòng riêng bằng invite code; chưa có public join.")}
              >
                Xem phòng <span className="text-[13px]">→</span>
              </button>
            </div>

            {channel !== "market-floor" ? (
              <section className="my-4 grid min-h-[230px] content-center justify-items-start rounded-[9px] border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.025] p-6">
                <span className="mb-3.5 grid size-10 place-items-center rounded-xl bg-[#007BA7]/25 text-[#DBF2FC]"><Icon name="hash" size={22} /></span>
                <span className="font-mono text-[8px] tracking-[0.17em] text-[#007BA7]">KÊNH CỘNG ĐỒNG · PREVIEW</span>
                <h2 className="mb-1 mt-1.5 text-[17px] font-bold text-[#DBF2FC]">{selectedChannel.label}</h2>
                <p className="m-0 max-w-[490px] text-[10px] leading-relaxed text-[#DBF2FC]/65">
                  {channel === "welcome"
                    ? "Bắt đầu bằng cách giới thiệu bản thân, chọn một phòng luyện tập và cùng nhóm thống nhất nguyên tắc trao đổi."
                    : channel === "announcements"
                      ? "Các cập nhật về phiên luyện tập, sự kiện cộng đồng và thay đổi sản phẩm sẽ xuất hiện tại đây."
                      : "Ghi lại luận điểm, điều kiện vô hiệu và bài học sau mỗi phiên mô phỏng."}
                </p>
                <button
                  className="mt-4 flex cursor-pointer items-center gap-2 rounded bg-[#007BA7]/25 px-2.5 py-2 text-[9px] text-[#DBF2FC] hover:bg-[#007BA7]/40"
                  onClick={() => setChannel("market-floor")}
                >
                  Quay lại market-floor <span>→</span>
                </button>
              </section>
            ) : (
              <>
                <div className="mb-1.5 mt-5 flex items-center gap-3 font-mono text-[8px] tracking-[0.11em] text-[#DBF2FC]/45 before:h-px before:flex-1 before:bg-[#DBF2FC]/10 after:h-px after:flex-1 after:bg-[#DBF2FC]/10">
                  <span>HÔM NAY · DÒNG TRAO ĐỔI MẪU</span>
                </div>

                <article className="flex gap-2.5 rounded-md px-1 py-2.5 hover:bg-[#DBF2FC]/[0.03]">
                  <Avatar initials="MK" color="blue" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <b className="text-[10px] font-bold text-[#DBF2FC]">Minh Khoa</b>
                      <span className="rounded bg-[#007BA7]/30 px-1 py-0.5 font-mono text-[7px] text-[#DBF2FC]">MOD</span>
                      <time className="text-[8px] text-[#DBF2FC]/45">10:42</time>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#DBF2FC]/85">
                      Mọi người thử bắt đầu bằng một kịch bản nhé: nếu vùng hỗ trợ bị phá vỡ thì luận điểm của bạn thay đổi thế nào?
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <button className="flex h-[23px] min-w-[38px] cursor-pointer items-center justify-center gap-1 rounded-md border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.04] text-[9px] hover:border-[#007BA7]/60" onClick={() => setNotice("Reaction chỉ là tương tác prototype.")}>🧠 <span className="text-[8px] text-[#DBF2FC]/70">4</span></button>
                      <button className="flex h-[23px] min-w-[38px] cursor-pointer items-center justify-center gap-1 rounded-md border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.04] text-[9px] hover:border-[#007BA7]/60" onClick={() => setNotice("Reaction chỉ là tương tác prototype.")}>📈 <span className="text-[8px] text-[#DBF2FC]/70">2</span></button>
                      <button className="flex h-[23px] min-w-[24px] cursor-pointer items-center justify-center rounded-md border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.04] text-[9px] text-[#DBF2FC]/65 hover:border-[#007BA7]/60" onClick={() => setNotice("Reaction chỉ là tương tác prototype.")}>＋</button>
                    </div>
                  </div>
                </article>

                <article className="flex gap-2.5 rounded-md px-1 py-2.5 hover:bg-[#DBF2FC]/[0.03]">
                  <Avatar initials="LT" color="pink" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <b className="text-[10px] font-bold text-[#DBF2FC]">Linh Trần</b>
                      <span className="rounded bg-[#FF2D95]/25 px-1 py-0.5 font-mono text-[7px] text-[#FF2D95]">HOST</span>
                      <time className="text-[8px] text-[#DBF2FC]/45">10:45</time>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#DBF2FC]/85">
                      Mình sẽ chờ nến xác nhận thay vì vào lệnh ngay. Nếu đóng cửa dưới vùng này, mình bỏ kịch bản LONG và quan sát tiếp.
                    </p>
                    <div className="relative mt-2 max-w-[420px] overflow-hidden rounded border border-[#DBF2FC]/10 bg-[#12161D] py-2.5 pl-3.5 pr-3">
                      <div className="absolute inset-y-0 left-0 w-[3px] bg-linear-to-b from-[#007BA7] to-[#FF2D95]" />
                      <div className="flex items-center justify-between gap-2 font-mono text-[7px] tracking-[0.1em] text-[#DBF2FC]/60">
                        <span>LUẬN ĐIỂM · BÀI TẬP MÔ PHỎNG</span>
                        <span className="rounded border border-[#FF2D95]/30 px-1 py-0.5 text-[#FF2D95]">SYNTHETIC</span>
                      </div>
                      <strong className="mt-2 block text-[10px] text-[#DBF2FC]">Chờ xác nhận trước khi quyết định</strong>
                      <p className="mb-2 mt-1 text-[8px] leading-normal text-[#DBF2FC]/60">Ý tưởng được chia sẻ để cùng thảo luận; không phải tín hiệu giao dịch.</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-[#DBF2FC]/[0.07] px-1.5 py-0.5 font-mono text-[6px] text-[#DBF2FC]/75">PLAN A</span>
                        <span className="rounded bg-[#DBF2FC]/[0.07] px-1.5 py-0.5 font-mono text-[6px] text-[#DBF2FC]/75">WAIT FOR CLOSE</span>
                        <span className="rounded bg-[#DBF2FC]/[0.07] px-1.5 py-0.5 font-mono text-[6px] text-[#DBF2FC]/75">RISK CHECK</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button className="flex h-[23px] min-w-[38px] cursor-pointer items-center justify-center gap-1 rounded-md border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.04] text-[9px] hover:border-[#007BA7]/60" onClick={() => setNotice("Reaction chỉ là tương tác prototype.")}>✅ <span className="text-[8px] text-[#DBF2FC]/70">3</span></button>
                      <button className="flex h-[23px] min-w-[24px] cursor-pointer items-center justify-center rounded-md border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.04] text-[9px] text-[#DBF2FC]/65 hover:border-[#007BA7]/60" onClick={() => setNotice("Reaction chỉ là tương tác prototype.")}>＋</button>
                    </div>
                  </div>
                </article>

                <article className="flex gap-2.5 rounded-md px-1 py-2.5 hover:bg-[#DBF2FC]/[0.03]">
                  <Avatar initials="AN" color="ice" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <b className="text-[10px] font-bold text-[#DBF2FC]">An Nguyễn</b>
                      <time className="text-[8px] text-[#DBF2FC]/45">10:51</time>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#DBF2FC]/85">
                      Hay đó. Mình thích việc ghi rõ điều kiện sai trước — lúc nhìn chart chạy nhanh dễ quên mất kế hoạch ban đầu.
                    </p>
                  </div>
                </article>

                <div className="my-2 font-mono text-[7px] tracking-[0.08em] text-[#DBF2FC]/45">
                  BẢN XEM TRƯỚC · Nội dung trao đổi bên trên chỉ là dữ liệu minh họa.
                </div>

                <form className="flex min-h-[42px] items-center gap-2 rounded-[7px] border border-[#DBF2FC]/10 bg-[#12161D] px-2.5" onSubmit={sendPreviewMessage}>
                  <button type="button" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded text-[#DBF2FC]/65 hover:text-[#DBF2FC]" aria-label="Quà tặng (preview)" onClick={() => setNotice("Tính năng này chưa kết nối.")}>
                    <Icon name="gift" />
                  </button>
                  <input
                    aria-label="Soạn tin nhắn"
                    placeholder={`Nhắn trong #${selectedChannel.label} · preview`}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[10px] text-[#DBF2FC] outline-none placeholder:text-[#DBF2FC]/45"
                  />
                  <button type="button" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded text-[#DBF2FC]/65 hover:text-[#DBF2FC]" aria-label="Emoji (preview)" onClick={() => setMessage((current) => `${current} ✨`)}>
                    <Icon name="smile" />
                  </button>
                  <button type="submit" className="grid size-7 shrink-0 cursor-pointer place-items-center rounded text-[#007BA7] hover:text-[#FF2D95]" aria-label="Gửi tin nhắn xem trước">
                    <Icon name="send" size={17} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Member Sidebar */}
      <aside
        id="community-member-sidebar"
        aria-hidden={isCompact && !showMembers}
        inert={isCompact && !showMembers}
        className={`flex flex-col overflow-auto border-l border-[#DBF2FC]/10 bg-[#0E1116] px-3 pb-3 transition-transform duration-200 max-[820px]:absolute max-[820px]:bottom-0 max-[820px]:right-0 max-[820px]:top-[58px] max-[820px]:z-[8] max-[820px]:w-[min(230px,calc(100vw-56px))] max-[820px]:shadow-[-12px_0_30px_rgba(0,0,0,0.4)] ${
          showMembers ? "max-[820px]:translate-x-0" : "max-[820px]:translate-x-[105%]"
        } min-[821px]:w-[190px] min-[821px]:shrink-0 min-[1121px]:w-[218px]`}
      >
        <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#DBF2FC]/10">
          <div className="flex items-center gap-1.5 text-[9px] tracking-[0.07em] text-[#DBF2FC]/65">
            <b>THÀNH VIÊN</b><span className="text-[8px] text-[#DBF2FC]/45">18</span>
          </div>
          <button className="grid size-[26px] cursor-pointer place-items-center rounded text-[#DBF2FC]/65 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]" aria-label="Tìm thành viên" onClick={() => setNotice("Tìm thành viên sẽ kết nối cùng API community.")}>
            <Icon name="search" size={16} />
          </button>
        </div>

        <section className="mt-4">
          <h3 className="mb-2 flex items-center gap-1 text-[8px] font-extrabold tracking-[0.08em] text-[#DBF2FC]/65">
            <span className="text-sm text-[#DBF2FC]/45">⌄</span> NGƯỜI ĐIỀU PHỐI — 2
          </h3>
          {MEMBERS.filter((item) => item.role === "Moderator").map((member) => (
            <div className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1.5 hover:bg-[#DBF2FC]/5" key={member.name}>
              <Avatar initials={member.initials} color={member.color} online />
              <div className="min-w-0">
                <b className="block truncate text-[9px] font-semibold text-[#DBF2FC]">{member.name}</b>
                <small className="mt-0.5 block truncate text-[7px] text-[#DBF2FC]/50">{member.status}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-4">
          <h3 className="mb-2 flex items-center gap-1 text-[8px] font-extrabold tracking-[0.08em] text-[#DBF2FC]/65">
            <span className="text-sm text-[#DBF2FC]/45">⌄</span> ĐANG HOẠT ĐỘNG — 16
          </h3>
          {MEMBERS.filter((item) => item.role === "Member").map((member) => (
            <div className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1.5 hover:bg-[#DBF2FC]/5" key={member.name}>
              <Avatar initials={member.initials} color={member.color} online />
              <div className="min-w-0">
                <b className="block truncate text-[9px] font-semibold text-[#DBF2FC]">{member.name}</b>
                <small className="mt-0.5 block truncate text-[7px] text-[#DBF2FC]/50">{member.status}</small>
              </div>
            </div>
          ))}
        </section>

        <div className="mt-auto flex items-center gap-1.5 border-t border-[#DBF2FC]/10 pt-3 text-[8px] text-[#DBF2FC]/60">
          <i className="size-1.5 rounded-full bg-[#007BA7]" /> 18 online <span>·</span> 126 thành viên <em className="not-italic text-[#DBF2FC]/45">mẫu</em>
        </div>
      </aside>

      {notice && (
        <div className="fixed bottom-5 right-5 z-20 flex max-w-[min(420px,calc(100vw-30px))] items-center gap-3.5 rounded-lg border border-[#007BA7]/40 bg-[#12161D] px-3.5 py-2.5 text-[10px] leading-normal text-[#DBF2FC] shadow-[0_12px_35px_rgba(0,0,0,0.45)]" role="status">
          {notice}
          <button className="shrink-0 cursor-pointer text-lg text-[#DBF2FC]/65 hover:text-[#DBF2FC]" onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-[#0A0A0A]/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeCreateRoom(); }}
        >
          <form
            ref={createDialog}
            className="relative w-full max-w-[390px] rounded-[13px] border border-[#007BA7]/35 bg-[#12161D] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-create-title"
            onKeyDown={trapDialogFocus}
            onSubmit={createPreviewRoom}
          >
            <button type="button" className="absolute right-3 top-3 grid size-7 cursor-pointer place-items-center rounded-md text-[21px] text-[#DBF2FC]/65 hover:bg-[#DBF2FC]/10 hover:text-[#DBF2FC]" aria-label="Đóng" onClick={closeCreateRoom}>×</button>
            <span className="font-mono text-[8px] tracking-[0.15em] text-[#007BA7]">ROOMS · BẢN XEM TRƯỚC</span>
            <h2 id="community-create-title" className="mb-1 mt-2 text-xl font-bold text-[#DBF2FC]">Mở một phòng mới</h2>
            <p className="mb-4 text-[10px] leading-relaxed text-[#DBF2FC]/65">Tạo một không gian demo để hình dung cách nhóm bạn sẽ bắt đầu phiên luyện tập.</p>
            <label htmlFor="preview-room-name" className="mb-1.5 block text-[9px] font-bold text-[#DBF2FC]/85">Tên phòng</label>
            <input
              id="preview-room-name"
              autoFocus
              maxLength={80}
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Ví dụ: London open practice"
              required
              className="h-[38px] w-full rounded-md border border-[#DBF2FC]/15 bg-[#0A0A0A] px-2.5 text-[10px] text-[#DBF2FC] outline-none focus:border-[#007BA7]"
            />
            <div className="mt-2 text-[8px] leading-normal text-[#DBF2FC]/50">Phòng này chỉ xuất hiện trong phiên xem trước, chưa được lưu lên server.</div>
            <button type="submit" className="mt-5 flex h-[38px] w-full cursor-pointer items-center justify-between rounded-md bg-[#007BA7] px-3 text-[10px] font-bold text-[#DBF2FC] transition hover:bg-[#FF2D95] hover:text-[#0A0A0A]">
              Tạo phòng minh họa <span>→</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
