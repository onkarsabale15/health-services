import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Health Services Admin',
  description: 'Admin dashboard for managing applications, EHR configurations, and users',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
