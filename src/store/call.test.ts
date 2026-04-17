import { beforeEach, describe, expect, it } from 'vitest'
import { useCallStore } from './call'

describe('useCallStore', () => {
  beforeEach(() => {
    useCallStore.getState().reset()
  })

  it('accepts ended as a valid status', () => {
    useCallStore.setState({ status: 'ended' })
    expect(useCallStore.getState().status).toBe('ended')
  })

  it('reset() restores every field to its initial value', () => {
    useCallStore.setState({
      status: 'connected',
      error: 'oops',
      role: 'caller',
      isScreenSharing: true,
      isMicMuted: true,
      isCameraOff: true,
      peerId: 'abc',
    })
    useCallStore.getState().reset()
    const s = useCallStore.getState()
    expect(s.status).toBe('idle')
    expect(s.error).toBeNull()
    expect(s.role).toBeNull()
    expect(s.localStream).toBeNull()
    expect(s.remoteStream).toBeNull()
    expect(s.pc).toBeNull()
    expect(s.isScreenSharing).toBe(false)
    expect(s.isMicMuted).toBe(false)
    expect(s.isCameraOff).toBe(false)
    expect(s.peerId).toBe('')
  })
})
