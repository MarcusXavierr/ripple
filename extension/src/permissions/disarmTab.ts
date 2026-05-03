import type { SelectedTab } from "../selectedTab/selectedTabStore"
import { urlToOriginPattern } from "./urlToOriginPattern"

export type DisarmTabDeps = {
  remove: (perm: { origins: string[] }) => Promise<boolean>
  clearSelectedTab: () => Promise<void>
  logger: Pick<Console, "warn">
}

export async function disarmTab(armed: SelectedTab, deps: DisarmTabDeps): Promise<void> {
  const pattern = urlToOriginPattern(armed.url)

  if (pattern) {
    try {
      await deps.remove({ origins: [pattern] })
    } catch (error) {
      deps.logger.warn("[Ripple Extension] permissions.remove failed; clearing store anyway", error)
    }
  }

  await deps.clearSelectedTab()
}
