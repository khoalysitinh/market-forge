import { useEffect, useRef } from 'react';

export function HeroWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let lineCount = 55; // Tăng số lượng line lên để dải sóng dày và rậm hơn
    let gradient = context.createLinearGradient(0, 0, 1, 0);
    let frameId = 0;
    let previousTime = 0;
    let step = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    function resizeCanvas() {
      const rect = canvas!.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas!.width = Math.round(width * pixelRatio);
      canvas!.height = Math.round(height * pixelRatio);
      context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      // Thiết lập dải chuyển màu (Gradient) ngang qua màn hình
      gradient = context!.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#007BA7');   // Hồng san hô ở bên trái
      gradient.addColorStop(0.5, '#DBF2FC'); // Xanh băng ở vùng sáng giữa
      gradient.addColorStop(1, '#FF2D95');   // Xanh navy đậm chìm dần về phải

      // Điều chỉnh mật độ line theo chiều rộng màn hình để luôn dày dặn
      lineCount = Math.min(70, Math.max(45, Math.round(width / 25)));
      mouse.x = mouse.targetX = width / 2;
      mouse.y = mouse.targetY = height * 0.6;
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      const rect = canvas!.getBoundingClientRect();
      mouse.targetX = event.clientX - rect.left;
      mouse.targetY = event.clientY - rect.top;
    }

    function handlePointerLeave() {
      mouse.targetX = width / 2;
      mouse.targetY = height * 0.6;
    }

    function render(timestamp: number) {
      const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.034) : 0;
      previousTime = timestamp;
      const motionScale = reducedMotion ? 0.4 : 1;
      
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Xóa khung hình bằng màu đen tuyền có độ trong suốt nhẹ để tạo vệt mờ (motion trail) mượt mà
      context!.fillStyle = 'rgba(10, 10, 10, 0.25)';
      context!.fillRect(0, 0, width, height);
      step += delta * 0.9 * motionScale;

      const centerY = height * 0.6;
      context!.lineCap = 'round';
      context!.lineJoin = 'round';

      // Vòng lặp vẽ từng đường line để tạo độ dày khối sóng
      for (let index = 0; index < lineCount; index += 1) {
        context!.beginPath();
        context!.strokeStyle = gradient;

        // Tạo hiệu ứng ẩn hiện (Fade in / Fade out): Các line ở rìa mờ ảo, ở giữa sắc nét hơn
        const normalizedIndex = index / lineCount;
        const fadeAlpha = Math.sin(normalizedIndex * Math.PI); // Tạo đồ thị hình sin cho độ mờ
        
        context!.globalAlpha = Math.max(0.1, fadeAlpha * 0.65);
        context!.lineWidth = index % 3 === 0 ? 1.2 : 0.6; // Đan xen nét dày và mảnh

        for (let x = 0; x <= width; x += 8) { // Giảm bước nhảy xuống 8px để đường sóng cong mượt và chi tiết hơn
          const distanceToMouse = Math.abs(x - mouse.x);
          const mouseInfluence = Math.max(0, 1 - distanceToMouse / 320) * (mouse.y - centerY) * 0.3;
          
          // Công thức biên độ sóng kết hợp chồng chéo nhiều hàm sin/cos tạo sự uốn lượn tự nhiên
          const y = centerY
            + Math.sin(x * 0.003 + step + index * 0.035) * 50
            + Math.cos(x * 0.007 - step * 0.5) * 22
            + (index - lineCount / 2) * 1.2 // Khoảng cách giữa các lớp line
            + mouseInfluence * Math.sin(x * 0.01);

          if (x === 0) context!.moveTo(x, y);
          else context!.lineTo(x, y);
        }

        context!.stroke();
      }

      context!.globalAlpha = 1;
      frameId = window.requestAnimationFrame(render);
    }

    resizeCanvas();
    canvas.addEventListener('pointermove', handlePointerMove, { passive: true });
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('resize', resizeCanvas, { passive: true });
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Đảm bảo background thẻ canvas và container chuẩn màu đen #0A0A0A
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block size-full bg-[#0A0A0A]" />;
}