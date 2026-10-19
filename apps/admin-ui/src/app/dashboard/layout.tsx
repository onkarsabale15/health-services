'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, getRefreshToken, clearAuth, AuthUser } from '@/lib/auth';
import { configureAdminClient } from '@/lib/admin-client';
import { authControllerLogout } from '@/lib/sdk/generated';
import { ToastProvider, useToast } from '@/components/toast';
import { DeploymentEnvBadge } from '@/components/deployment-env-badge';

configureAdminClient();

const NAV_ITEMS = [
  {
    href: '/dashboard/applications',
    label: 'Applications',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
        />
      </svg>
    ),
  },
  {
    href: '/dashboard/end-users',
    label: 'End Users',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        />
      </svg>
    ),
  },
  {
    href: '/dashboard/users',
    label: 'Operators',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
    ),
  },
  {
    href: '/dashboard/organization',
    label: 'Organization',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"
        />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace('/auth/signin');
      return;
    }
    setUser(u);
  }, [router]);

  async function handleSignOut() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await authControllerLogout({ body: { refreshToken } }).catch(() => {});
    }
    clearAuth();
    router.replace('/auth/signin');
  }

  if (!user) return null;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface flex">
        {/* Sidebar (Sovereign Clinician Style) */}
        <aside
          className={`bg-surface-container-low transition-all duration-300 border-r border-surface-container-DEFAULT flex flex-col z-30 ${
            isSidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
          <div className="h-16 flex items-center px-6 gap-3 border-b border-surface-container-DEFAULT bg-surface-container-low/50">
            <div className="w-8 h-8 bg-primary rounded-round-four flex-shrink-0 flex items-center justify-center text-white font-bold">
              IB
            </div>
            {isSidebarOpen && <span className="font-bold text-surface-on tracking-tight">Admin Portal</span>}
          </div>

          <nav className="flex-1 py-6 px-3 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-round-four transition-all group ${
                    isActive
                      ? 'bg-primary text-white shadow-ambient shadow-primary/20'
                      : 'text-surface-on-variant hover:bg-surface-container-DEFAULT'
                  }`}
                  title={!isSidebarOpen ? item.label : ''}
                >
                  <div
                    className={`${isActive ? 'text-white' : 'text-primary group-hover:scale-110 transition-transform'}`}
                  >
                    {item.icon}
                  </div>
                  {isSidebarOpen && <span className="text-sm font-semibold">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-surface-container-DEFAULT space-y-2">
            <a
              href={process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3006'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 text-surface-on-variant hover:text-primary transition-colors group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 group-hover:scale-110 transition-transform"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25"
                />
              </svg>
              {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">Documentation</span>}
            </a>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="flex items-center gap-3 px-3 py-2 w-full text-surface-on-variant hover:text-primary transition-colors group"
            >
              <div className={`transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </div>
              {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">Collapse View</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Bar (Glassmorphism Style) */}
          <header className="h-16 aegis-glass border-b border-surface-container-DEFAULT flex items-center justify-between px-8 z-20 sticky top-0">
            <div className="flex items-center gap-4">
              <span className="badge badge-production lowercase">{user.organizationName}</span>
              <div className="h-4 w-px bg-surface-container-DEFAULT" />
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">Admin Control Plane</span>
              <DeploymentEnvBadge />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-primary border border-primary/10 font-bold text-xs uppercase">
                  {user.firstName?.[0] ?? ''}
                  {user.lastName?.[0] ?? ''}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-surface-on leading-none">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-surface-on-variant font-medium mt-1 uppercase tracking-tighter">
                    {user.role}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-error hover:bg-error/5 px-3 py-1.5 rounded-round-four text-xs font-bold uppercase tracking-widest transition-colors border border-transparent hover:border-error/20"
              >
                Sign Out
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
