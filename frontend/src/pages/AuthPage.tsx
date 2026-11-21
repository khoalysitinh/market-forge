import { useEffect, useState, type FormEvent } from "react";
import { request } from "../api/client";

type AuthMode = "login" | "signup";
type AuthStep = "identifier" | "password";

function isVietnamPhonePrefix(value: string): boolean {
  const normalized = value.replace(/[\s().-]/g, "");
  return /^(?:0\d{0,9}|\+84\d{0,9})$/.test(normalized);
}

function AuthDivider() {
  return <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>or continue with email</span><span className="h-px flex-1 bg-slate-200"/></div>;
}

function ProviderButton({ provider, onClick }: { provider: "Google" | "Gmail" | "Passkey"; onClick: () => void }) {
  const mark = provider === "Google" ? <span aria-hidden="true" className="font-sans text-xl font-bold text-[#4285f4]">G</span>
    : provider === "Gmail" ? <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M3 6.8v11.5c0 .9.7 1.7 1.7 1.7h2.1V9.7L3 6.8Z"/><path fill="#34A853" d="M17.2 20h2.1c.9 0 1.7-.8 1.7-1.7V6.8l-3.8 2.9V20Z"/><path fill="#FBBC04" d="M17.2 7.9v3.8l3.8-2.9V7.2c0-1.8-2-2.8-3.4-1.7l-.4.3v2.1Z"/><path fill="#EA4335" d="M4.7 5.5C3.3 4.4 1.3 5.4 1.3 7.2v1.6l3.8 2.9V7.9l-.4-2.1Z"/><path fill="#C5221F" d="m4.7 5.5 7.3 5.6 7.3-5.6v4.4L12 15.5 4.7 9.9V5.5Z"/></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth="1.8"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2m-6 2v.01"/></svg>;
  return <button type="button" onClick={onClick} className="relative flex h-14 w-full items-center justify-center gap-3 rounded-full bg-slate-100 px-4 text-base font-medium text-slate-900 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#54acbf]">
    <span className="absolute left-5">{mark}</span>
    <span>{provider === "Passkey" ? "Continue with a passkey" : `Continue with ${provider}`}</span>
  </button>;
}

type UsernameCheck = "idle" | "checking" | "available" | "taken" | "error";

function usernameSuggestion(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function SignupForm({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>("idle");
  const [checkedUsername, setCheckedUsername] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!usernameEdited) setUsername(usernameSuggestion(fullName));
  }, [fullName, usernameEdited]);

  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(normalized)) {
      setUsernameCheck("idle");
      setCheckedUsername("");
      return;
    }

    const controller = new AbortController();
    setUsernameCheck("checking");
    setCheckedUsername("");
    const timer = window.setTimeout(() => {
      request<{ available: boolean }>(`/auth/username-availability?username=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      }).then((result) => {
        if (controller.signal.aborted) return;
        setCheckedUsername(normalized);
        setUsernameCheck(result.available ? "available" : "taken");
      })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCheckedUsername(normalized);
            setUsernameCheck("error");
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [username, checkAttempt]);

  const validName = fullName.trim().length > 0 && [...fullName.trim()].length <= 64;
  const validUsername = /^[a-z0-9_]{3,32}$/.test(username.trim().toLowerCase());
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordBytes = new TextEncoder().encode(password).length;
  const validPassword = [...password].length >= 10 && passwordBytes <= 72;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const currentUsername = username.trim().toLowerCase();
  const usernameIsAvailable = usernameCheck === "available" && checkedUsername === currentUsername;
  const canSubmit = validName && validUsername && usernameIsAvailable && validEmail &&
    validPassword && passwordsMatch && acceptedTerms;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setMessage("Thông tin hợp lệ. Cần nối API POST /auth/register để tạo tài khoản.");
  }

  return (
    <>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="signup-full-name" className="block text-sm font-medium text-slate-600">Họ &amp; Tên</label>
          <input id="signup-full-name" autoComplete="name" required aria-invalid={!validName && fullName.length > 0} aria-describedby="signup-name-help" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nhập họ và tên" className="h-14 w-full rounded-xl border border-transparent bg-slate-100 px-4 text-base text-slate-950 outline-none transition focus:border-[#54acbf] focus:bg-white focus:ring-4 focus:ring-[#54acbf]/15 placeholder:text-slate-400" />
          <p id="signup-name-help" aria-live="polite" className="text-xs text-rose-600">{fullName.trim().length > 64 ? "Họ & Tên tối đa 64 ký tự." : ""}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-username" className="block text-sm font-medium text-slate-600">Username</label>
          <div className="flex h-14 items-center rounded-xl border border-transparent bg-slate-100 transition focus-within:border-[#54acbf] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#54acbf]/15">
            <span aria-hidden="true" className="select-none pl-4 text-base text-slate-400">@</span>
            <input id="signup-username" autoComplete="username" required aria-invalid={!validUsername && username.length > 0 || usernameCheck === "taken"} value={username} onChange={(event) => { setUsernameEdited(true); setUsername(event.target.value.toLowerCase()); }} placeholder="username" aria-describedby="signup-username-help" className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-slate-950 outline-none placeholder:text-slate-400" />
          </div>
          <p id="signup-username-help" aria-live="polite" className="min-h-4 text-xs text-slate-500">
            {usernameCheck === "checking" ? "Đang kiểm tra username…" :
              usernameCheck === "available" ? "Username này có thể sử dụng." :
                usernameCheck === "taken" ? "Username đã được sử dụng. Hãy chọn tên khác." :
                  usernameCheck === "error" ? <>Không thể kiểm tra username lúc này. <button type="button" className="font-semibold text-[#26658c] underline" onClick={() => setCheckAttempt((attempt) => attempt + 1)}>Thử lại</button></> :
                    "3–32 ký tự: chữ thường, số hoặc dấu gạch dưới."}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-sm font-medium text-slate-600">Email</label>
          <input id="signup-email" type="email" autoComplete="email" required aria-invalid={!validEmail && email.length > 0} aria-describedby="signup-email-help" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-14 w-full rounded-xl border border-transparent bg-slate-100 px-4 text-base text-slate-950 outline-none transition focus:border-[#54acbf] focus:bg-white focus:ring-4 focus:ring-[#54acbf]/15 placeholder:text-slate-400" />
          <p id="signup-email-help" aria-live="polite" className="text-xs text-rose-600">{email.length > 0 && !validEmail ? "Vui lòng nhập email hợp lệ." : ""}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-sm font-medium text-slate-600">Mật khẩu</label>
          <div className="flex h-14 items-center rounded-xl border border-transparent bg-slate-100 transition focus-within:border-[#54acbf] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#54acbf]/15">
            <input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required aria-invalid={password.length > 0 && !validPassword} aria-describedby="signup-password-help" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ít nhất 10 ký tự" className="h-full min-w-0 flex-1 bg-transparent px-4 text-base text-slate-950 outline-none placeholder:text-slate-400" />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="mr-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-200">{showPassword ? "Ẩn" : "Hiện"}</button>
          </div>
          <p id="signup-password-help" aria-live="polite" className="text-xs text-slate-500">{passwordBytes > 72 ? "Mật khẩu tối đa 72 byte." : password && !validPassword ? "Mật khẩu cần ít nhất 10 ký tự." : "Ít nhất 10 ký tự, tối đa 72 byte."}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-slate-600">Nhập lại mật khẩu</label>
          <input id="signup-confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required aria-invalid={confirmPassword.length > 0 && !passwordsMatch} aria-describedby="signup-confirm-help" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" className="h-14 w-full rounded-xl border border-transparent bg-slate-100 px-4 text-base text-slate-950 outline-none transition focus:border-[#54acbf] focus:bg-white focus:ring-4 focus:ring-[#54acbf]/15 placeholder:text-slate-400" />
          <p id="signup-confirm-help" aria-live="polite" className="text-xs text-rose-600">{confirmPassword && !passwordsMatch ? "Hai mật khẩu chưa khớp." : ""}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-slate-600">
          <input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 size-4 accent-[#54acbf]" />
          <span>Tôi đồng ý với <a href="#terms" className="font-medium text-[#26658c] underline">Điều khoản sử dụng</a> và <a href="#privacy" className="font-medium text-[#26658c] underline">Chính sách quyền riêng tư</a>.</span>
        </label>

        {message && <p role="status" className="rounded-xl border border-[#54acbf]/25 bg-[#54acbf]/10 px-3 py-2.5 text-xs leading-5 text-[#023859]">{message}</p>}
        {!canSubmit && <p id="signup-submit-help" aria-live="polite" className="text-center text-xs text-slate-500">Điền đầy đủ thông tin, chọn username còn trống và đồng ý điều khoản để đăng ký.</p>}
        <button type="submit" disabled={!canSubmit} aria-describedby={!canSubmit ? "signup-submit-help" : undefined} className={`h-14 w-full rounded-full px-5 text-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c] ${canSubmit ? "bg-[#54acbf] text-[#00050d] hover:bg-[#a7ebf2]" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}>Đăng ký</button>
      </form>
      <p className="mt-6 text-center text-base text-slate-500">Đã có tài khoản? <button type="button" onClick={onSwitchMode} className="font-semibold text-[#26658c] hover:text-[#011c40]">Đăng nhập</button></p>
    </>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const [step, setStep] = useState<AuthStep>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const isLogin = mode === "login";
  const isVNPhone = isVietnamPhonePrefix(identifier.trim());

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }

  function switchAuthMode(nextMode: AuthMode) {
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = `/${nextMode}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (step === "identifier") {
      const value = identifier.trim();
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const phoneDigits = value.replace(/\D/g, "").length;
      const validPhone = /^\+?[\d\s().-]+$/.test(value) && phoneDigits >= 7 && phoneDigits <= 15;
      if (!(validEmail || validPhone)) {
        setMessage("Enter a valid email address or phone number to continue.");
        return;
      }
      setStep("password");
      return;
    }
    if (password.length < 10) {
      setMessage("Your password must be at least 10 characters.");
      return;
    }
    setMessage(isLogin
      ? "Sign-in is ready to connect to the Market Forge account service."
      : "Sign-up is ready to connect to the Market Forge account service.");
  }

  function providerNotice(provider: string) {
    setMessage(`${provider} sign-in is not connected yet. Continue with your email or phone for now.`);
  }

  return <div className="relative min-h-screen bg-[#00050d] text-white">
    <button type="button" onClick={goBack} aria-label="Go back" title="Go back" className="absolute right-4 top-4 z-30 grid size-12 place-items-center text-4xl font-light leading-none text-white transition-colors hover:text-[#a7ebf2] focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7ebf2] sm:right-6 sm:top-6">
      <span aria-hidden="true">×</span>
    </button>
    <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-2">
      <section className="relative flex min-h-[280px] flex-col justify-between overflow-hidden px-6 py-6 sm:min-h-[360px] sm:px-10 sm:py-8 lg:min-h-screen lg:px-12 lg:py-10 xl:px-20">
        <a href="/" aria-label="Market Forge home" className="relative z-10 w-fit"><img src="/images/market-forge-logo-full.png" alt="Market Forge" className="h-9 w-fit object-contain sm:h-11" width="1936" height="350" /></a>
        <div className="absolute inset-0 opacity-70">
          <img src="/images/bannerhero.png" alt="" className="size-full object-cover object-[66%_center]" />
          <div className="absolute inset-0 bg-linear-to-b from-[#00050d]/80 via-[#00050d]/25 to-[#00050d]" />
          <div className="absolute inset-0 bg-linear-to-r from-[#00050d]/35 to-transparent" />
        </div>
        <div className="relative z-10 mt-14 max-w-2xl sm:mt-20 lg:mt-auto lg:pb-[12vh]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#a7ebf2] sm:text-sm">Market Forge · Trading practice</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-7xl">{isLogin ? "Return to your practice." : "Build better market habits."}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-xl sm:leading-9">{isLogin ? "Pick up where your group left off. Review the chart, share your reasoning, and keep learning together." : "Create an account to practice with a shared market, a clear replay, and decisions worth discussing."}</p>
          <div className="mt-7 flex flex-wrap gap-2.5 sm:mt-9">
            {["Synthetic markets", "Private decisions", "Group review"].map((label) => <span key={label} className="rounded-full border border-[#a7ebf2]/20 bg-[#011c40]/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#c8f4f7] sm:text-xs">{label}</span>)}
          </div>
        </div>
        <p className="relative z-10 mt-8 hidden font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 lg:block">A calmer place to practice market decisions.</p>
      </section>

      <section className="flex items-center justify-center bg-[#00050d] px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
        <div className="w-full max-w-[520px] rounded-[1.75rem] bg-white px-6 py-7 text-slate-950 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:px-10 sm:py-10 lg:px-11 lg:py-11">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#26658c]">{isLogin ? "Welcome back" : "Start practicing"}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{step === "password" ? "Enter your password" : isLogin ? "Log in to Market Forge" : "Create your account"}</h2>
              <p className="mt-2 text-base leading-6 text-slate-500">{step === "password" ? identifier : isLogin ? "Continue with your email or phone number." : "Join your group and make your first practice session."}</p>
            </div>
            {step === "password" && <button type="button" onClick={() => { setStep("identifier"); setPassword(""); setMessage(""); }} className="rounded-full px-3 py-2 text-xs font-semibold text-[#26658c] hover:bg-slate-100">Change</button>}
          </div>

          {isLogin ? <>
          {step === "identifier" && <div className="mt-7 space-y-3">
            <ProviderButton provider="Passkey" onClick={() => providerNotice("Passkey")} />
            <ProviderButton provider="Google" onClick={() => providerNotice("Google")} />
            <ProviderButton provider="Gmail" onClick={() => providerNotice("Gmail")} />
            <AuthDivider />
          </div>}

          <form onSubmit={handleContinue} className="mt-5 space-y-4" noValidate>
            {step === "identifier" ? <>
              <label htmlFor="auth-identifier" className="block text-sm font-medium text-slate-600">Email or phone number</label>
              <div className="flex h-16 items-center rounded-xl border border-transparent bg-slate-100 transition focus-within:border-[#54acbf] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#54acbf]/15">
                {isVNPhone && <span className="shrink-0 pl-4 text-sm text-slate-500" aria-label="Việt Nam"><span aria-hidden="true">🇻🇳</span></span>}
                <input id="auth-identifier" type="text" inputMode={isVNPhone ? "tel" : "email"} autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter your email or phone number" className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-4 text-base text-slate-950 outline-none placeholder:text-slate-400" />
              </div>
            </> : <>
              <label htmlFor="auth-password" className="block text-sm font-medium text-slate-600">Password</label>
              <div className="flex h-16 items-center rounded-xl border border-transparent bg-slate-100 transition focus-within:border-[#54acbf] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#54acbf]/15">
                <input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password (10+ characters)" className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-4 text-base text-slate-950 outline-none placeholder:text-slate-400" />
                <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="mr-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-200">{showPassword ? "Hide" : "Show"}</button>
              </div>
              {isLogin && <button type="button" onClick={() => setMessage("Password recovery will be available when account services are connected.")} className="text-xs font-semibold text-[#26658c] hover:text-[#011c40]">Forgot password?</button>}
            </>}

            {message && <p role="status" className="rounded-xl border border-[#54acbf]/25 bg-[#54acbf]/10 px-3 py-2.5 text-xs leading-5 text-[#023859]">{message}</p>}
            <button type="submit" className="h-16 w-full rounded-full bg-[#54acbf] px-5 text-lg font-semibold text-[#00050d] transition hover:bg-[#a7ebf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c]">{step === "password" ? isLogin ? "Log in" : "Create account" : "Continue"}</button>
          </form>

          <p className="mt-7 text-center text-base text-slate-500">{isLogin ? "Don't have an account?" : "Already have an account?"}{" "}<a href={isLogin ? "#/signup" : "#/login"} onClick={(event) => { event.preventDefault(); switchAuthMode(isLogin ? "signup" : "login"); }} className="font-semibold text-[#26658c] hover:text-[#011c40]">{isLogin ? "Sign up" : "Log in"}</a></p>
          <p className="mt-5 text-center text-xs leading-6 text-slate-400">By continuing, you agree to the <button type="button" onClick={() => setMessage("Terms of Use will be available soon.")} className="underline underline-offset-2">Terms of Use</button> and <button type="button" onClick={() => setMessage("Privacy Policy will be available soon.")} className="underline underline-offset-2">Privacy Policy</button>.</p>
          </> : <SignupForm onSwitchMode={() => switchAuthMode("login")} />}
        </div>
      </section>
    </div>
  </div>;
}
