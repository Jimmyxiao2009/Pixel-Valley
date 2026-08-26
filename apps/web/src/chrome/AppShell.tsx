import { Outlet } from "react-router-dom";
import { WorldNav } from "./WorldNav";

export function AppShell() {
  return (
    <div className="pv-app">
      <main className="pv-scene">
        <Outlet />
      </main>
      <WorldNav />
    </div>
  );
}
