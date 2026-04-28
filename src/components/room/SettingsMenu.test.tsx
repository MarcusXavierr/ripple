import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { SettingsMenu } from "./SettingsMenu"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "room.settings.open": "Open settings",
          "room.settings.section": "Settings",
          "room.settings.empty": "No settings yet",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

describe("SettingsMenu", () => {
  it("opens a glass menu above the trigger when three-dots clicked", async () => {
    const user = userEvent.setup()
    render(<SettingsMenu />)

    await user.click(screen.getByRole("button", { name: "Open settings" }))

    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("renders a single non-clickable 'No settings yet' placeholder when items is empty", async () => {
    const user = userEvent.setup()
    render(<SettingsMenu />)

    await user.click(screen.getByRole("button", { name: "Open settings" }))

    expect(screen.getByText("No settings yet")).toBeInTheDocument()
    expect(screen.getByRole("menuitemradio", { name: "No settings yet" })).toBeDisabled()
  })

  it("closes when the user clicks outside the menu", async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">outside</button>
        <SettingsMenu />
      </div>
    )

    await user.click(screen.getByRole("button", { name: "Open settings" }))
    await user.click(screen.getByText("outside"))

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
