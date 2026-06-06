import { Emitter, URI, type Event, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type RecentResourceKind = "file" | "workspace";

export interface RecentResource {
  readonly uri: URIType;
  readonly name: string;
  readonly kind: RecentResourceKind;
  readonly lastOpenedAt: number;
}

export interface RecentStorage {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface RecentServiceOptions {
  readonly storageKey: string;
  readonly maxEntries: number;
  readonly now?: () => number;
  readonly storage?: RecentStorage;
}

export interface IRecentService {
  readonly onDidChangeRecents: Event<readonly RecentResource[]>;
  getRecents(): readonly RecentResource[];
  getRecentFiles(): readonly RecentResource[];
  getRecentWorkspaces(): readonly RecentResource[];
  addRecentFile(uri: URIType, name: string): void;
  addRecentWorkspace(uri: URIType, name: string): void;
  clearRecents(): void;
}

export const IRecentService = createServiceIdentifier<IRecentService>("recent");

export const defaultRecentServiceOptions: RecentServiceOptions = {
  storageKey: "typora-plus.recents",
  maxEntries: 20
};

export class RecentService implements IRecentService {
  private readonly emitter = new Emitter<readonly RecentResource[]>();
  private readonly now: () => number;
  private readonly storage: RecentStorage;
  private recents: RecentResource[];

  readonly onDidChangeRecents = this.emitter.event;

  constructor(private readonly options: RecentServiceOptions = defaultRecentServiceOptions) {
    this.now = options.now ?? (() => Date.now());
    this.storage = options.storage ?? createBrowserRecentStorage();
    this.recents = this.readRecents();
  }

  getRecents(): readonly RecentResource[] {
    return this.recents;
  }

  getRecentFiles(): readonly RecentResource[] {
    return this.recents.filter((recent) => recent.kind === "file");
  }

  getRecentWorkspaces(): readonly RecentResource[] {
    return this.recents.filter((recent) => recent.kind === "workspace");
  }

  addRecentFile(uri: URIType, name: string): void {
    this.addRecent({
      uri,
      name,
      kind: "file",
      lastOpenedAt: this.now()
    });
  }

  addRecentWorkspace(uri: URIType, name: string): void {
    this.addRecent({
      uri,
      name,
      kind: "workspace",
      lastOpenedAt: this.now()
    });
  }

  clearRecents(): void {
    this.recents = [];
    this.persist();
    this.emitter.fire(this.recents);
  }

  private addRecent(resource: RecentResource): void {
    this.recents = [
      resource,
      ...this.recents.filter((recent) => recent.kind !== resource.kind || recent.uri.toString() !== resource.uri.toString())
    ]
      .sort((first, second) => second.lastOpenedAt - first.lastOpenedAt)
      .slice(0, this.options.maxEntries);
    this.persist();
    this.emitter.fire(this.recents);
  }

  private readRecents(): RecentResource[] {
    const rawValue = this.storage.read(this.options.storageKey);

    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue) as readonly SerializedRecentResource[];
      return parsed
        .filter(isSerializedRecentResource)
        .map((recent) => ({
          uri: URI.parse(recent.uri),
          name: recent.name,
          kind: recent.kind,
          lastOpenedAt: recent.lastOpenedAt
        }))
        .sort((first, second) => second.lastOpenedAt - first.lastOpenedAt)
        .slice(0, this.options.maxEntries);
    } catch {
      this.storage.write(this.options.storageKey, "[]");
      return [];
    }
  }

  private persist(): void {
    const serialized: SerializedRecentResource[] = this.recents.map((recent) => ({
      uri: recent.uri.toString(),
      name: recent.name,
      kind: recent.kind,
      lastOpenedAt: recent.lastOpenedAt
    }));
    this.storage.write(this.options.storageKey, JSON.stringify(serialized));
  }
}

interface SerializedRecentResource {
  readonly uri: string;
  readonly name: string;
  readonly kind: RecentResourceKind;
  readonly lastOpenedAt: number;
}

function isSerializedRecentResource(value: SerializedRecentResource): boolean {
  return (
    typeof value.uri === "string" &&
    typeof value.name === "string" &&
    (value.kind === "file" || value.kind === "workspace") &&
    typeof value.lastOpenedAt === "number"
  );
}

function createBrowserRecentStorage(): RecentStorage {
  return {
    read(key) {
      if (!hasLocalStorage()) {
        return undefined;
      }

      return window.localStorage.getItem(key) ?? undefined;
    },
    write(key, value) {
      if (!hasLocalStorage()) {
        return;
      }

      window.localStorage.setItem(key, value);
    }
  };
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}
