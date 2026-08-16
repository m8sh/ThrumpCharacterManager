import {createClient} from '@supabase/supabase-js'

// these two come from the env file, and vite only hands over names starting with VITE_
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(url, key)

// what one row in the characters table looks like
export type RoomRow = {
    room: string
    player_id: string
    name: string
    sheet: string
    updated_at: string
}

// every browser gets its own id once and keeps it, so a player rejoining a room
// lands back on their own row rather than making a second one
export function playerId() {
    let id = ""
    try {
        id = localStorage.getItem("thrump-player") ?? ""
        if (id === "") {
            id = Math.random().toString(36).slice(2, 10)
            localStorage.setItem("thrump-player", id)
        }
    } catch {
        // storage switched off, so a fresh id each visit is the best we can do
        id = Math.random().toString(36).slice(2, 10)
    }
    return id
}

// a six digit code is easy to read out loud across a table
export function newRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
}

// hand the current sheet to the room, replacing whatever this player put there before
export async function publishSheet(room: string, name: string, sheet: string) {
    const {error} = await supabase
        .from("characters")
        .upsert({
            room: room,
            player_id: playerId(),
            name: name,
            sheet: sheet,
            updated_at: new Date().toISOString(),
        }, {onConflict: "room,player_id"})
    if (error) console.log("could not publish to the room", error)
}

// stop appearing in a room, used when leaving so the old card does not linger
export async function leaveRoom(room: string) {
    const {error} = await supabase
        .from("characters")
        .delete()
        .eq("room", room)
        .eq("player_id", playerId())
    if (error) console.log("could not leave the room", error)
}

// rooms nobody has touched in six days are cleared out. this runs whenever somebody
// joins a room, which is often enough to keep the table tidy without a scheduler
export async function sweepOldRooms() {
    const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    const {error} = await supabase
        .from("characters")
        .delete()
        .lt("updated_at", cutoff)
    if (error) console.log("could not sweep old rooms", error)
}

// everyone currently in a room
export async function fetchRoom(room: string) {
    const {data, error} = await supabase
        .from("characters")
        .select("*")
        .eq("room", room)
        .order("name")
    if (error) {
        console.log("could not read the room", error)
        return []
    }
    return (data ?? []) as RoomRow[]
}

// call whenever anything in the room changes, and call the returned function to stop
export function watchRoom(room: string, onChange: () => void) {
    const channel = supabase
        .channel("room-" + room)
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "characters",
            filter: "room=eq." + room,
        }, onChange)
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}