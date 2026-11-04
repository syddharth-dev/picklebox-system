import { Link, useLocation } from "react-router-dom";
import { Calendar, CalendarPlus, ClipboardList, CreditCard, LayoutDashboard, LogOut, MapPin, QrCode, Settings, Trophy, Users } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppLogo } from "@/components/AppLogo";

const groups = [
  { label: "At the club", items: [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/bookings", icon: Calendar, label: "Bookings" },
    { href: "/admin/open-play", icon: Trophy, label: "Open Play" },
    { href: "/admin/check-in", icon: QrCode, label: "Check-in" },
    { href: "/admin/attendance", icon: ClipboardList, label: "Attendance" },
  ] },
  { label: "Management", items: [
    { href: "/admin/courts", icon: MapPin, label: "Courts" },
    { href: "/admin/reservations", icon: CalendarPlus, label: "Reservations" },
    { href: "/admin/payments", icon: CreditCard, label: "Payments" },
    { href: "/admin/users", icon: Users, label: "Members" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
  ] },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentPage = groups.flatMap((group) => group.items).find((item) => item.href === location.pathname)?.label || "Overview";
  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="px-4 pb-5 pt-6 group-data-[collapsible=icon]:px-2">
          <Link to="/admin" aria-label="The Pickle Box admin home" className="flex items-center gap-3 overflow-hidden">
            <AppLogo className="h-12 w-16 rounded-md group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" />
            <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">The Pickle Box<span className="mt-1 block text-xs font-normal text-sidebar-foreground/70">Club management</span></span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="mb-2 text-xs font-medium text-sidebar-foreground/70">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent><SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.label} isActive={location.pathname === item.href}
                      className="h-11 rounded-lg px-3 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground group-data-[collapsible=icon]:!p-2">
                      <Link to={item.href} aria-current={location.pathname === item.href ? "page" : undefined}><item.icon className="stroke-[1.7]" /><span>{item.label}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu></SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip="Back to the website" className="h-11">
            <Link to="/"><LogOut /><span>Back to the website</span></Link>
          </SidebarMenuButton></SidebarMenuItem></SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="admin-workspace min-w-0 bg-background">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b bg-card px-4 md:px-8">
          <div className="flex items-center gap-3"><SidebarTrigger aria-label="Toggle admin navigation" /><span className="hidden text-xs text-muted-foreground sm:inline">Club management</span><span className="hidden text-border sm:inline">/</span><p className="text-sm font-semibold">{currentPage}</p></div>
          <div className="flex items-center gap-2"><ThemeToggle /><Button asChild size="sm" variant="outline"><Link to="/admin/check-in"><QrCode className="h-4 w-4" />Check-in</Link></Button></div>
        </header>
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
