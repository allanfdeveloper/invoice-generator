"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LayoutDashboard, FileText, Receipt, Users, Settings as SettingsIcon, User, Package, Shield } from "lucide-react"
import { m } from "@/components/ui/motion"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/packages", label: "Packages", icon: Package },
{ href: "/sla", label: "SLA", icon: Shield },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    // AppSidebar renders the single <aside> wrapper — do not wrap this component in another <aside> (prevents double-wrapping)
    <nav
      className={cn("px-0 py-0", className)}
      role="navigation"
      aria-label="Primary"
    >
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Navigation</p>
      </div>
      <Separator />
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="px-2 py-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <m.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex items-center gap-2 overflow-hidden rounded-md px-2 py-2 text-sm outline-none ring-offset-background transition-colors",
                        "hover:bg-accent/70 hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        active ? "text-accent-foreground" : "text-foreground"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && (
                        <m.span
                          layoutId="active-nav"
                          className="absolute inset-0 -z-10 rounded-md bg-accent"
                          transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="inline-flex items-center justify-center">
                        <span className="inline-flex items-center justify-center">
                          <Icon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95" aria-hidden="true" />
                        </span>
                      </span>
                      <span className="transition-opacity duration-150">{item.label}</span>
                    </Link>
                  </m.div>
                </li>
              )
            })}
          </ul>
        </div>
      </ScrollArea>
    </nav>
  )
}