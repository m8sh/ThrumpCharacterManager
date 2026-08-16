import {createClient} from '@supabase/supabase-js'

// these two come from the env file, and vite only hands over names starting with VITE_
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// true when the settings are actually there. without this check the client throws
// while the page is still loading, which leaves nothing on screen at all
export const roomsReady = typeof url === "string" && url !== "" && typeof key === "string" && key !== ""

if (!roomsReady) {
    console.log("rooms are switched off because VITE_SUPABASE_URL or VITE_SUPABASE_KEY is missing")
}

// a harmless stand in when the settings are missing, so the sheet still loads and
// only the room buttons stop working
export const supabase = roomsReady
    ? createClient(url, key)
    : createClient("https://example.supabase.co", "placeholder")

// what one row in the characters table looks like
export type RoomRow = {
    room: string
    player_id: string
    name: string
    sheet: string
    updated_at: string
}

// every browser gets its own id once and keeps it, so a player rejoining a room
// lands back on their own row rather than making a second one. this is worked out
// once when the page loads rather than on every call, so a browser that refuses to
// store it still stays steady for as long as the tab is open
const myId = (() => {
    try {
        const held = localStorage.getItem("thrump-player")
        if (held !== null && held !== "") return held
        const made = Math.random().toString(36).slice(2, 10)
        localStorage.setItem("thrump-player", made)
        return made
    } catch {
        return Math.random().toString(36).slice(2, 10)
    }
})()

export function playerId() {
    return myId
}

// a six digit code is easy to read out loud across a table
export function newRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000))
}

// hand the current sheet to the room, replacing whatever this player put there before
export async function publishSheet(room: string, name: string, sheet: string) {
    // the same character sitting under a stale id would show up as a second card
    await supabase
        .from("characters")
        .delete()
        .eq("room", room)
        .eq("name", name)
        .neq("player_id", playerId())

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

// call whenever anything in the room changes, and call the returned function to stop.
// the live channel is the quick path, and a slow repeat check underneath it means the
// list still keeps up if the websocket cannot get through
export function watchRoom(room: string, onChange: () => void) {
    const channel = supabase
        .channel("room-" + room)
        .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "characters",
            filter: "room=eq." + room,
        }, onChange)
        .subscribe(status => {
            console.log("room channel is", status)
        })

    // every few seconds regardless, so a blocked websocket only costs a little delay
    const timer = setInterval(onChange, 5000)

    return () => {
        clearInterval(timer)
        supabase.removeChannel(channel)
    }
}