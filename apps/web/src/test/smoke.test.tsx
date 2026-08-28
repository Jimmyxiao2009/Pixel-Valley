import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WorldNav } from "../chrome/WorldNav";

describe("frontend test harness", () => {
  it("renders a router-bound component in jsdom", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <WorldNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "世界导航" })).toBeTruthy();
    for (const label of ["回家", "上街", "去镇上", "信箱"]) {
      expect(screen.getByRole("link", { name: label })).toBeTruthy();
    }
  });
});
