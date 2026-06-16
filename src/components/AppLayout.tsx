"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Daily Brief", icon: "📥", href: "/inbox" },
    { label: "Relationships", icon: "🤝", href: "/relationships" },
    { label: "Calendar Intel", icon: "📅", href: "/calendar" },
    { label: "Settings & Sync", icon: "⚙️", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#0C0A09] font-sans flex">
      {/* Explicit Sidebar Navigation */}
      <aside className="w-64 border-r border-[#E8ECF0] bg-white flex flex-col hidden md:flex fixed h-full z-10">
        <div className="p-6 border-b border-[#E8ECF0]">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#0C0A09] flex items-center justify-center font-serif font-bold text-sm">
              C
            </div>
            <span className="font-serif text-xl tracking-tight">ChiefOS</span>
          </Link>
        </div>
        
        <nav className="flex-1 py-6 flex flex-col gap-2 px-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.label} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-[#0C0A09] text-white" 
                    : "text-[#57534E] hover:bg-[#F3F4F6] hover:text-[#0C0A09]"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-[#E8ECF0] text-xs text-[#94A3B8]">
          ChiefOS Workspace v0.1.0
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-0 md:ml-64 bg-[#FAFAF9] min-h-screen">
        {children}
      </main>
    </div>
  );
}
