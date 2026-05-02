import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { GlassMenu } from "./GlassMenu"

function renderMenu() {
  const onMicSelect = vi.fn()
  const onSpeakerSelect = vi.fn()

  function Host() {
    const [open, setOpen] = useState(true)

    return (
      <GlassMenu
        open={open}
        onOpenChange={setOpen}
        trigger={<button type="button">Open menu</button>}
        sections={[
          {
            label: "Microphone",
            selectedId: "mic-2",
            onSelect: onMicSelect,
            items: [
              { id: "mic-1", label: "Mic 1" },
              { id: "mic-2", label: "Mic 2" },
            ],
          },
          {
            label: "Speaker",
            selectedId: "speaker-1",
            onSelect: onSpeakerSelect,
            items: [
              { id: "speaker-1", label: "Speaker 1" },
              { id: "speaker-2", label: "Speaker 2" },
            ],
          },
        ]}
      />
    )
  }

  render(<Host />)
  return { onMicSelect, onSpeakerSelect }
}

describe("GlassMenu", () => {
  it("renders all section labels and items when open", () => {
    renderMenu()

    expect(screen.getByText("Microphone")).toBeInTheDocument()
    expect(screen.getByText("Speaker")).toBeInTheDocument()
    expect(screen.getByText("Mic 1")).toBeInTheDocument()
    expect(screen.getByText("Speaker 2")).toBeInTheDocument()
  })

  it("shows the check indicator only on the selectedId", () => {
    renderMenu()

    expect(screen.getByRole("menuitemradio", { name: "Mic 2" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(screen.getByRole("menuitemradio", { name: "Mic 1" })).toHaveAttribute(
      "aria-checked",
      "false"
    )
  })

  it("selecting an item calls section.onSelect with the id and keeps the menu open", async () => {
    const user = userEvent.setup()
    const { onMicSelect } = renderMenu()

    await user.click(screen.getByRole("menuitemradio", { name: "Mic 1" }))

    expect(onMicSelect).toHaveBeenCalledWith("mic-1")
    expect(screen.getByRole("menu")).toBeInTheDocument()
  })

  it("Escape key closes the menu", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("clicking outside the menu closes it", async () => {
    const user = userEvent.setup()
    function Host() {
      const [open, setOpen] = useState(true)

      return (
        <div>
          <button type="button">outside</button>
          <GlassMenu
            open={open}
            onOpenChange={setOpen}
            trigger={<button type="button">Open menu</button>}
            sections={[
              {
                label: "Microphone",
                selectedId: "mic-1",
                onSelect: vi.fn(),
                items: [{ id: "mic-1", label: "Mic 1" }],
              },
            ]}
          />
        </div>
      )
    }

    render(<Host />)

    await user.click(screen.getByText("outside"))

    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })

  it("arrow-down moves focus to the next item", async () => {
    const user = userEvent.setup()
    renderMenu()

    const selectedItem = screen.getByRole("menuitemradio", { name: "Mic 2" })
    selectedItem.focus()
    expect(selectedItem).toHaveFocus()

    await user.keyboard("{ArrowDown}")

    expect(screen.getByRole("menuitemradio", { name: "Speaker 1" })).toHaveFocus()
  })

  it("arrow-up wraps from first item to last", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.keyboard("{Home}")
    expect(screen.getByRole("menuitemradio", { name: "Mic 1" })).toHaveFocus()

    await user.keyboard("{ArrowUp}")

    expect(screen.getByRole("menuitemradio", { name: "Speaker 2" })).toHaveFocus()
  })

  it("arrow-down crosses section boundaries (Microphone → Speaker)", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.keyboard("{ArrowDown}")

    expect(screen.getByRole("menuitemradio", { name: "Speaker 1" })).toHaveFocus()
  })

  it("Home jumps to first item, End to last", async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.keyboard("{Home}")
    expect(screen.getByRole("menuitemradio", { name: "Mic 1" })).toHaveFocus()

    await user.keyboard("{End}")
    expect(screen.getByRole("menuitemradio", { name: "Speaker 2" })).toHaveFocus()
  })

  it("Enter on a focused item invokes onSelect", async () => {
    const user = userEvent.setup()
    const { onMicSelect } = renderMenu()

    await user.keyboard("{Home}{Enter}")

    expect(onMicSelect).toHaveBeenCalledWith("mic-1")
  })

  it("each item has role='menuitemradio' with aria-checked reflecting selectedId", () => {
    renderMenu()

    for (const item of screen.getAllByRole("menuitemradio")) {
      expect(item).toHaveAttribute("aria-checked")
    }
  })

  it("focus lands on the currently-selected item when the menu opens", () => {
    renderMenu()

    expect(screen.getByRole("menuitemradio", { name: "Mic 2" })).toHaveAttribute("tabindex", "0")
  })
})
