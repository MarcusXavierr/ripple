import { BrowserRouter, Route, Routes } from "react-router-dom"
import CallEnded from "./pages/CallEnded"
import Home from "./pages/Home"
import Privacy from "./pages/Privacy"
import Room from "./pages/Room"

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/room/:id" element={<Room />} />
        <Route path="/room/:id/ended" element={<CallEnded />} />
      </Routes>
    </BrowserRouter>
  )
}
