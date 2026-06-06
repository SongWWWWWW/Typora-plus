import type { URI } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export interface WorkspaceState {
  readonly name: string;
  readonly rootUri?: URI;
}

export interface IWorkspaceService {
  getWorkspace(): WorkspaceState;
}

export const IWorkspaceService = createServiceIdentifier<IWorkspaceService>("workspace");

export class WorkspaceService implements IWorkspaceService {
  constructor(private readonly state: WorkspaceState) {}

  getWorkspace(): WorkspaceState {
    return this.state;
  }
}
