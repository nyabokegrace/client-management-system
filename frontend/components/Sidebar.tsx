'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  Clock,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { User } from '../types';

interface SidebarProps {
  currentUser?: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser: initialUser }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(initialUser || null);

  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const stored = localStorage.getItem('siwolo_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, [user]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Matters & Legal Files', href: '/matters', icon: Briefcase },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Case Progress', href: '/case-updates', icon: Clock },
    { name: 'Calendar & Hearings', href: '/hearings', icon: Calendar },
    { name: 'Tasks & Deadlines', href: '/tasks', icon: CheckSquare },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    router.push('/login');
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#111111] text-white">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-[#222222] border border-[#333333] flex items-center justify-center text-white">
            <Scale className="w-5 h-5 text-gray-200" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wider uppercase text-gray-100">
              Siwolo P.O
            </h1>
            <p className="text-[11px] text-gray-400 font-medium tracking-tight">
              Law Advocates CMS
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center px-3 py-2.5 text-xs font-medium rounded transition-colors ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-gray-300 hover:bg-[#222222] hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 mr-3 flex-shrink-0 ${
                  isActive ? 'text-black' : 'text-gray-400'
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-[#262626] bg-[#161616]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#2a2a2a] border border-[#3a3a3a] flex items-center justify-center text-xs font-semibold text-gray-200 uppercase">
              {user?.first_name ? user.first_name[0] : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-200 truncate">
                {user?.full_name || user?.username || 'Staff Member'}
              </p>
              <div className="flex items-center text-[10px] text-gray-400 capitalize">
                <ShieldCheck className="w-3 h-3 mr-1 text-gray-400" />
                {user?.role || 'Staff'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#222222] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#111111] text-white px-4 py-3 flex items-center justify-between border-b border-[#262626]">
        <div className="flex items-center space-x-2">
          <Scale className="w-5 h-5 text-gray-300" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Siwolo P.O Law Advocates
          </span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1 text-gray-300 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#111111]">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30">
        {navContent}
      </aside>
    </>
  );
};
