import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "../api/client";

interface ProfileUser {
  id: number;
  username: string;
  display_name: string;
  created_at: string;
  email?: string;
  email_verified?: boolean;
  phone?: string;
  phone_verified?: boolean;
}

interface AuthMeResponse {
  user: ProfileUser;
  csrf_token: string;
  expires_at: string;
}

type ProfileState = "loading" | "ready" | "signed-out" | "error";

// Keep the profile preview usable before the API is connected.
const USE_DEMO_PROFILE = true;
const DEMO_PROFILE: ProfileUser = {
  id: 10428,
  username: "tranbao",
  display_name: "Trần Bảo",
  created_at: "2025-04-18T09:30:00+07:00",
  email: "tran.bao@example.com",
  email_verified: false,
  phone: "+84 900 000 000",
  phone_verified: false,
};

function initialsFor(displayName: string, username: string) {
  const source = displayName.trim() || username;
  const parts = source.split(/\s+/).filter(Boolean);
  const firstInitial = parts[0]?.[0] ?? source[0] ?? "M";
  const lastInitial = parts.at(-1)?.[0] ?? firstInitial;
  return (parts.length > 1 ? `${firstInitial}${lastInitial}` : source.slice(0, 2)).toLocaleUpperCase();
}

function joinedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [state, setState] = useState<ProfileState>("loading");
  const [errorCode, setErrorCode] = useState("");

  const loadProfile = useCallback(async () => {
    setState("loading");
    setErrorCode("");
    if (USE_DEMO_PROFILE) {
      setUser(DEMO_PROFILE);
      setState("ready");
      return;
    }
    try {
      const response = await request<AuthMeResponse>("/auth/me");
      setUser(response.user);
      setState("ready");
    } catch (error) {
      setUser(null);
      if (error instanceof ApiError && error.status === 401) {
        setState("signed-out");
      } else {
        setErrorCode(error instanceof ApiError ? error.code : "NETWORK_ERROR");
        setState("error");
      }
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  return (
    <div data-header-theme="dark" className="relative isolate min-h-svh overflow-hidden bg-[#0A0A0A] px-3 pb-14 pt-[91px] text-[#DBF2FC] sm:px-6 sm:pb-[72px] sm:pt-[98px]">
      <div aria-hidden="true" className="pointer-events-none absolute -left-[270px] top-[70px] -z-10 aspect-square w-[440px] rounded-full bg-[#007BA7]/25 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-[300px] top-[220px] -z-10 aspect-square w-[440px] rounded-full bg-[#FF2D95]/15 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-[1100px]">
        <div className="mb-3 flex items-center gap-2.5 text-[10px] text-[#DBF2FC]/55 sm:mb-4">
          <a href="/" className="text-[#DBF2FC]/75 no-underline transition-colors hover:text-[#DBF2FC]">Trang chủ</a>
          <span aria-hidden="true">/</span>
          <span className="text-[#DBF2FC]">Hồ sơ cá nhân</span>
        </div>

        {state === "loading" && (
          <section className="grid min-h-[340px] content-center justify-items-center rounded-[15px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#DBF2FC]/5 to-[#DBF2FC]/[0.018] p-8 text-center" aria-live="polite">
            <span className="mb-1.5 size-[34px] animate-spin rounded-full border-2 border-[#007BA7]/25 border-t-[#007BA7] motion-reduce:animate-none" />
            <h1 className="mt-1.5 text-[clamp(24px,4vw,34px)] font-semibold tracking-[-0.04em] text-[#DBF2FC]">Đang tải hồ sơ</h1>
            <p className="max-w-[450px] text-[11px] leading-relaxed text-[#DBF2FC]/65">Đang lấy thông tin tài khoản của bạn.</p>
          </section>
        )}

        {state === "signed-out" && (
          <section className="grid min-h-[340px] content-center justify-items-center rounded-[15px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#DBF2FC]/5 to-[#DBF2FC]/[0.018] p-8 text-center">
            <div className="grid size-[45px] place-items-center rounded-[14px] border border-[#007BA7]/35 bg-[#007BA7]/15 text-[21px] text-[#DBF2FC]">↗</div>
            <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[8px] tracking-[0.16em] text-[#DBF2FC]/65">MARKET FORGE · ACCOUNT</p>
            <h1 className="mb-1 mt-3 text-[clamp(24px,4vw,34px)] font-semibold tracking-[-0.04em] text-[#DBF2FC]">Đăng nhập để xem hồ sơ</h1>
            <p className="max-w-[450px] text-[11px] leading-relaxed text-[#DBF2FC]/65">Hồ sơ cá nhân được gắn với tài khoản Market Forge của bạn.</p>
            <a className="mt-4 inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-4 rounded-[7px] border border-[#DBF2FC]/20 bg-[#007BA7] px-3.5 text-[10px] font-semibold text-[#DBF2FC] no-underline transition hover:bg-[#FF2D95] hover:text-[#0A0A0A]" href="/login">
              Đăng nhập <span className="text-sm text-[#FF2D95] group-hover:text-[#0A0A0A]">→</span>
            </a>
          </section>
        )}

        {state === "error" && (
          <section className="grid min-h-[340px] content-center justify-items-center rounded-[15px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#DBF2FC]/5 to-[#DBF2FC]/[0.018] p-8 text-center">
            <div className="grid size-[45px] place-items-center rounded-[14px] border border-[#FF2D95]/35 bg-[#FF2D95]/15 text-[21px] text-[#FF2D95]">!</div>
            <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[8px] tracking-[0.16em] text-[#DBF2FC]/65">KHÔNG TẢI ĐƯỢC HỒ SƠ</p>
            <h1 className="mb-1 mt-3 text-[clamp(24px,4vw,34px)] font-semibold tracking-[-0.04em] text-[#DBF2FC]">Hãy thử lại sau một chút</h1>
            <p className="max-w-[450px] text-[11px] leading-relaxed text-[#DBF2FC]/65">
              Mã lỗi: <code className="text-[10px] text-[#DBF2FC]">{errorCode}</code>. Kiểm tra kết nối tới máy chủ rồi tải lại thông tin.
            </p>
            <button className="mt-4 inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-4 rounded-[7px] border border-[#DBF2FC]/20 bg-[#007BA7] px-3.5 text-[10px] font-semibold text-[#DBF2FC] transition hover:bg-[#FF2D95] hover:text-[#0A0A0A]" onClick={() => void loadProfile()}>
              Thử tải lại <span className="text-sm text-[#FF2D95]">↻</span>
            </button>
          </section>
        )}

        {state === "ready" && user && (
          <>
            <section className="relative min-h-[222px] overflow-hidden rounded-[17px] border border-[#DBF2FC]/15 bg-linear-to-br from-[#007BA7]/25 via-[#0A0A0A] to-[#FF2D95]/15 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:min-h-[250px]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(219,242,252,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(219,242,252,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25 [mask-image:linear-gradient(90deg,#000,transparent_80%)]" aria-hidden="true" />
              <div className="relative z-[1] px-4 pb-3.5 pt-[18px] sm:px-5 sm:pb-4 sm:pt-5 md:px-[30px] md:pb-5 md:pt-6">
                <p className="m-0 flex items-center gap-2 font-mono text-[7px] tracking-[0.16em] text-[#DBF2FC]/70 sm:text-[8px]">
                  <span className="h-px w-[19px] bg-linear-to-r from-[#007BA7] to-[#FF2D95]" />
                  MARKET FORGE · PERSONAL PROFILE
                  <em className="ml-1 rounded border border-[#FF2D95]/30 px-1.5 py-0.5 font-mono text-[7px] not-italic tracking-[0.1em] text-[#FF2D95]">DEMO DATA</em>
                </p>

                <div className="mt-[22px] flex items-center gap-3 sm:mt-6 sm:gap-[17px]">
                  <div className="relative shrink-0 rounded-full border border-[#007BA7]/50 bg-[#007BA7]/10 p-1 shadow-[0_0_24px_rgba(0,123,167,0.16)]">
                    <div className="grid size-[60px] place-items-center rounded-full border border-[#DBF2FC]/25 bg-[radial-gradient(circle_at_30%_20%,#007BA7,#0A0A0A_75%)] text-[21px] font-bold tracking-[-0.05em] text-[#DBF2FC] sm:size-[68px] md:size-[80px] md:text-[25px]">
                      {initialsFor(user.display_name, user.username)}
                    </div>
                    <span className="absolute bottom-[7px] right-[7px] size-[13px] rounded-full border-[3px] border-[#0A0A0A] bg-[#007BA7]" title="Tài khoản đang hoạt động" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] tracking-[0.12em] text-[#007BA7]">THÀNH VIÊN MARKET FORGE</span>
                    <h1 className="my-0.5 break-words text-[27px] font-bold leading-[1.08] tracking-[-0.045em] text-[#DBF2FC] sm:text-[clamp(27px,4vw,39px)]">
                      {user.display_name}
                    </h1>
                    <p className="m-0 text-xs text-[#DBF2FC]/65">@{user.username}</p>
                  </div>
                </div>

                <div className="mt-[15px] flex flex-col items-start gap-2 text-[8px] text-[#DBF2FC]/75 sm:mt-[22px] sm:flex-row sm:items-center sm:gap-3.5 sm:text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-[#007BA7] shadow-[0_0_9px_rgba(0,123,167,0.7)]" /> Hồ sơ minh họa
                  </div>
                  <span className="hidden h-[15px] w-px bg-[#DBF2FC]/15 sm:block" />
                  <div className="flex items-center gap-1.5">
                    Tham gia từ <strong className="font-semibold text-[#DBF2FC]">{joinedDate(user.created_at)}</strong>
                  </div>
                </div>
              </div>

              <div className="absolute -right-[33px] top-1/2 grid size-[112px] -translate-y-1/2 place-items-center rounded-full border border-[#007BA7]/25 opacity-30 shadow-[0_0_60px_rgba(0,123,167,0.1),inset_0_0_35px_rgba(255,45,149,0.05)] [transform:translateY(-50%)_rotate(-20deg)_scaleY(0.62)] sm:right-4 sm:size-[122px] sm:opacity-55 md:right-20 md:size-[168px] md:opacity-100" aria-hidden="true">
                <div className="absolute inset-[15px] rounded-full border border-[#FF2D95]/25" />
                <div className="absolute inset-[34px] rounded-full border border-[#DBF2FC]/15" />
                <span className="text-[38px] font-light tracking-[-0.1em] text-[#DBF2FC]/80 [transform:rotate(20deg)_scaleY(1.6)]">MF</span>
              </div>
            </section>

            <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(270px,0.85fr)]">
              <section className="min-w-0 rounded-[13px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#DBF2FC]/[0.045] to-[#DBF2FC]/[0.015] px-3.5 pb-3 pt-[17px] shadow-[0_15px_45px_rgba(0,0,0,0.12)] sm:px-[22px] sm:pb-[15px] sm:pt-[21px]">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3.5">
                  <div>
                    <p className="m-0 font-mono text-[8px] tracking-[0.16em] text-[#DBF2FC]/65">THÔNG TIN CƠ BẢN</p>
                    <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-[#DBF2FC]">Hồ sơ của bạn</h2>
                  </div>
                  <span className="rounded border border-[#DBF2FC]/10 px-[7px] py-[5px] font-mono text-[6px] tracking-[0.06em] text-[#DBF2FC]/60 sm:text-[7px]">ĐỒNG BỘ TỪ TÀI KHOẢN</span>
                </div>

                <div className="mt-[17px]">
                  <div className="flex min-w-0 items-center gap-2 border-t border-[#DBF2FC]/10 py-3 sm:gap-3 sm:py-3.5">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-[#007BA7]/25 bg-[#007BA7]/15 text-xs font-semibold text-[#DBF2FC] sm:size-[35px]">Aa</span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-[#DBF2FC]/65">Tên hiển thị</span>
                      <strong className="mt-0.5 block truncate text-xs font-semibold text-[#DBF2FC]">{user.display_name}</strong>
                      <small className="mt-0.5 block whitespace-normal text-[8px] leading-snug text-[#DBF2FC]/45 sm:truncate">Tên mọi người nhìn thấy trong phòng luyện tập.</small>
                    </div>
                    <span className="rounded border border-[#007BA7]/30 px-1.5 py-1 font-mono text-[5px] text-[#DBF2FC] sm:text-[7px]">PUBLIC</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 border-t border-[#DBF2FC]/10 py-3 sm:gap-3 sm:py-3.5">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-[#007BA7]/25 bg-[#007BA7]/15 text-xs font-semibold text-[#DBF2FC] sm:size-[35px]">@</span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-[#DBF2FC]/65">Username</span>
                      <strong className="mt-0.5 block truncate font-mono text-xs text-[#007BA7]">@{user.username}</strong>
                      <small className="mt-0.5 block whitespace-normal text-[8px] leading-snug text-[#DBF2FC]/45 sm:truncate">Tên định danh duy nhất cho tài khoản của bạn.</small>
                    </div>
                    <span className="rounded border border-[#007BA7]/30 px-1.5 py-1 font-mono text-[5px] text-[#DBF2FC] sm:text-[7px]">ID</span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 border-t border-[#DBF2FC]/10 py-3 sm:gap-3 sm:py-3.5">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-[#DBF2FC]/10 bg-[#DBF2FC]/5 text-xs font-semibold text-[#DBF2FC]/70 sm:size-[35px]">✉</span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-[#DBF2FC]/65">Email</span>
                      <strong className={`mt-0.5 block truncate text-xs font-semibold ${user.email_verified ? "text-[#DBF2FC]" : "font-medium text-[#DBF2FC]/55"}`}>{user.email || "Chưa liên kết"}</strong>
                      <small className="mt-0.5 block whitespace-normal text-[8px] leading-snug text-[#DBF2FC]/45 sm:truncate">{user.email ? "Email mẫu trong bản xem trước." : "Email chưa được thêm."}</small>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-[5px] font-mono text-[5px] tracking-[0.04em] sm:text-[6px] ${user.email_verified ? "border-[#007BA7]/35 text-[#DBF2FC]" : "border-[#FF2D95]/30 text-[#FF2D95]"}`}>
                      <i className={`size-[5px] rounded-full ${user.email_verified ? "bg-[#007BA7]" : "bg-[#FF2D95]"}`} />
                      {user.email_verified ? "ĐÃ XÁC MINH" : "CHƯA XÁC MINH"}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 border-t border-[#DBF2FC]/10 py-3 sm:gap-3 sm:py-3.5">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border border-[#DBF2FC]/10 bg-[#DBF2FC]/5 text-xs font-semibold text-[#DBF2FC]/70 sm:size-[35px]">☎</span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-[#DBF2FC]/65">Số điện thoại</span>
                      <strong className={`mt-0.5 block truncate text-xs font-semibold ${user.phone_verified ? "text-[#DBF2FC]" : "font-medium text-[#DBF2FC]/55"}`}>{user.phone || "Chưa liên kết"}</strong>
                      <small className="mt-0.5 block whitespace-normal text-[8px] leading-snug text-[#DBF2FC]/45 sm:truncate">{user.phone ? "Số điện thoại mẫu trong bản xem trước." : "Số điện thoại chưa được thêm."}</small>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1.5 rounded border px-1.5 py-[5px] font-mono text-[5px] tracking-[0.04em] sm:text-[6px] ${user.phone_verified ? "border-[#007BA7]/35 text-[#DBF2FC]" : "border-[#FF2D95]/30 text-[#FF2D95]"}`}>
                      <i className={`size-[5px] rounded-full ${user.phone_verified ? "bg-[#007BA7]" : "bg-[#FF2D95]"}`} />
                      {user.phone_verified ? "ĐÃ XÁC MINH" : "CHƯA XÁC MINH"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-[7px] border border-[#DBF2FC]/10 bg-[#DBF2FC]/[0.02] px-2.5 py-2.5">
                  <span className="grid size-[13px] shrink-0 place-items-center rounded-full border border-[#007BA7]/45 font-serif text-[8px] text-[#DBF2FC]">i</span>
                  <p className="m-0 text-[8px] leading-relaxed text-[#DBF2FC]/55">
                    Email, số điện thoại và ngày tham gia bên trên là dữ liệu minh họa để xem giao diện; chưa được lưu lên máy chủ.
                  </p>
                </div>
              </section>

              <aside className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
                <section className="relative min-w-0 overflow-hidden rounded-[13px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#007BA7]/15 via-[#0A0A0A] to-[#FF2D95]/10 p-[15px] shadow-[0_15px_45px_rgba(0,0,0,0.12)] sm:p-[18px]">
                  <div className="mb-3.5 flex items-center justify-between">
                    <span className="grid size-[29px] place-items-center rounded-lg border border-[#DBF2FC]/15 bg-[#007BA7]/25 text-[#DBF2FC]">✦</span>
                    <span className="flex items-center gap-1.5 font-mono text-[7px] text-[#007BA7]"><i className="size-[5px] rounded-full bg-[#007BA7]" /> DEMO</span>
                  </div>
                  <p className="m-0 font-mono text-[8px] tracking-[0.16em] text-[#DBF2FC]/65">HÀNH TRÌNH CỦA BẠN</p>
                  <h2 className="mb-1.5 mt-2 max-w-[250px] text-base font-semibold leading-tight tracking-[-0.025em] text-[#DBF2FC] sm:text-lg">
                    Mỗi phiên là một cơ hội để tiến bộ.
                  </h2>
                  <p className="m-0 text-[9px] leading-relaxed text-[#DBF2FC]/65">
                    Luyện tập cùng cộng đồng, ghi lại luận điểm và xây dựng quy trình của riêng bạn.
                  </p>
                  <a href="/community" className="mt-3.5 inline-flex items-center gap-3 rounded-md border border-[#007BA7]/35 bg-[#007BA7]/20 px-2.5 py-2 text-[9px] font-semibold text-[#DBF2FC] no-underline transition hover:border-[#FF2D95]/50 hover:bg-[#FF2D95]/20">
                    Khám phá Community <span className="text-xs text-[#FF2D95]">↗</span>
                  </a>
                  <div className="mt-[17px] flex items-center justify-between gap-2.5 border-t border-[#DBF2FC]/10 pt-2.5">
                    <span className="font-mono text-[7px] tracking-[0.1em] text-[#DBF2FC]/50">THÀNH VIÊN TỪ</span>
                    <strong className="text-right text-[9px] font-medium text-[#DBF2FC]">{joinedDate(user.created_at)}</strong>
                  </div>
                </section>

                <section className="min-w-0 rounded-[13px] border border-[#DBF2FC]/10 bg-linear-to-br from-[#DBF2FC]/[0.045] to-[#DBF2FC]/[0.015] px-[17px] py-[15px] shadow-[0_15px_45px_rgba(0,0,0,0.12)]">
                  <p className="m-0 font-mono text-[8px] tracking-[0.16em] text-[#DBF2FC]/65">TÀI KHOẢN · DEMO</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-[#DBF2FC]/10 pt-2.5 text-[8px] text-[#DBF2FC]/60">
                    <span>Account ID</span>
                    <code className="truncate font-mono text-[8px] text-[#DBF2FC]">MF-{String(user.id).padStart(6, "0")}</code>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-[#DBF2FC]/10 pt-2.5 text-[8px] text-[#DBF2FC]/60">
                    <span>Username</span>
                    <code className="truncate font-mono text-[8px] text-[#DBF2FC]">@{user.username}</code>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2.5 border-t border-[#DBF2FC]/10 pt-2.5 text-[8px] text-[#DBF2FC]/60">
                    <span>Trạng thái</span>
                    <span className="flex items-center gap-1.5 text-[8px] text-[#DBF2FC]"><i className="size-[5px] rounded-full bg-[#007BA7]" /> Dữ liệu mẫu</span>
                  </div>
                </section>
              </aside>
            </div>

            <p className="mt-3.5 flex items-start gap-2 px-0.5 text-[8px] leading-relaxed text-[#DBF2FC]/45 sm:items-center">
              <span className="text-[#FF2D95]">✦</span> Đây là hồ sơ minh họa để xem giao diện. Tắt chế độ demo khi sẵn sàng kết nối API thật.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
