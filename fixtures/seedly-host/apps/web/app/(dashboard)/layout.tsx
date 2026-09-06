import { InitialDataProvider } from '@/components/providers/initial-data-provider';
import { Topbar } from '@/components/navigation/topbar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
        <InitialDataProvider>
          <Topbar />
          {children}
        </InitialDataProvider>
    </div>
  );
}
