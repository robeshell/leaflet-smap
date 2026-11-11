import mitt, { type Emitter } from 'mitt'

export type EventMap = Record<string, any>

export function createEmitter<T extends EventMap = EventMap>(): Emitter<T> {
  return mitt<T>()
}
