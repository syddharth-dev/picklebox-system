import { Link, useLocation } from "react-router-dom";
import { Calendar, CalendarPlus, ClipboardList, CreditCard, LayoutDashboard, LogOut, MapPin, QrCode, Settings, Trophy, Users } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppLogo } from "@/components/AppLogo";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" }, { href: "/admin/courts", icon: MapPin, label: "Courts" },
  { href: "/admin/bookings", icon: Calendar, label: "Bookings" }, { href: "/admin/reservations", icon: CalendarPlus, label: "Reservations" },
  { href: "/admin/open-play", icon: Trophy, label: "Open Play" }, { href: "/admin/check-in", icon: QrCode, label: "Check-in" },
  { href: "/admin/attendance", icon: ClipboardList, label: "Attendance" }, { href: "/admin/payments", icon: CreditCard, label: "Payments" },
  { href: "/admin/users", icon: Users, label: "Members" }, { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <SidebarProvider defaultOpen><Sidebar collapsible="icon" className="border-sidebar-border"><SidebarHeader className="px-3 py-4 group-data-[collapsible=icon]:px-2"><Link to="/admin" className="flex items-center gap-3 overflow-hidden"><AppLogo className="h-12 w-16 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" /><span className="whitespace-nowrap text-sm font-extrabold tracking-tight group-data-[collapsible=icon]:hidden">PICKLE BOX</span></Link></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Operations</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navItems.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild tooltip={item.label} isActive={location.pathname === item.href}><Link to={item.href}><item.icon /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip="Exit admin"><Link to="/"><LogOut /><span>Exit admin</span></Link></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar><SidebarInset><header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6"><div className="flex items-center gap-3"><SidebarTrigger /><p className="eyebrow hidden text-muted-foreground sm:block">Admin workspace</p></div><div className="flex items-center gap-2"><ThemeToggle className="h-8 w-8" /><Button asChild size="sm" variant="outline" className="h-8"><Link to="/admin/check-in"><QrCode className="mr-2 h-3.5 w-3.5" />Check-in</Link></Button></div></header>{children}</SidebarInset></SidebarProvider>;
}
