import { Emitter, type Event, type URI } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { WorkspaceFileTree } from "./files";

export interface WorkspaceState {
  readonly name: string;
  readonly rootUri?: URI;
  readonly files?: WorkspaceFileTree;
}

export interface IWorkspaceService {
  readonly onDidChangeWorkspace: Event<WorkspaceState>;
  getWorkspace(): WorkspaceState;
  setWorkspace(state: WorkspaceState): void;
}

export const IWorkspaceService = createServiceIdentifier<IWorkspaceService>("workspace");

export class WorkspaceService implements IWorkspaceService {
  private readonly emitter = new Emitter<WorkspaceState>();

  readonly onDidChangeWorkspace = this.emitter.event;

  constructor(private state: WorkspaceState) {}

  getWorkspace(): WorkspaceState {
    return this.state;
  }

  setWorkspace(state: WorkspaceState): void {
    this.state = state;
    this.emitter.fire(this.state);
  }
}
