import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./chrome/AppShell";
import { CovenantScene } from "./scenes/CovenantScene";
import { HomeScene } from "./scenes/HomeScene";
import { LoginScene } from "./scenes/LoginScene";
import { MailScene } from "./scenes/MailScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import { TownScene } from "./scenes/TownScene";
import { RequireAuth, SessionProvider } from "./session/SessionProvider";

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="login" element={<LoginScene />} />
          <Route path="covenant" element={<CovenantScene />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="home" element={<HomeScene />} />
              <Route path="street" element={<NeighborhoodScene mode="mine" />} />
              <Route path="n/:neighborhoodId" element={<NeighborhoodScene mode="canonical" />} />
              <Route path="r/:residentId" element={<HomeScene mode="guest" />} />
              <Route path="town/:zone" element={<TownScene />} />
              <Route path="mail" element={<MailScene />} />
            </Route>
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
