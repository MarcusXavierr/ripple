import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PopupView } from "./PopupView"

describe("PopupView", () => {
  it("shows no selected tab state", () => {
    render(
      <PopupView
        selectedTab={null}
        currentTab={{ compatible: true, title: "YouTube", url: "https://youtube.com/watch?v=1" }}
        onUseCurrentTab={vi.fn()}
      />
    )

    expect(screen.getByText("No tab selected")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /use current tab/i })).toBeEnabled()
  })

  it("shows selected tab state", () => {
    render(
      <PopupView
        selectedTab={{ title: "Example", origin: "https://example.com" }}
        currentTab={{ compatible: true, title: "YouTube", url: "https://youtube.com/watch?v=1" }}
        onUseCurrentTab={vi.fn()}
      />
    )

    expect(screen.getByText("Example")).toBeInTheDocument()
    expect(screen.getByText("https://example.com")).toBeInTheDocument()
  })

  it("disables current-tab selection when current tab is incompatible", () => {
    render(
      <PopupView
        selectedTab={null}
        currentTab={{
          compatible: false,
          title: "Extensions",
          url: "chrome://extensions",
          reason: "Chrome internal pages cannot be controlled.",
        }}
        onUseCurrentTab={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: /use current tab/i })).toBeDisabled()
    expect(screen.getByText("Chrome internal pages cannot be controlled.")).toBeInTheDocument()
  })

  it("calls onUseCurrentTab when the user selects the current tab", async () => {
    const onUseCurrentTab = vi.fn()
    const user = userEvent.setup()

    render(
      <PopupView
        selectedTab={null}
        currentTab={{ compatible: true, title: "YouTube", url: "https://youtube.com/watch?v=1" }}
        onUseCurrentTab={onUseCurrentTab}
      />
    )

    await user.click(screen.getByRole("button", { name: /use current tab/i }))
    expect(onUseCurrentTab).toHaveBeenCalledTimes(1)
  })
})
