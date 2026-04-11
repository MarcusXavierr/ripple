import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Room from "./Room";

it("renders without crashing", () => {
  render(
    <MemoryRouter initialEntries={["/room/coral-tiger-42"]}>
      <Routes>
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByTestId("room-page")).toBeInTheDocument();
});
