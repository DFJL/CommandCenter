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
          className="flex items-center justify-between px-6 py-3 shadow-lg border-b border-white/10"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🏥</span>
            <span className="text-white font-semibold text-lg tracking-wide">
              Clinical Delivery Command Center
            </span>
          </div>
          <div
            className="text-sm font-medium"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            Biometrics · LATAM 2026
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
