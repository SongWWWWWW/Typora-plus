import type { IDisposable } from "./lifecycle";
import { toDisposable } from "./lifecycle";

export type Listener<T> = (event: T) => void;

export interface Event<T> {
  (listener: Listener<T>): IDisposable;
}

export class Emitter<T> implements IDisposable {
  private readonly listeners = new Set<Listener<T>>();
  private disposed = false;

  readonly event: Event<T> = (listener: Listener<T>) => {
    if (this.disposed) {
      return toDisposable(() => undefined);
    }

    this.listeners.add(listener);
    return toDisposable(() => this.listeners.delete(listener));
  };

  fire(event: T): void {
    if (this.disposed) {
      return;
    }

    for (const listener of [...this.listeners]) {
      listener(event);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }
}
