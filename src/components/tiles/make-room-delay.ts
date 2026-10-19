/**
 * How long a dragged tile is held over another before that one makes room.
 *                                                              (Slice 39.91)
 *
 * The one place the tile hook reads the make-room delay from, in ms. Until
 * 39.92 it is the built-in `MAKE_ROOM_DELAY_MS` (1,0 s); 39.92 points this
 * function at the value saved in „Setări", so no screen and no other module
 * ever reads the delay on its own.
 */
import { MAKE_ROOM_DELAY_MS } from "@/lib/ui/tile-positions";

export function makeRoomDelayMs(): number {
  return MAKE_ROOM_DELAY_MS;
}
