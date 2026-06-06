export interface IDisposable {
  dispose(): void;
}

export function isDisposable(value: unknown): value is IDisposable {
  return typeof value === "object" && value !== null && "dispose" in value;
}

export function toDisposable(fn: () => void): IDisposable {
  let disposed = false;

  return {
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      fn();
    }
  };
}

export class DisposableStore implements IDisposable {
  private readonly disposables = new Set<IDisposable>();
  private disposed = false;

  add<T extends IDisposable>(disposable: T): T {
    if (this.disposed) {
      disposable.dispose();
      return disposable;
    }

    this.disposables.add(disposable);
    return disposable;
  }

  clear(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.clear();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clear();
  }
}

export abstract class Disposable implements IDisposable {
  protected readonly store = new DisposableStore();

  dispose(): void {
    this.store.dispose();
  }
}
