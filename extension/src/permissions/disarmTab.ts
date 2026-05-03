export type DisarmTabDeps = {
  clearSelectedTab: () => Promise<void>
}

export async function disarmTab(deps: DisarmTabDeps): Promise<void> {
  await deps.clearSelectedTab()
}
