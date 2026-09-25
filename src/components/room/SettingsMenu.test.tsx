import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SettingsMenu } from "./SettingsMenu"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "room.settings.open": "Open settings",
          "room.settings.backgroundBlur.section": "Background blur",
          "room.settings.backgroundBlur.off": "Off",
          "room.settings.backgroundBlur.light": "Slight blur",
          "room.settings.backgroundBlur.strong": "Blur",
          "room.settings.backgroundBlur.unsupported": "Not available in this browser",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}))

const onBackgroundBlurChange = vi.fn()
const menuProps = {
  backgroundBlur: "off" as const,
  backgroundBlurSupported: true,
  onBackgroundBlurChange,
}

describe("SettingsMenu", () => {
  it("opens a glass menu above the trigger when three-dots clicked", async () => {
    const user = userEvent.setup()
    render(<SettingsMenu {...menuProps} />)

    await user.click(screen.getByRole("button", { name: "Open settings" }))

    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("shows three blur levels, marks the selected one, and selects a different level", async () => {
    const user = userEvent.setup()
    onBackgroundBlurChange.mockClear()
    render(<SettingsMenu {...menuProps} backgroundBlur="light" />)
    await user.click(screen.getByRole("button", { name: "Open settings" }))

    expect(screen.getByRole("menuitemradio", { name: "Off" })).toHaveAttribute(
      "aria-checked",
      "false"
    )
    expect(screen.getByRole("menuitemradio", { name: "Slight blur" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(screen.getByRole("menuitemradio", { name: "Blur" })).toHaveAttribute(
      "aria-checked",
      "false"
    )
    await user.click(screen.getByRole("menuitemradio", { name: "Blur" }))
    expect(onBackgroundBlurChange).toHaveBeenCalledWith("strong")
  })

  it("shows a disabled item in unsupported browsers", async () => {
    const user = userEvent.setup()
    render(<SettingsMenu {...menuProps} backgroundBlurSupported={false} />)
    await user.click(screen.getByRole("button", { name: "Open settings" }))
    const options = screen.getAllByRole("menuitemradio")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("Not available in this browser")
    expect(options[0]).toBeDisabled()
  })

  it("closes when the user clicks outside the menu", async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">outside</button>
        <SettingsMenu {...menuProps} />
      </div>
    )

    await user.click(screen.getByRole("button", { name: "Open settings" }))
    await user.click(screen.getByText("outside"))

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})
