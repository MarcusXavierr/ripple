import { Check } from "lucide-react"
import type * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type GlassMenuSection = {
  label: string
  items: { id: string; label: string; disabled?: boolean }[]
  selectedId: string
  onSelect: (id: string) => void
}

export type GlassMenuProps = {
  trigger: React.ReactElement
  sections: GlassMenuSection[]
  align?: "start" | "center" | "end"
  side?: "top" | "bottom"
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type FlatItem = {
  key: string
  item: GlassMenuSection["items"][number]
  sectionIndex: number
}

function findFirstEnabledIndex(items: FlatItem[]): number {
  return items.findIndex((item) => !item.item.disabled)
}

export function GlassMenu({
  trigger,
  sections,
  align = "center",
  side = "top",
  open,
  onOpenChange,
}: GlassMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())

  const isControlled = open !== undefined
  const isOpen = open ?? uncontrolledOpen
  const flatItems = useMemo<FlatItem[]>(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.items.map((item) => ({
          key: `${sectionIndex}:${item.id}`,
          item,
          sectionIndex,
        }))
      ),
    [sections]
  )

  function setOpenState(nextOpen: boolean) {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  useEffect(() => {
    if (!isOpen) return

    const selectedIndex = flatItems.findIndex(({ item, sectionIndex }) => {
      if (item.disabled) return false
      return sections[sectionIndex]?.selectedId === item.id
    })
    const fallbackIndex = findFirstEnabledIndex(flatItems)
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : Math.max(fallbackIndex, 0))
  }, [flatItems, isOpen, sections])

  useEffect(() => {
    if (!isOpen) return
    const target = flatItems[focusedIndex]
    if (!target) return
    const timeoutId = window.setTimeout(() => {
      itemRefs.current.get(target.key)?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [flatItems, focusedIndex, isOpen])

  function moveFocus(direction: 1 | -1) {
    if (flatItems.length === 0) return

    let nextIndex = focusedIndex
    for (let step = 0; step < flatItems.length; step += 1) {
      nextIndex = (nextIndex + direction + flatItems.length) % flatItems.length
      if (!flatItems[nextIndex]?.item.disabled) {
        setFocusedIndex(nextIndex)
        return
      }
    }
  }

  function jumpFocus(position: "first" | "last") {
    const indices = flatItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.item.disabled)
      .map(({ index }) => index)

    if (indices.length === 0) return
    setFocusedIndex(position === "first" ? indices[0] : indices[indices.length - 1])
  }

  function activateFocusedItem() {
    const focusedItem = flatItems[focusedIndex]
    if (!focusedItem || focusedItem.item.disabled) return
    sections[focusedItem.sectionIndex]?.onSelect(focusedItem.item.id)
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpenState}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side={side}
        align={align}
        role="menu"
        className="glass-strong w-[260px] rounded-2xl p-2"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            moveFocus(1)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            moveFocus(-1)
          } else if (event.key === "Home") {
            event.preventDefault()
            jumpFocus("first")
          } else if (event.key === "End") {
            event.preventDefault()
            jumpFocus("last")
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            activateFocusedItem()
          }
        }}
      >
        {sections.map((section, sectionIndex) => (
          <div key={section.label} className="py-1">
            <div className="px-2 pb-1 text-[10px] font-medium tracking-widest text-black/50 uppercase">
              {section.label}
            </div>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const key = `${sectionIndex}:${item.id}`
                const flatIndex = flatItems.findIndex((candidate) => candidate.key === key)
                const isSelected = item.id === section.selectedId
                const isFocused = flatIndex === focusedIndex

                return (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) {
                        itemRefs.current.set(key, node)
                      } else {
                        itemRefs.current.delete(key)
                      }
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    disabled={item.disabled}
                    tabIndex={isFocused ? 0 : -1}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
                      isSelected && "bg-black/5 font-medium",
                      item.disabled && "pointer-events-none cursor-not-allowed opacity-50"
                    )}
                    onFocus={() => {
                      if (flatIndex >= 0) {
                        setFocusedIndex(flatIndex)
                      }
                    }}
                    onClick={() => {
                      if (item.disabled) return
                      section.onSelect(item.id)
                    }}
                  >
                    <span>{item.label}</span>
                    {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
