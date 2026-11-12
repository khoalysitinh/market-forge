import { useState, Suspense, lazy } from 'react';

// Lazy load Spline to keep initial bundle light and avoid blocking initial paint
const Spline = lazy(() => import('@splinetool/react-spline'));

interface SplineBackgroundProps {
  /**
   * Public .splinecode scene URL from Spline export (e.g. https://prod.spline.design/.../scene.splinecode)
   */
  scene?: string;
  /**
   * Static image fallback while loading or if offline
   */
  fallbackImage?: string;
  className?: string;
}

export function SplineBackground({
  scene = 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
  fallbackImage = '/images/bannerhero.png',
  className = '',
}: SplineBackgroundProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`absolute inset-0 -z-20 overflow-hidden ${className}`}>
      {/* 1. Static Image Fallback (Always rendered under, fades out slightly once Spline loads) */}
      <img
        src={fallbackImage}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 size-full object-cover object-[64%_center] transition-opacity duration-1000 ${
          isLoaded && !hasError ? 'opacity-30' : 'opacity-100'
        }`}
      />

      {/* 2. Interactive 3D Spline Scene */}
      {!hasError && (
        <div
          className={`absolute inset-0 size-full transition-opacity duration-1000 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Suspense fallback={null}>
            <Spline
              scene={scene}
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                console.warn('Spline 3D background failed to load, falling back to static image.');
                setHasError(true);
              }}
              className="size-full"
            />
          </Suspense>
        </div>
      )}

      {/* 3. Subtle ambient light glow on the right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 bottom-10 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-3xl"
      />
    </div>
  );
}

