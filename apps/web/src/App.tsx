import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./chrome/AppShell";
import { HomeScene } from "./scenes/HomeScene";
import { MailScene } from "./scenes/MailScene";
import { NeighborhoodScene } from "./scenes/NeighborhoodScene";
import { TownScene } from "./scenes/TownScene";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomeScene />} />
          <Route path="street" element={<NeighborhoodScene mode="mine" />} />
          <Route path="n/:neighborhoodId" element={<NeighborhoodScene mode="canonical" />} />
          <Route path="r/:residentId" element={<HomeScene mode="guest" />} />
          <Route path="town/:zone" element={<TownScene />} />
          <Route path="mail" element={<MailScene />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
