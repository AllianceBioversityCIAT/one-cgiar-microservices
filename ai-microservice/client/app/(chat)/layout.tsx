import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cookies } from 'next/headers';
import { NavHeader } from '@/components/sidebar/nav-header';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const isCollapsed = (await cookies()).get('sidebar:state')?.value !== 'true';

  return (
    <SidebarProvider defaultOpen={!isCollapsed}>
      <AppSidebar />
      <SidebarInset>
        <NavHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
