import { useEffect, useRef, useState, type MouseEvent } from "react";
import { HeroWaveBackground } from "../components/HeroWaveBackground";

const CHAPTERS = [
  { id: "platform", number: "01", label: "Market Forge", title: "Thị trường rộng lớn.\nKhông gian để rèn luyện." },
  { id: "ecosystem", number: "02", label: "Một hệ sinh thái", title: "Nhiều thị trường.\nMột tư duy vững vàng." },
  { id: "community", number: "03", label: "Giao dịch cùng nhau", title: "Quyết định của bạn.\nGóc nhìn của cả nhóm." },
];

const MINI_BAR_HEIGHTS = [14, 22, 42, 24, 18, 42, 20, 24, 42, 16, 26, 42];

export function AboutPage() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const journeyRef = useRef<HTMLDivElement>(null);
  const wheelLocked = useRef(false);
  const queuedDirection = useRef(0);
  const unlockTimer = useRef<number | undefined>(undefined);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const journey = journeyRef.current;
    if (!journey) return;
    const stepBy = (direction: number) => {
      const next = activeRef.current + direction;
      if (next < 0 || next >= CHAPTERS.length) return false;
      activeRef.current = next;
      setActive(next);
      wheelLocked.current = true;
      window.clearTimeout(unlockTimer.current);
      unlockTimer.current = window.setTimeout(() => {
        wheelLocked.current = false;
        const queued = queuedDirection.current;
        queuedDirection.current = 0;
        if (queued && !stepBy(queued) && queued > 0 && activeRef.current === CHAPTERS.length - 1) {
          window.scrollTo({ top: journey.offsetTop + journey.offsetHeight, behavior: "smooth" });
        }
      }, 300);
      return true;
    };
    const wheel = (event: WheelEvent) => {
      const isAtJourney = window.scrollY <= journey.offsetTop + 2;
      if (!isAtJourney || event.deltaY === 0) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      const next = activeRef.current + direction;
      if (wheelLocked.current) {
        event.preventDefault();
        if (!queuedDirection.current && (next >= 0 && next < CHAPTERS.length || direction > 0 && activeRef.current === CHAPTERS.length - 1)) queuedDirection.current = direction;
        return;
      }
      if (next < 0 || next >= CHAPTERS.length) return;
      event.preventDefault();
      stepBy(direction);
    };
    const touchStart = (event: TouchEvent) => { touchStartY.current = event.touches[0]?.clientY ?? null; };
    const touchMove = (event: TouchEvent) => {
      if (touchStartY.current === null || window.scrollY > journey.offsetTop + 2) return;
      const delta = touchStartY.current - (event.touches[0]?.clientY ?? touchStartY.current);
      const next = activeRef.current + (delta > 0 ? 1 : -1);
      if (wheelLocked.current || (Math.abs(delta) > 8 && next >= 0 && next < CHAPTERS.length)) event.preventDefault();
    };
    const touchEnd = (event: TouchEvent) => {
      if (touchStartY.current === null) return;
      const delta = touchStartY.current - (event.changedTouches[0]?.clientY ?? touchStartY.current);
      touchStartY.current = null;
      if (wheelLocked.current || Math.abs(delta) < 42 || window.scrollY > journey.offsetTop + 2) return;
      const direction = delta > 0 ? 1 : -1;
      if (wheelLocked.current) {
        if (!queuedDirection.current && (activeRef.current + direction >= 0 && activeRef.current + direction < CHAPTERS.length || direction > 0 && activeRef.current === CHAPTERS.length - 1)) queuedDirection.current = direction;
        return;
      }
      stepBy(direction);
    };
    window.addEventListener("wheel", wheel, { passive: false });
    journey.addEventListener("touchstart", touchStart, { passive: true });
    journey.addEventListener("touchmove", touchMove, { passive: false });
    journey.addEventListener("touchend", touchEnd, { passive: true });
    return () => { window.clearTimeout(unlockTimer.current); window.removeEventListener("wheel", wheel); journey.removeEventListener("touchstart", touchStart); journey.removeEventListener("touchmove", touchMove); journey.removeEventListener("touchend", touchEnd); };
  }, []);

  const chapterClass = (index: number) =>
    `absolute inset-0 isolate grid h-full min-h-0 items-center overflow-hidden bg-transparent px-4 pb-14 pt-28 transition-opacity duration-700 ease-out sm:px-7 sm:pb-18 ${
      index === active
        ? "z-[3] pointer-events-auto opacity-100"
        : index < active
          ? "z-[1] pointer-events-none opacity-0"
          : "z-[2] pointer-events-none opacity-0"
    }`;

  const panelClass = (index: number, side: "title" | "content", extra = "") => {
    const stateClasses =
      index === active
        ? "opacity-100 translate-x-0"
        : index < active
          ? side === "title"
            ? "opacity-0 translate-x-[40vw] motion-reduce:translate-x-6"
            : "opacity-0 -translate-x-[40vw] motion-reduce:-translate-x-6"
          : side === "title"
            ? "opacity-0 -translate-x-[40vw] motion-reduce:-translate-x-6"
            : "opacity-0 translate-x-[40vw] motion-reduce:translate-x-6";
    return `min-w-0 will-change-[transform,opacity] transition-all duration-700 ease-out motion-reduce:duration-300 ${stateClasses} ${extra}`.trim();
  };

  const goToChapter = (index: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    queuedDirection.current = 0;
    window.clearTimeout(unlockTimer.current);
    wheelLocked.current = false;
    activeRef.current = index;
    setActive(index);
  };

  return (
    <div className="relative overflow-x-clip bg-[#0A0A0A] text-[#DBF2FC]">
      <div className="fixed right-2 top-1/2 z-[60] h-[60px] w-0.5 -translate-y-1/2 overflow-hidden bg-[#DBF2FC]/15 sm:right-5 sm:h-[76px]" aria-hidden="true">
        <span
          className="block size-full origin-top bg-linear-to-b from-[#007BA7] to-[#FF2D95] transition-transform duration-500 motion-reduce:transition-none"
          style={{ transform: `scaleY(${(active + 1) / CHAPTERS.length})` }}
        />
      </div>

      <nav aria-label="Các phần giới thiệu" className="fixed right-2.5 top-1/2 z-[60] grid -translate-y-1/2 gap-2.5 sm:right-9 sm:gap-3.5">
        {CHAPTERS.map((chapter, index) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            onClick={goToChapter(index)}
            aria-label={`Phần ${chapter.number}: ${chapter.label}`}
            aria-current={active === index ? "step" : undefined}
            className={`grid size-[19px] place-items-center rounded-full border font-mono text-[7px] transition sm:size-[22px] sm:text-[8px] ${
              active === index
                ? "border-[#007BA7] bg-[#007BA7]/25 text-[#DBF2FC]"
                : "border-transparent text-[#DBF2FC]/40 hover:text-[#DBF2FC]/80"
            }`}
          >
            <span>{chapter.number}</span>
          </a>
        ))}
      </nav>

      <nav aria-label="Breadcrumb" className="fixed left-4 top-[72px] z-[55] flex items-center gap-2.5 text-xs text-[#DBF2FC]/80 sm:left-[max(24px,calc((100vw-1120px)/2))] sm:top-[78px] sm:gap-3.5 sm:text-sm">
        <a href="/" aria-label="Về trang chủ" title="Về trang chủ" className="grid size-[29px] place-items-center rounded-lg text-[#DBF2FC]/70 transition hover:bg-[#007BA7]/20 hover:text-[#DBF2FC] sm:size-[34px]">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[21px]">
            <path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-6h-5v6h-6V10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </a>
        <span aria-hidden="true" className="text-[23px] font-light text-[#DBF2FC]/35">›</span>
        <span>Về chúng tôi</span>
      </nav>

      <div ref={journeyRef} className="relative h-svh" aria-label="Giới thiệu Market Forge qua ba phần">
        <div className="relative h-svh min-h-[540px] overflow-hidden bg-[#0A0A0A] sm:min-h-[600px]">
          {/* Chapter 1: Intro */}
          <section id="platform" data-header-theme="dark" className={chapterClass(0)} aria-hidden={active !== 0}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(219,242,252,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(219,242,252,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(transparent,#000_22%,#000_78%,transparent)]" />
            <div aria-hidden="true" className="pointer-events-none absolute -left-60 top-[8%] -z-10 aspect-square w-[440px] rounded-full bg-[#007BA7] opacity-20 blur-[95px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-[20%] -right-[250px] -z-10 aspect-square w-[440px] rounded-full bg-[#FF2D95] opacity-15 blur-[95px]" />

            <div className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-3 py-1.5 md:grid-cols-[1.03fr_0.97fr] md:gap-8 md:py-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2.5 font-mono text-[10px] font-semibold leading-snug tracking-[0.2em] text-[#DBF2FC]/60">
                  <span className="h-px w-6 bg-[#FF2D95] shadow-[0_0_12px_#FF2D95]" /> MARKET FORGE · GIỚI THIỆU
                </p>
                <h1 className={panelClass(0, "title", "mt-6 max-w-[700px] text-[clamp(34px,9.2vw,43px)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#DBF2FC] sm:text-[clamp(40px,6vw,76px)]")}>
                  Thị trường rộng lớn.<br />
                  <span className="bg-linear-to-r from-[#DBF2FC] via-[#007BA7] to-[#FF2D95] bg-clip-text text-transparent">Không gian để rèn luyện.</span>
                </h1>
                <div className={panelClass(0, "content")}>
                  <p className="mt-6 max-w-[600px] text-base leading-relaxed text-[#DBF2FC]/85 sm:text-[clamp(17px,2vw,21px)]">
                    Market Forge là nền tảng giao dịch thương mại số nơi bạn có thể khám phá thị trường, rèn tư duy chiến lược và tiến bộ qua từng quyết định.
                  </p>
                  <p className="mt-4 max-w-[570px] text-[13px] leading-relaxed text-[#DBF2FC]/55 sm:text-sm sm:leading-loose">
                    Thay vì chạy theo biến động, chúng tôi tạo ra một không gian rõ ràng để người giao dịch quan sát, thực hành và hiểu lý do đằng sau mỗi lựa chọn. Một hành trình bắt đầu bằng tò mò, được củng cố bằng kỷ luật.
                  </p>
                  <a
                    href="#ecosystem"
                    onClick={goToChapter(1)}
                    className="mt-7 inline-flex min-h-12 items-center gap-4 rounded-full border border-[#DBF2FC]/20 px-5 text-[13px] font-semibold text-[#DBF2FC] transition hover:-translate-y-0.5 hover:border-[#007BA7] hover:bg-[#007BA7]/20 motion-reduce:transition-none"
                  >
                    Khám phá hệ sinh thái <span aria-hidden="true" className="text-lg text-[#FF2D95]">↓</span>
                  </a>
                </div>
              </div>

              <div className="relative -mt-2 grid min-h-[210px] place-items-center md:mt-0 md:min-h-[500px]" aria-label="Minh họa nhịp chuyển động của thị trường">
                <div aria-hidden="true" className="pointer-events-none absolute inset-[7%_20%] rounded-full border border-[#007BA7]/20 shadow-[0_0_90px_rgba(0,123,167,0.12),inset_0_0_90px_rgba(255,45,149,0.05)] md:inset-[13%]" />
                <div aria-hidden="true" className="absolute size-[210px] rounded-full border border-[#DBF2FC]/20 [transform:rotate(-22deg)_scaleY(0.55)] md:size-[390px]" />
                <div aria-hidden="true" className="absolute size-[165px] rounded-full border border-[#FF2D95]/35 [transform:rotate(34deg)_scaleY(0.58)] md:size-[300px]" />
                <div className="flex size-[100px] flex-col items-center justify-center gap-1.5 rounded-[38%_62%_55%_45%/45%_40%_60%_55%] border border-[#DBF2FC]/20 bg-[radial-gradient(circle_at_35%_25%,rgba(0,123,167,0.45),rgba(10,10,10,0.94)_70%)] shadow-[0_0_70px_rgba(0,123,167,0.27),inset_0_0_35px_rgba(255,45,149,0.14)] md:size-[170px]">
                  <span className="text-[34px] font-light tracking-[-0.1em] text-[#DBF2FC] md:text-[50px]">MF</span>
                  <small className="text-center font-mono text-[7px] leading-snug tracking-[0.2em] text-[#DBF2FC]/75 md:text-[9px]">MARKET<br />SIGNAL</small>
                </div>
                <div className="absolute right-[9%] top-[8%] z-[1] flex gap-3 font-mono text-[7px] tracking-[0.15em] text-[#DBF2FC]/45 md:top-[16%] md:text-[9px]">
                  OBSERVE <b className="font-medium text-[#FF2D95]">01</b>
                </div>
                <div className="absolute bottom-[7%] left-[5%] z-[1] flex gap-3 font-mono text-[7px] tracking-[0.15em] text-[#DBF2FC]/45 md:bottom-[16%] md:text-[9px]">
                  DECIDE <b className="font-medium text-[#FF2D95]">02</b>
                </div>
                <svg aria-hidden="true" viewBox="0 0 480 300" className="absolute w-[88%] opacity-70 drop-shadow-[0_0_6px_rgba(0,123,167,0.45)] md:w-full">
                  <path d="M18 224 84 196 128 215 184 142 226 168 278 101 324 127 378 57 460 76" fill="none" stroke="url(#chart-line)" strokeWidth="2" />
                  <defs>
                    <linearGradient id="chart-line">
                      <stop stopColor="#007BA7" />
                      <stop offset="1" stopColor="#FF2D95" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <a href="#ecosystem" onClick={goToChapter(1)} className="absolute -bottom-2.5 left-0 flex items-center gap-2.5 font-mono text-[9px] tracking-[0.17em] text-[#DBF2FC]/45 md:-bottom-7">
                <span className="h-px w-[30px] bg-linear-to-r from-[#007BA7] to-[#FF2D95]" /> LƯỚT ĐỂ KHÁM PHÁ
              </a>
            </div>
          </section>

          {/* Chapter 2: Ecosystem */}
          <section id="ecosystem" data-header-theme="dark" className={chapterClass(1)} aria-hidden={active !== 1}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(219,242,252,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(219,242,252,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(transparent,#000_22%,#000_78%,transparent)]" />
            <div aria-hidden="true" className="pointer-events-none absolute left-[28%] top-[2%] -z-10 aspect-square w-[600px] rounded-full bg-[#007BA7] opacity-15 blur-[95px]" />

            <div className="relative mx-auto w-full max-w-[1120px] py-1 md:py-3">
              <div className="grid grid-cols-1 items-end gap-x-9 md:grid-cols-2">
                <p className="flex items-center gap-2.5 font-mono text-[10px] font-semibold leading-snug tracking-[0.2em] text-[#DBF2FC]/60 md:col-span-full">
                  <span className="h-px w-6 bg-[#FF2D95] shadow-[0_0_12px_#FF2D95]" /> 02 / HỆ SINH THÁI ĐA DẠNG
                </p>
                <h2 className={panelClass(1, "title", "mt-5 text-[clamp(34px,9.2vw,43px)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#DBF2FC] sm:text-[clamp(40px,6vw,76px)]")}>
                  Nhiều thị trường.<br />
                  <span className="bg-linear-to-r from-[#DBF2FC] via-[#007BA7] to-[#FF2D95] bg-clip-text text-transparent">Một tư duy vững vàng.</span>
                </h2>
                <div className={panelClass(1, "content")}>
                  <p className="mt-4 max-w-[600px] text-base leading-relaxed text-[#DBF2FC]/85 md:mb-1.5 md:mt-0 md:text-[clamp(17px,2vw,21px)]">
                    Mở rộng góc nhìn qua những thị trường có nhịp điệu và đặc trưng riêng.
                  </p>
                </div>
              </div>

              <div className={panelClass(1, "content", "relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:mt-11")}>
                <article className="relative min-h-[215px] min-w-0 overflow-hidden rounded-[18px] border border-[#DBF2FC]/15 bg-linear-to-br from-[#DBF2FC]/5 to-[#DBF2FC]/[0.015] p-4 transition duration-300 hover:-translate-y-1.5 hover:border-[#007BA7]/60 hover:from-[#007BA7]/15 sm:p-6 md:min-h-[288px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-[0.15em] text-[#DBF2FC]/45">A / 01</span>
                    <span className="text-2xl text-[#007BA7]">↗</span>
                  </div>
                  <div className="absolute right-4 top-12 flex h-[65px] origin-top-right scale-75 items-center gap-1 opacity-60 md:right-5 md:top-[68px] md:scale-100">
                    {MINI_BAR_HEIGHTS.map((h, i) => (
                      <i key={i} style={{ height: `${h}px` }} className="w-1 rounded-sm bg-[#007BA7]" />
                    ))}
                  </div>
                  <h3 className="mt-1.5 text-[25px] font-semibold tracking-[-0.03em] text-[#DBF2FC]">Futures</h3>
                  <p className="mt-2.5 max-w-[440px] text-[11px] leading-relaxed text-[#DBF2FC]/60 sm:text-[13px] sm:leading-relaxed">
                    Quan sát sức mạnh xu hướng và nhịp biến động. Thực hành xây dựng kế hoạch theo kịch bản với dữ liệu mô phỏng.
                  </p>
                  <span className="absolute bottom-3.5 left-4 font-mono text-[7px] tracking-[0.15em] text-[#DBF2FC]/45 sm:bottom-5 sm:left-6 sm:text-[8px]">
                    CẤU TRÚC · ĐỘNG LƯỢNG · KỶ LUẬT
                  </span>
                </article>

                <article className="relative min-h-[215px] min-w-0 overflow-hidden rounded-[18px] border border-[#DBF2FC]/15 bg-linear-to-br from-[#DBF2FC]/5 to-[#DBF2FC]/[0.015] p-4 transition duration-300 hover:-translate-y-1.5 hover:border-[#FF2D95]/60 hover:from-[#FF2D95]/10 sm:p-6 md:min-h-[288px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-[0.15em] text-[#DBF2FC]/45">B / 02</span>
                    <span className="text-2xl text-[#FF2D95]">⌁</span>
                  </div>
                  <div className="absolute right-4 top-12 flex h-[65px] origin-top-right scale-75 items-center gap-1 opacity-60 md:right-5 md:top-[68px] md:scale-100">
                    {MINI_BAR_HEIGHTS.map((h, i) => (
                      <i key={i} style={{ height: `${h}px` }} className="w-1 rounded-sm bg-[#FF2D95]" />
                    ))}
                  </div>
                  <h3 className="mt-1.5 text-[25px] font-semibold tracking-[-0.03em] text-[#DBF2FC]">Forex</h3>
                  <p className="mt-2.5 max-w-[440px] text-[11px] leading-relaxed text-[#DBF2FC]/60 sm:text-[13px] sm:leading-relaxed">
                    Khám phá chuyển động của các cặp tiền tệ và luyện cách đọc bối cảnh trước khi đưa ra quyết định.
                  </p>
                  <span className="absolute bottom-3.5 left-4 font-mono text-[7px] tracking-[0.15em] text-[#DBF2FC]/45 sm:bottom-5 sm:left-6 sm:text-[8px]">
                    TƯƠNG QUAN · THỜI ĐIỂM · BỐI CẢNH
                  </span>
                </article>

                <p className="col-span-full -mt-0.5 font-mono text-[9px] leading-relaxed tracking-[0.06em] text-[#DBF2FC]/35">
                  Các trải nghiệm thị trường được thiết kế cho mục đích học tập và thực hành. Không phải khuyến nghị đầu tư.
                </p>
              </div>
            </div>
          </section>

          {/* Chapter 3: Community */}
          <section id="community" data-header-theme="dark" className={chapterClass(2)} aria-hidden={active !== 2}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(219,242,252,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(219,242,252,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(transparent,#000_22%,#000_78%,transparent)]" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-[10%] -z-10 aspect-square w-[440px] rounded-full bg-[#FF2D95] opacity-15 blur-[95px]" />

            <div className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-4 py-2 md:grid-cols-[1fr_0.86fr] md:gap-[70px] md:py-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2.5 font-mono text-[10px] font-semibold leading-snug tracking-[0.2em] text-[#DBF2FC]/60">
                  <span className="h-px w-6 bg-[#FF2D95] shadow-[0_0_12px_#FF2D95]" /> 03 / CỘNG ĐỒNG GIAO DỊCH
                </p>
                <h2 className={panelClass(2, "title", "mt-6 text-[clamp(34px,9.2vw,43px)] font-semibold leading-[1.04] tracking-[-0.055em] text-[#DBF2FC] sm:text-[clamp(40px,6vw,76px)]")}>
                  Quyết định của bạn.<br />
                  <span className="bg-linear-to-r from-[#DBF2FC] via-[#007BA7] to-[#FF2D95] bg-clip-text text-transparent">Góc nhìn của cả nhóm.</span>
                </h2>
                <div className={panelClass(2, "content")}>
                  <p className="mt-6 max-w-[600px] text-base leading-relaxed text-[#DBF2FC]/85 sm:text-[clamp(17px,2vw,21px)]">
                    Giao dịch nhóm biến việc phân tích thành một cuộc đối thoại — nơi mỗi góc nhìn đều giúp cả phòng học thêm điều mới.
                  </p>
                  <p className="mt-4 max-w-[570px] text-[13px] leading-relaxed text-[#DBF2FC]/55 sm:text-sm sm:leading-loose">
                    Cùng bước vào một phiên mô phỏng chung, chia sẻ luận điểm, theo dõi lựa chọn của nhau và cùng nhìn lại kết quả. Muốn thử sức? Tạo phòng thi đấu demo, so tài bằng chiến lược và bản lĩnh — không phải bằng áp lực tiền thật.
                  </p>
                  <a
                    href="/trade"
                    className="mt-7 inline-flex min-h-12 items-center gap-4 rounded-full border border-[#DBF2FC]/20 px-5 text-[13px] font-semibold text-[#DBF2FC] transition hover:-translate-y-0.5 hover:border-[#007BA7] hover:bg-[#007BA7]/20 motion-reduce:transition-none"
                  >
                    Bước vào Market Forge <span aria-hidden="true" className="text-lg text-[#FF2D95]">↗</span>
                  </a>
                </div>
              </div>

              <div className={panelClass(2, "content", "min-w-0 rounded-[19px] border border-[#DBF2FC]/15 bg-linear-to-br from-[#DBF2FC]/[0.06] to-[#DBF2FC]/[0.015] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.28),0_0_80px_rgba(255,45,149,0.07)] md:p-6")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.1em] text-[#DBF2FC]">
                    <i className="size-1.5 rounded-full bg-[#007BA7] shadow-[0_0_9px_#007BA7]" /> PHIÊN ĐANG DIỄN RA
                  </span>
                  <span className="font-mono text-[8px] tracking-[0.1em] text-[#DBF2FC]/50">ROUND 04 / 08</span>
                </div>
                <p className="my-5 text-lg font-medium text-[#DBF2FC] md:my-7">Thị trường tiếp theo sẽ đi đâu?</p>
                <div className="grid gap-3">
                  <div className="grid grid-cols-[47px_1fr_34px] items-center gap-2.5 font-mono text-[9px] text-[#DBF2FC]/60">
                    <span>LONG</span>
                    <b className="h-1 rounded-md bg-linear-to-r from-[#007BA7] to-[#DBF2FC]" style={{ width: "62%" }} />
                    <small className="text-right">62%</small>
                  </div>
                  <div className="grid grid-cols-[47px_1fr_34px] items-center gap-2.5 font-mono text-[9px] text-[#DBF2FC]/60">
                    <span>WAIT</span>
                    <b className="h-1 rounded-md bg-linear-to-r from-[#007BA7] to-[#FF2D95]" style={{ width: "24%" }} />
                    <small className="text-right">24%</small>
                  </div>
                  <div className="grid grid-cols-[47px_1fr_34px] items-center gap-2.5 font-mono text-[9px] text-[#DBF2FC]/60">
                    <span>SHORT</span>
                    <b className="h-1 rounded-md bg-linear-to-r from-[#FF2D95]/60 to-[#FF2D95]" style={{ width: "14%" }} />
                    <small className="text-right">14%</small>
                  </div>
                </div>
                <div className="mt-7 flex items-center border-t border-[#DBF2FC]/10 pt-4">
                  <span className="-mr-1.5 grid size-7 place-items-center rounded-full border-2 border-[#0A0A0A] bg-[#007BA7] font-mono text-[8px] text-[#DBF2FC]">AN</span>
                  <span className="-mr-1.5 grid size-7 place-items-center rounded-full border-2 border-[#0A0A0A] bg-[#FF2D95] font-mono text-[8px] text-[#0A0A0A]">MK</span>
                  <span className="-mr-1.5 grid size-7 place-items-center rounded-full border-2 border-[#0A0A0A] bg-[#007BA7]/70 font-mono text-[8px] text-[#DBF2FC]">LT</span>
                  <span className="-mr-1.5 grid size-7 place-items-center rounded-full border-2 border-[#0A0A0A] bg-[#1E1E1E] font-mono text-[8px] text-[#DBF2FC]">+8</span>
                  <small className="ml-4 text-[9px] text-[#DBF2FC]/50">12 người đang cùng phân tích</small>
                </div>
                <div className="mt-5 flex flex-col items-start justify-between gap-2 border-t border-[#DBF2FC]/10 pt-3.5 text-[9px] text-[#DBF2FC]/45 sm:flex-row sm:items-center">
                  <span>Quyết định được khóa trước khi mở biểu đồ tiếp theo</span>
                  <b className="shrink-0 font-mono text-[8px] text-[#FF2D95]">● ĐANG CHỜ</b>
                </div>
              </div>

              <a href="/" className="absolute -bottom-8 left-0 text-[11px] text-[#DBF2FC]/45 transition-colors hover:text-[#DBF2FC] md:bottom-0">
                ← Trở về trang chủ
              </a>
            </div>
          </section>
        </div>
      </div>

      <section data-header-theme="dark" className="relative isolate grid min-h-[250px] place-items-center overflow-hidden bg-[#0A0A0A] md:min-h-[320px]">
        <div className="absolute inset-0 -z-10 block size-full bg-[#0A0A0A]" />
        <div className="absolute inset-0 z-0 opacity-95">
          <HeroWaveBackground />
        </div>
        <div className="relative z-[1] rounded-full border border-[#DBF2FC]/15 bg-[#0A0A0A]/60 px-5 py-3 text-center font-mono text-[9px] tracking-[0.16em] text-[#DBF2FC]/80 backdrop-blur-md">
          MỌI QUYẾT ĐỊNH BẮT ĐẦU BẰNG MỘT GÓC NHÌN
        </div>
      </section>
    </div>
  );
}
