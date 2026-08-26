import { Outlet } from 'react-router-dom';
import { ServerWakeupNotice } from './ServerWakeupNotice';

export function Layout() {
  return (
    <div className="min-h-screen">
      <ServerWakeupNotice />

      <main>
        <Outlet />
      </main>
    </div>
  );
}