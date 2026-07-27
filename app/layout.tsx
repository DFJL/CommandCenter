import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clinical Delivery Command Center',
  description: 'Clinical Delivery Command Center — Pharma Study Portfolio Tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{ background: '#1a5c38' }}
          className="flex items-center justify-between px-4 py-3 shadow-lg border-b border-white/10"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl flex-shrink-0">🏥</span>
            <span className="text-white font-semibold text-sm sm:text-lg tracking-wide truncate">
              <span className="hidden sm:inline">Clinical Delivery Command Center</span>
              <span className="sm:hidden">Command Center</span>
            </span>
          </div>
          <div
            className="text-xs sm:text-sm font-medium flex-shrink-0 ml-2"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            <span className="hidden sm:inline">Biometrics · </span>LATAM 2026
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
