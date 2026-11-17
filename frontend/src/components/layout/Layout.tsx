import { Outlet } from 'react-router-dom';
import { ServerWakeupNotice } from './ServerWakeupNotice';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="min-h-screen">
      <ServerWakeupNotice />
      <Header />

      <main>
        <Outlet />
      </main>
    </div>
  );
}