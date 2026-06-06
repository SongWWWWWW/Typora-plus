import { Disposable, type IDisposable, toDisposable } from "@typora-plus/base";
import { createServiceIdentifier, type ServicesAccessor } from "./instantiation";

export interface Command {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
  run(accessor: ServicesAccessor, ...args: unknown[]): unknown;
}

export interface ICommandService {
  registerCommand(command: Command): IDisposable;
  executeCommand<T = unknown>(id: string, ...args: unknown[]): T;
  getCommands(): readonly Command[];
}

export const ICommandService = createServiceIdentifier<ICommandService>("command");

export class CommandService extends Disposable implements ICommandService {
  private readonly commands = new Map<string, Command>();

  constructor(private readonly accessor: ServicesAccessor) {
    super();
  }

  registerCommand(command: Command): IDisposable {
    if (this.commands.has(command.id)) {
      throw new Error(`Command already registered: ${command.id}`);
    }

    this.commands.set(command.id, command);
    return toDisposable(() => this.commands.delete(command.id));
  }

  executeCommand<T = unknown>(id: string, ...args: unknown[]): T {
    const command = this.commands.get(id);

    if (!command) {
      throw new Error(`Unknown command: ${id}`);
    }

    return command.run(this.accessor, ...args) as T;
  }

  getCommands(): readonly Command[] {
    return [...this.commands.values()].sort((first, second) => first.title.localeCompare(second.title));
  }
}
