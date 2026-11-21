import { useEffect, useState } from 'react'
import { AppFooter } from './components/AppFooter'
import { AppHeader } from './components/AppHeader'
import { AuthPage } from './pages/AuthPage'
import { LandingPage } from './pages/LandingPage'
import { TradePage } from './pages/TradePage'
import { AboutPage } from './pages/AboutPage'
import { CommunityPage } from './pages/CommunityPage'
import { CommunityDocsPage } from './pages/CommunityDocsPage'
import { ProfilePage } from './pages/ProfilePage'

type Route = 'home' | 'trade' | 'login' | 'signup' | 'about' | 'community' | 'community-docs' | 'profile'

function getRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (window.location.hash === '#/login') return 'login'
  if (window.location.hash === '#/signup') return 'signup'
  if (path === '/trade') return 'trade'
  if (path === '/login') return 'login'
  if (path === '/signup') return 'signup'
  if (path === '/about') return 'about'
  if (path === '/community/docs') return 'community-docs'
  if (path === '/community') return 'community'
  if (path === '/profile') return 'profile'
  return 'home'
}

export function App() {
  const [route, setRoute] = useState<Route>(getRoute)

  useEffect(() => {
    const syncRoute = () => setRoute(getRoute())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  const isTradeRoute = route === 'trade'
  const isAuthRoute = route === 'login' || route === 'signup'
  const isCommunityRoute = route === 'community'
  const isDocsRoute = route === 'community-docs'

  // Routes that suppress the shared header/footer
  const suppressChrome = isTradeRoute || isAuthRoute || isCommunityRoute

  return (
    <div
      className={`flex flex-col font-sans antialiased bg-[#0A0A0A] text-[#DBF2FC] ${
        isTradeRoute || isCommunityRoute ? 'h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      {!suppressChrome && <AppHeader />}
      <main className={`flex-1 ${isTradeRoute || isCommunityRoute ? 'min-h-0' : ''}`}>
        {isTradeRoute ? (
          <TradePage />
        ) : isCommunityRoute ? (
          <CommunityPage />
        ) : isDocsRoute ? (
          <CommunityDocsPage />
        ) : route === 'profile' ? (
          <ProfilePage />
        ) : route === 'login' || route === 'signup' ? (
          <AuthPage key={route} mode={route} />
        ) : route === 'about' ? (
          <AboutPage />
        ) : (
          <LandingPage />
        )}
      </main>
      {!suppressChrome && !isDocsRoute && <AppFooter />}
    </div>
  )
}
