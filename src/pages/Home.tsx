import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generateRoomSlug, parseRoomInput } from "@/lib/room"
import { Video } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Home() {
  const navigate = useNavigate()
  const [joinInput, setJoinInput] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)

  function handleCreateRoom() {
    navigate(`/room/${generateRoomSlug()}`)
  }

  function handleJoinInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setJoinInput(e.target.value)
    if (joinError) setJoinError(null)
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const roomId = parseRoomInput(joinInput)
    if (!roomId) {
      setJoinError("Enter a valid room ID or link")
      return
    }
    navigate(`/room/${roomId}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-10">
        {/* Brand */}
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <Video className="size-7 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Ripple</h1>
          </div>
          <p className="text-sm text-muted-foreground">P2P video calls. No accounts. No history.</p>
        </div>

        {/* Create room */}
        <Button className="w-full" size="lg" onClick={handleCreateRoom}>
          Create Room
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-border" />
          <span className="text-xs text-muted-foreground">or join existing</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Join form */}
        <form onSubmit={handleJoin} noValidate className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="room-input" className="text-sm font-medium text-foreground">
              Room ID or link
            </label>
            <Input
              id="room-input"
              type="text"
              value={joinInput}
              onChange={handleJoinInputChange}
              placeholder="coral-tiger-42"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={joinError ? "room-input-error" : undefined}
              aria-invalid={joinError ? true : undefined}
            />
            {joinError ? (
              <p id="room-input-error" role="alert" className="text-xs text-destructive">
                {joinError}
              </p>
            ) : null}
          </div>
          <Button type="submit" variant="outline" className="w-full">
            Join
          </Button>
        </form>
      </div>
    </main>
  )
}
