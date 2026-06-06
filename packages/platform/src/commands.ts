import { Disposable, type IDisposable, toDisposable } from "@typora-plus/base";
import { createServiceIdentifier, type ServicesAccessor } from "./instantiation";

export interface CommandMetadata {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
}

export interface Command extends CommandMetadata {
  run(accessor: ServicesAccessor, ...args: unknown[]): unknown;
}

export interface ICommandService {
  registerCommand(command: Command): IDisposable;
  registerCommandMetadata(metadata: CommandMetadata): IDisposable;
  executeCommand<T = unknown>(id: string, ...args: unknown[]): T;
  getCommands(): readonly CommandMetadata[];
}

export const ICommandService = createServiceIdentifier<ICommandService>("command");

export class CommandService extends Disposable implements ICommandService {
  private readonly handlers = new Map<string, Command>();
  private readonly metadata = new Map<string, CommandMetadata>();

  constructor(private readonly accessor: ServicesAccessor) {
    super();
  }

  registerCommand(command: Command): IDisposable {
    const metadata = commandToMetadata(command);
    const normalizedCommand: Command = {
      ...metadata,
      run: command.run
    };

    if (this.handlers.has(normalizedCommand.id)) {
      throw new Error(`Command already registered: ${normalizedCommand.id}`);
    }

    this.handlers.set(normalizedCommand.id, normalizedCommand);
    const implicitMetadata = !this.metadata.has(normalizedCommand.id);

    if (implicitMetadata) {
      this.metadata.set(normalizedCommand.id, metadata);
    }

    return toDisposable(() => {
      if (this.handlers.get(normalizedCommand.id) === normalizedCommand) {
        this.handlers.delete(normalizedCommand.id);
      }

      if (implicitMetadata) {
        this.metadata.delete(normalizedCommand.id);
      }
    });
  }

  registerCommandMetadata(metadata: CommandMetadata): IDisposable {
    const normalizedMetadata = commandToMetadata(metadata);

    if (this.metadata.has(normalizedMetadata.id)) {
      throw new Error(`Command metadata already registered: ${normalizedMetadata.id}`);
    }

    this.metadata.set(normalizedMetadata.id, normalizedMetadata);

    return toDisposable(() => {
      if (this.metadata.get(normalizedMetadata.id) === normalizedMetadata) {
        this.metadata.delete(normalizedMetadata.id);
      }
    });
  }

  executeCommand<T = unknown>(id: string, ...args: unknown[]): T {
    const command = this.handlers.get(id);

    if (!command) {
      if (this.metadata.has(id)) {
        throw new Error(`No command handler registered: ${id}`);
      }

      throw new Error(`Unknown command: ${id}`);
    }

    return command.run(this.accessor, ...args) as T;
  }

  getCommands(): readonly CommandMetadata[] {
    return [...this.metadata.values()].sort((first, second) => first.title.localeCompare(second.title));
  }
}

function commandToMetadata(command: CommandMetadata): CommandMetadata {
  const id = command.id.trim();
  const title = command.title.trim();
  const category = command.category?.trim();

  if (!id) {
    throw new Error("Command id must not be empty");
  }

  if (!title) {
    throw new Error(`Command title must not be empty: ${id}`);
  }

  return {
    id,
    title,
    ...(category ? { category } : {})
  };
}
