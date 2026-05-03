export type PermissionsGate = {
  hasAccess(originPattern: string): Promise<boolean>
}

export type PermissionsGateDeps = {
  contains: (perm: { origins: string[] }) => Promise<boolean>
  logger?: Pick<Console, "warn">
}

export function createPermissionsGate(deps: PermissionsGateDeps): PermissionsGate {
  return {
    async hasAccess(originPattern) {
      try {
        return await deps.contains({ origins: [originPattern] })
      } catch (error) {
        deps.logger?.warn("[Ripple Extension] permissions.contains failed", error)
        return false
      }
    },
  }
}
