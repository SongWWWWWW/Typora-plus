import { Emitter, toDisposable, type Event, type IDisposable } from "@typora-plus/base";
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

  readonly onDidChangeMenu = this.onDidChangeMenuEmitter.event;

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
      .sort(compareMenuItems);
  }
}

function compareMenuItems(first: MenuItem, second: MenuItem): number {
  return (first.group ?? "").localeCompare(second.group ?? "")
    || (first.order ?? 0) - (second.order ?? 0)
    || first.id.localeCompare(second.id);
}
