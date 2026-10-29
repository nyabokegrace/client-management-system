import React from 'react';
import './globals.css';
import { AppShell } from '../components/AppShell';

export const metadata = {
  title: 'Siwolo P.O Law Advocates — Client & Case Management',
  description: 'Internal Client and Case Management System for Siwolo P.O Law Advocates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex bg-[#F3F4F6] text-[#111111]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
