import type { SelectedTab } from "../selectedTab/selectedTabStore"

export type DisarmTabDeps = {
  readSelectedTab: () => Promise<SelectedTab | null>
  remove: (perm: { origins: string[] }) => Promise<boolean>
  clearSelectedTab: () => Promise<void>
}

export async function disarmTab(deps: DisarmTabDeps): Promise<void> {
  const stored = await deps.readSelectedTab()
  if (stored && stored.grantedPatterns.length > 0) {
    await deps.remove({ origins: stored.grantedPatterns }).catch(() => {})
  }
  await deps.clearSelectedTab()
}
