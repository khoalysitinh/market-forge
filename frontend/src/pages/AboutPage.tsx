import { useEffect, useRef, useState, type MouseEvent } from "react";
import { HeroWaveBackground } from "../components/HeroWaveBackground";

const CHAPTERS = [
  { id: "platform", number: "01", label: "Market Forge", title: "Thị trường rộng lớn.\nKhông gian để rèn luyện." },
  { id: "ecosystem", number: "02", label: "Một hệ sinh thái", title: "Nhiều thị trường.\nMột tư duy vững vàng." },
  { id: "community", number: "03", label: "Giao dịch cùng nhau", title: "Quyết định của bạn.\nGóc nhìn của cả nhóm." },
];

export function AboutPage() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const wheelLocked = useRef(false);
  const queuedDirection = useRef(0);
  const unlockTimer = useRef<number | undefined>(undefined);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const journey = document.querySelector<HTMLElement>(".about-journey");
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

  const chapterClass = (index: number, base: string) => `${base} ${index === active ? "is-current" : index < active ? "is-past" : "is-future"}`;
  const panelClass = (index: number, side: "title" | "content", extra = "") => `${extra} about-panel about-panel-${side} ${index === active ? "is-current" : index < active ? "is-past" : "is-future"}`.trim();
  const goToChapter = (index: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    queuedDirection.current = 0;
    window.clearTimeout(unlockTimer.current);
    wheelLocked.current = false;
    activeRef.current = index;
    setActive(index);
  };

  return (
    <div className="about-experience bg-[#0A0A0A] text-white">
      <div className="about-progress" aria-hidden="true"><span style={{ transform: `scaleY(${(active + 1) / CHAPTERS.length})` }} /></div>
      <nav aria-label="Các phần giới thiệu" className="about-chapter-nav">
        {CHAPTERS.map((chapter, index) => <a key={chapter.id} href={`#${chapter.id}`} onClick={goToChapter(index)} aria-label={`Phần ${chapter.number}: ${chapter.label}`} aria-current={active === index ? "step" : undefined} className={active === index ? "is-active" : ""}><span>{chapter.number}</span></a>)}
      </nav>
      <nav aria-label="Breadcrumb" className="about-breadcrumb"><a href="/" aria-label="Về trang chủ" title="Về trang chủ"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-6h-5v6h-6V10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg></a><span aria-hidden="true">›</span><span>Về chúng tôi</span></nav>

      <div className="about-journey" aria-label="Giới thiệu Market Forge qua ba phần">
      <div className="about-journey-stage">
      <section id="platform" data-header-theme="dark" className={chapterClass(0, "about-chapter about-intro")} aria-hidden={active !== 0}>
        <div aria-hidden="true" className="about-orb about-orb-blue" />
        <div aria-hidden="true" className="about-orb about-orb-pink" />
        <div className="about-chapter-inner about-intro-grid">
          <div className="about-intro-copy">
            <p className="about-kicker"><span /> MARKET FORGE · GIỚI THIỆU</p>
            <h1 className={panelClass(0, "title")}>Thị trường rộng lớn.<br /><span>Không gian để rèn luyện.</span></h1>
            <div className={panelClass(0, "content")}>
            <p className="about-lead">Market Forge là nền tảng giao dịch thương mại số nơi bạn có thể khám phá thị trường, rèn tư duy chiến lược và tiến bộ qua từng quyết định.</p>
            <p className="about-body">Thay vì chạy theo biến động, chúng tôi tạo ra một không gian rõ ràng để người giao dịch quan sát, thực hành và hiểu lý do đằng sau mỗi lựa chọn. Một hành trình bắt đầu bằng tò mò, được củng cố bằng kỷ luật.</p>
            <a href="#ecosystem" onClick={goToChapter(1)} className="about-next">Khám phá hệ sinh thái <span aria-hidden="true">↓</span></a>
            </div>
          </div>
          <div className="about-signal" aria-label="Minh họa nhịp chuyển động của thị trường">
            <div className="about-signal-ring about-ring-outer" /><div className="about-signal-ring about-ring-inner" />
            <div className="about-signal-core"><span>MF</span><small>MARKET<br />SIGNAL</small></div>
            <div className="about-chart-label label-top">OBSERVE <b>01</b></div><div className="about-chart-label label-bottom">DECIDE <b>02</b></div>
            <svg aria-hidden="true" viewBox="0 0 480 300" className="about-chart"><path d="M18 224 84 196 128 215 184 142 226 168 278 101 324 127 378 57 460 76" fill="none" stroke="url(#chart-line)" strokeWidth="2"/><defs><linearGradient id="chart-line"><stop stopColor="#007BA7"/><stop offset="1" stopColor="#FF2D95"/></linearGradient></defs></svg>
          </div>
          <a href="#ecosystem" onClick={goToChapter(1)} className="about-scroll-cue"><span /> LƯỚT ĐỂ KHÁM PHÁ</a>
        </div>
      </section>

      <section id="ecosystem" data-header-theme="dark" className={chapterClass(1, "about-chapter about-ecosystem")} aria-hidden={active !== 1}>
        <div aria-hidden="true" className="about-orb about-orb-blue ecosystem-glow" />
        <div className="about-chapter-inner">
          <div className="about-section-heading"><p className="about-kicker"><span /> 02 / HỆ SINH THÁI ĐA DẠNG</p><h2 className={panelClass(1, "title")}>Nhiều thị trường.<br /><span>Một tư duy vững vàng.</span></h2><div className={panelClass(1, "content")}><p className="about-lead">Mở rộng góc nhìn qua những thị trường có nhịp điệu và đặc trưng riêng.</p></div></div>
          <div className={panelClass(1, "content", "about-markets")}>
            <article className="about-market-card"><div className="market-card-top"><span className="market-index">A / 01</span><span className="market-glyph">↗</span></div><div className="market-mini-chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><h3>Futures</h3><p>Quan sát sức mạnh xu hướng và nhịp biến động. Thực hành xây dựng kế hoạch theo kịch bản với dữ liệu mô phỏng.</p><span className="market-tag">CẤU TRÚC · ĐỘNG LƯỢNG · KỶ LUẬT</span></article>
            <article className="about-market-card market-card-accent"><div className="market-card-top"><span className="market-index">B / 02</span><span className="market-glyph">⌁</span></div><div className="market-mini-chart"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><h3>Forex</h3><p>Khám phá chuyển động của các cặp tiền tệ và luyện cách đọc bối cảnh trước khi đưa ra quyết định.</p><span className="market-tag">TƯƠNG QUAN · THỜI ĐIỂM · BỐI CẢNH</span></article>
            <p className="about-disclaimer">Các trải nghiệm thị trường được thiết kế cho mục đích học tập và thực hành. Không phải khuyến nghị đầu tư.</p>
          </div>
        </div>
      </section>

      <section id="community" data-header-theme="dark" className={chapterClass(2, "about-chapter about-community")} aria-hidden={active !== 2}>
        <div aria-hidden="true" className="about-orb about-orb-pink community-glow" />
        <div className="about-chapter-inner about-community-grid">
          <div className="about-community-copy"><p className="about-kicker"><span /> 03 / CỘNG ĐỒNG GIAO DỊCH</p><h2 className={panelClass(2, "title")}>Quyết định của bạn.<br /><span>Góc nhìn của cả nhóm.</span></h2><div className={panelClass(2, "content")}><p className="about-lead">Giao dịch nhóm biến việc phân tích thành một cuộc đối thoại — nơi mỗi góc nhìn đều giúp cả phòng học thêm điều mới.</p><p className="about-body">Cùng bước vào một phiên mô phỏng chung, chia sẻ luận điểm, theo dõi lựa chọn của nhau và cùng nhìn lại kết quả. Muốn thử sức? Tạo phòng thi đấu demo, so tài bằng chiến lược và bản lĩnh — không phải bằng áp lực tiền thật.</p><a href="/trade" className="about-cta">Bước vào Market Forge <span aria-hidden="true">↗</span></a></div></div>
          <div className={panelClass(2, "content", "about-room")}><div className="room-top"><span className="room-live"><i/> PHIÊN ĐANG DIỄN RA</span><span className="room-round">ROUND 04 / 08</span></div><p className="room-question">Thị trường tiếp theo sẽ đi đâu?</p><div className="room-options"><div><span>LONG</span><b style={{ width: "62%" }}/><small>62%</small></div><div><span>WAIT</span><b style={{ width: "24%" }}/><small>24%</small></div><div><span>SHORT</span><b style={{ width: "14%" }}/><small>14%</small></div></div><div className="room-avatars"><span>AN</span><span>MK</span><span>LT</span><span>+8</span><small>12 người đang cùng phân tích</small></div><div className="room-foot"><span>Quyết định được khóa trước khi mở biểu đồ tiếp theo</span><b>● ĐANG CHỜ</b></div></div>
          <a href="/" className="about-home-link">← Trở về trang chủ</a>
        </div>
      </section>
      </div>
      </div>

      <section data-header-theme="dark" className="about-wave-ending"><div className="absolute inset-0 block size-full bg-[#0A0A0A]" /><div className="about-wave-line"><HeroWaveBackground /></div><div className="about-wave-caption">MỌI QUYẾT ĐỊNH BẮT ĐẦU BẰNG MỘT GÓC NHÌN</div></section>
    </div>
  );
}
