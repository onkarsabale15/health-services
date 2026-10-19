import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workflow Builder — Health Services',
  description: 'Visual workflow builder for healthcare integration pipelines',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
