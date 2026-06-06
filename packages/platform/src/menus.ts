import { Emitter, toDisposable, type Event, type IDisposable } from "@typora-plus/base";
import { contextKeyExpressionKeys, type ContextKeyExpression, type IContextKeyService } from "./contextKeys";
import { createServiceIdentifier } from "./instantiation";

export type MenuId = string;
export type MenuIconId = string;
export type MenuToggleValue = boolean | string;

export interface MenuItemToggle {
  readonly context: string;
  readonly value: MenuToggleValue;
}

export interface MenuItem {
  readonly id: string;
  readonly menu: MenuId;
  readonly command: string;
  readonly group?: string;
  readonly order?: number;
  readonly title?: string;
  readonly icon?: MenuIconId;
  readonly compactHidden?: boolean;
  readonly toggled?: MenuItemToggle;
  readonly when?: ContextKeyExpression;
}

export interface IMenuService {
  readonly onDidChangeMenu: Event<MenuId>;
  registerMenuItem(item: MenuItem): IDisposable;
  getMenuItems(menu: MenuId): readonly MenuItem[];
}

export const IMenuService = createServiceIdentifier<IMenuService>("menu");

export class MenuService implements IMenuService {
  private readonly items = new Map<string, MenuItem>();
  private readonly onDidChangeMenuEmitter = new Emitter<MenuId>();
  private readonly contextSubscription: IDisposable | undefined;

  readonly onDidChangeMenu = this.onDidChangeMenuEmitter.event;

  constructor(private readonly contextKeyService?: IContextKeyService) {
    this.contextSubscription = contextKeyService?.onDidChangeContext((event) => {
      const changedKeys = new Set(event.keys);
      const changedMenus = new Set<MenuId>();

      for (const item of this.items.values()) {
        if (contextKeyExpressionKeys(item.when).some((key) => changedKeys.has(key))) {
          changedMenus.add(item.menu);
        }
      }

      for (const menu of changedMenus) {
        this.onDidChangeMenuEmitter.fire(menu);
      }
    });
  }

  registerMenuItem(item: MenuItem): IDisposable {
    if (this.items.has(item.id)) {
      throw new Error(`Menu item already registered: ${item.id}`);
    }

    this.items.set(item.id, item);
    this.onDidChangeMenuEmitter.fire(item.menu);

    return toDisposable(() => {
      if (this.items.get(item.id) === item) {
        this.items.delete(item.id);
        this.onDidChangeMenuEmitter.fire(item.menu);
      }
    });
  }

  getMenuItems(menu: MenuId): readonly MenuItem[] {
    return [...this.items.values()]
      .filter((item) => item.menu === menu)
      .filter((item) => this.contextKeyService?.matches(item.when) ?? true)
      .sort(compareMenuItems);
  }

  dispose(): void {
    this.contextSubscription?.dispose();
  }
}

function compareMenuItems(first: MenuItem, second: MenuItem): number {
  return (first.group ?? "").localeCompare(second.group ?? "")
    || (first.order ?? 0) - (second.order ?? 0)
    || first.id.localeCompare(second.id);
}
