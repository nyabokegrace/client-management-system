import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { name: string; href?: string }[];
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
}) => {
  return (
    <header className="bg-white border-b border-[#E5E7EB] px-6 py-5">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-1.5 text-xs text-[#6B7280] mb-2 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.name}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-black transition-colors"
                >
                  {crumb.name}
                </Link>
              ) : (
                <span className="text-[#111111]">{crumb.name}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#111111]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center space-x-3">{actions}</div>}
      </div>
    </header>
  );
};
