import { Emitter, URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import {
  CommandService,
  ConfigurationService,
  ContextKeyExpr,
  ContextKeyService,
  ExtensionService,
  FileSaveConflictError,
  ExportService,
  NativeFileService,
  NativeAttachmentService,
  WorkspaceTextFileService,
  WorkspaceIndexService,
  KeybindingService,
  MenuService,
  PersistedWorkspaceIndexProvider,
  RecentService,
  NativeResourceService,
  parseContextKeyExpression,
  createDefaultWorkspaceIndexSnapshotStorage,
  flattenFileTree,
  keybindingFromEvent,
  mergeConfiguration,
  configurationNumberConstraints,
  ServiceCollection,
  type FileTreeEntry,
  type ExtensionActivationHandler,
  type NativeFileSystemHost,
  type SaveFileOptions,
  type WorkspaceIndexedDocument,
  type WorkspaceIndexProvider,
  type WorkspaceIndexQueryOptions,
  type WorkspaceIndexMetadata,
  type WorkspaceIndexedLink,
  type WorkspaceIndexedTag,
  type WorkspaceIndexedTagSummary,
  type WorkspaceSearchResult,
  type WorkspaceFileTree
} from "./index";

describe("configuration", () => {
  it("merges nested configuration without dropping unrelated groups", () => {
    const service = new ConfigurationService();
    const next = mergeConfiguration(service.getValue(), {
      editor: {
        maxWidth: 720
      }
    });

    expect(next.editor.maxWidth).toBe(720);
    expect(next.appearance.colorScheme).toBe("system");
  });

  it("persists configuration updates through storage", () => {
    const storage = createMemoryStorage();
    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    service.updateValue({
      appearance: {
        colorScheme: "dark"
      },
      editor: {
        focusMode: true,
        autoSaveDelayMs: 1250
      }
    });

    const restored = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(restored.getValue().appearance.colorScheme).toBe("dark");
    expect(restored.getValue().editor.focusMode).toBe(true);
    expect(restored.getValue().editor.autoSave).toBe(true);
    expect(restored.getValue().editor.autoSaveDelayMs).toBe(1250);
  });

  it("ignores invalid stored configuration values", () => {
    const storage = createMemoryStorage();
    storage.write("configuration", JSON.stringify({
      appearance: {
        colorScheme: "blue"
      },
      editor: {
        autoSaveDelayMs: -250,
        fontSize: -1,
        typewriterMode: true
      },
      workspace: {
        searchMaxResults: 0
      }
    }));

    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(service.getValue().appearance.colorScheme).toBe("system");
    expect(service.getValue().editor.autoSaveDelayMs).toBe(800);
    expect(service.getValue().editor.fontSize).toBe(17);
    expect(service.getValue().editor.typewriterMode).toBe(true);
    expect(service.getValue().workspace.searchMaxResults).toBe(120);
  });

  it("clamps out-of-range stored numeric configuration values", () => {
    const storage = createMemoryStorage();
    storage.write("configuration", JSON.stringify({
      editor: {
        autoSaveDelayMs: 120000,
        fontSize: 999,
        lineHeight: 9,
        maxWidth: 99999
      },
      workspace: {
        searchMaxFileSizeBytes: 999 * 1024 * 1024,
        searchMaxResults: 9999
      }
    }));

    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(service.getValue().editor.autoSaveDelayMs).toBe(configurationNumberConstraints.editorAutoSaveDelayMs.max);
    expect(service.getValue().editor.fontSize).toBe(configurationNumberConstraints.editorFontSize.max);
    expect(service.getValue().editor.lineHeight).toBe(configurationNumberConstraints.editorLineHeight.max);
    expect(service.getValue().editor.maxWidth).toBe(configurationNumberConstraints.editorMaxWidth.max);
    expect(service.getValue().workspace.searchMaxFileSizeBytes).toBe(
      configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.max
    );
    expect(service.getValue().workspace.searchMaxResults).toBe(configurationNumberConstraints.workspaceSearchMaxResults.max);
  });

  it("persists and validates keybinding overrides", () => {
    const storage = createMemoryStorage();
    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    service.updateValue({
      keybindings: {
        overrides: [
          { command: "file.save", keybinding: { key: "k", primary: true } }
        ]
      }
    });

    const restored = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(restored.getValue().keybindings.overrides).toEqual([
      { command: "file.save", keybinding: { key: "k", primary: true } }
    ]);

    service.updateValue({
      keybindings: {
        overrides: [
          { command: "", keybinding: { key: "x", primary: true } },
          { command: "file.save", keybinding: { key: "" } },
          { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } }
        ]
      }
    });

    expect(service.getValue().keybindings.overrides).toEqual([
      { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } }
    ]);
  });

  it("uses a native configuration bridge when available", () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;
    const values = new Map<string, string>();
    (globalThis as {
      typoraPlus?: {
        readonly configuration: {
          readonly isAvailable: boolean;
          read(key: string): string | undefined;
          write(key: string, value: string): void;
        };
      };
    }).typoraPlus = {
      configuration: {
        isAvailable: true,
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, value)
      }
    };

    try {
      const service = new ConfigurationService();
      service.updateValue({
        appearance: {
          colorScheme: "dark"
        }
      });

      expect(values.has("typora-plus.configuration")).toBe(true);
      expect(JSON.parse(values.get("typora-plus.configuration") ?? "{}").appearance.colorScheme).toBe("dark");
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });
});

describe("commands", () => {
  it("executes registered commands through the service accessor", async () => {
    const services = new ServiceCollection();
    const commandService = new CommandService(services);

    commandService.registerCommand({
      id: "test.echo",
      title: "Echo",
      run: (_accessor, value) => value
    });

    await expect(commandService.executeCommand("test.echo", "ok")).resolves.toBe("ok");
    expect(commandService.getCommands()).toEqual([
      { id: "test.echo", title: "Echo" }
    ]);
  });

  it("separates command metadata from command handlers", async () => {
    const services = new ServiceCollection();
    const commandService = new CommandService(services);

    const metadataDisposable = commandService.registerCommandMetadata({
      id: "test.metadata",
      title: "Metadata Command",
      category: "Tests"
    });

    expect(commandService.getCommands()).toEqual([
      { id: "test.metadata", title: "Metadata Command", category: "Tests" }
    ]);
    await expect(commandService.executeCommand("test.metadata")).rejects.toThrow("No command handler registered");

    const handlerDisposable = commandService.registerCommand({
      id: "test.metadata",
      title: "Runtime Title",
      run: () => "handled"
    });

    expect(commandService.getCommands()).toEqual([
      { id: "test.metadata", title: "Metadata Command", category: "Tests" }
    ]);
    await expect(commandService.executeCommand("test.metadata")).resolves.toBe("handled");

    handlerDisposable.dispose();

    expect(commandService.getCommands()).toEqual([
      { id: "test.metadata", title: "Metadata Command", category: "Tests" }
    ]);
    await expect(commandService.executeCommand("test.metadata")).rejects.toThrow("No command handler registered");

    metadataDisposable.dispose();

    expect(commandService.getCommands()).toEqual([]);
    await expect(commandService.executeCommand("test.metadata")).rejects.toThrow("Unknown command");
  });

  it("rejects duplicate command metadata and handlers independently", () => {
    const services = new ServiceCollection();
    const commandService = new CommandService(services);

    commandService.registerCommandMetadata({
      id: "test.duplicate",
      title: "Duplicate"
    });

    expect(() => commandService.registerCommandMetadata({
      id: "test.duplicate",
      title: "Duplicate Again"
    })).toThrow("Command metadata already registered");

    commandService.registerCommand({
      id: "test.duplicate",
      title: "Duplicate Handler",
      run: () => undefined
    });

    expect(() => commandService.registerCommand({
      id: "test.duplicate",
      title: "Second Handler",
      run: () => undefined
    })).toThrow("Command already registered");
  });

  it("activates metadata-only commands before execution", async () => {
    const services = new ServiceCollection();
    const activatedCommands: string[] = [];
    const commandService = new CommandService(services, {
      activationHandler: (command) => {
        activatedCommands.push(command);
        commandService.registerCommand({
          id: command,
          title: "Activated Command",
          run: () => "activated"
        });
      }
    });

    commandService.registerCommandMetadata({
      id: "test.activate",
      title: "Activate"
    });

    await expect(commandService.executeCommand("test.activate")).resolves.toBe("activated");
    expect(activatedCommands).toEqual(["test.activate"]);
  });
});

describe("context keys", () => {
  it("evaluates structured context key expressions", () => {
    const service = new ContextKeyService();
    service.setValue("fileSystem.available", true);
    service.setValue("activeResource.scheme", "file");

    expect(service.matches(ContextKeyExpr.equals("fileSystem.available", true))).toBe(true);
    expect(service.matches(ContextKeyExpr.notEquals("activeResource.scheme", "untitled"))).toBe(true);
    expect(service.matches(ContextKeyExpr.defined("activeResource.scheme"))).toBe(true);
    expect(service.matches(ContextKeyExpr.and(
      ContextKeyExpr.equals("fileSystem.available", true),
      ContextKeyExpr.equals("activeResource.scheme", "file")
    ))).toBe(true);
    expect(service.matches(ContextKeyExpr.or(
      ContextKeyExpr.equals("activeResource.scheme", "untitled"),
      ContextKeyExpr.equals("activeResource.scheme", "file")
    ))).toBe(true);

    service.setValue("activeResource.scheme", undefined);

    expect(service.matches(ContextKeyExpr.defined("activeResource.scheme"))).toBe(false);
    expect(service.matches(ContextKeyExpr.not(ContextKeyExpr.defined("activeResource.scheme")))).toBe(true);
  });

  it("parses context key when-clause strings", () => {
    const service = new ContextKeyService();
    service.setValue("fileSystem.available", true);
    service.setValue("workspace.open", false);
    service.setValue("activeResource.scheme", "untitled");
    service.setValue("editor.fontSize", 17);

    expect(service.matches(parseContextKeyExpression("fileSystem.available && activeResource.scheme == untitled"))).toBe(true);
    expect(service.matches(parseContextKeyExpression("fileSystem.available && activeResource.scheme != file"))).toBe(true);
    expect(service.matches(parseContextKeyExpression("workspace.open || activeResource.scheme == 'untitled'"))).toBe(true);
    expect(service.matches(parseContextKeyExpression("workspace.open || activeResource.scheme == \"file\""))).toBe(false);
    expect(service.matches(parseContextKeyExpression("!workspace.open && editor.fontSize == 17"))).toBe(true);
    expect(service.matches(parseContextKeyExpression("!(workspace.open || activeResource.scheme == file)"))).toBe(true);
  });

  it("returns no expression for empty context key strings", () => {
    const service = new ContextKeyService();

    expect(parseContextKeyExpression("   ")).toBeUndefined();
    expect(service.matches(parseContextKeyExpression("   "))).toBe(true);
  });

  it("rejects invalid context key when-clause strings", () => {
    expect(() => parseContextKeyExpression("workspace.open &&")).toThrow("Expected identifier");
    expect(() => parseContextKeyExpression("workspace.open ==")).toThrow("Expected context key value");
    expect(() => parseContextKeyExpression("workspace.open && (activeResource.scheme == file")).toThrow("Expected rightParen");
    expect(() => parseContextKeyExpression("activeResource.scheme == 'file")).toThrow("Unterminated");
  });

  it("publishes context changes only when values change", () => {
    const service = new ContextKeyService();
    const changedKeys: string[][] = [];
    service.onDidChangeContext((event) => changedKeys.push([...event.keys]));

    service.setValue("workspace.open", false);
    service.setValue("workspace.open", false);
    service.setValue("workspace.open", true);
    service.setValue("workspace.open", undefined);
    service.setValue("workspace.open", undefined);

    expect(changedKeys).toEqual([
      ["workspace.open"],
      ["workspace.open"],
      ["workspace.open"]
    ]);
  });
});

describe("menus", () => {
  it("registers menu items in stable group and order sequence", () => {
    const service = new MenuService();

    service.registerMenuItem({
      id: "titlebar.z",
      menu: "titlebar.primary",
      command: "z",
      group: "navigation",
      order: 20
    });
    service.registerMenuItem({
      id: "titlebar.a",
      menu: "titlebar.primary",
      command: "a",
      group: "navigation",
      order: 10
    });
    service.registerMenuItem({
      id: "activitybar.a",
      menu: "activitybar.primary",
      command: "activity"
    });
    service.registerMenuItem({
      id: "titlebar.workbench",
      menu: "titlebar.primary",
      command: "workbench",
      group: "workbench",
      order: 1
    });

    expect(service.getMenuItems("titlebar.primary").map((item) => item.command)).toEqual([
      "a",
      "z",
      "workbench"
    ]);
    expect(service.getMenuItems("activitybar.primary").map((item) => item.command)).toEqual(["activity"]);
  });

  it("publishes menu changes and removes menu items through disposables", () => {
    const service = new MenuService();
    const changedMenus: string[] = [];
    service.onDidChangeMenu((menu) => changedMenus.push(menu));

    const disposable = service.registerMenuItem({
      id: "titlebar.save",
      menu: "titlebar.primary",
      command: "file.save"
    });

    expect(service.getMenuItems("titlebar.primary").map((item) => item.command)).toEqual(["file.save"]);

    disposable.dispose();

    expect(service.getMenuItems("titlebar.primary")).toEqual([]);
    expect(changedMenus).toEqual(["titlebar.primary", "titlebar.primary"]);
  });

  it("filters menu items through context key expressions", () => {
    const contextKeyService = new ContextKeyService();
    const service = new MenuService(contextKeyService);
    service.registerMenuItem({
      id: "titlebar.save",
      menu: "titlebar.primary",
      command: "file.save",
      order: 10,
      when: ContextKeyExpr.equals("fileSystem.available", true)
    });
    service.registerMenuItem({
      id: "titlebar.export",
      menu: "titlebar.primary",
      command: "file.exportHtml",
      order: 20
    });

    expect(service.getMenuItems("titlebar.primary").map((item) => item.command)).toEqual(["file.exportHtml"]);

    contextKeyService.setValue("fileSystem.available", true);

    expect(service.getMenuItems("titlebar.primary").map((item) => item.command)).toEqual(["file.save", "file.exportHtml"]);
  });

  it("publishes affected menu changes when context values change", () => {
    const contextKeyService = new ContextKeyService();
    const service = new MenuService(contextKeyService);
    const changedMenus: string[] = [];
    service.registerMenuItem({
      id: "titlebar.save",
      menu: "titlebar.primary",
      command: "file.save",
      when: ContextKeyExpr.equals("fileSystem.available", true)
    });
    service.registerMenuItem({
      id: "activitybar.tags",
      menu: "activitybar.primary",
      command: "workbench.sidebar.tags",
      when: ContextKeyExpr.equals("workspace.open", true)
    });
    service.onDidChangeMenu((menu) => changedMenus.push(menu));

    contextKeyService.setValue("fileSystem.available", true);
    contextKeyService.setValue("workspace.open", true);
    contextKeyService.setValue("unrelated", true);

    expect(changedMenus).toEqual(["titlebar.primary", "activitybar.primary"]);
  });
});

describe("extensions", () => {
  it("registers manifest command metadata, menus, and keybindings", async () => {
    const { commandService, extensionService, keybindingService, menuService } = createExtensionServices();

    extensionService.registerExtension({
      id: "notes.tools",
      displayName: "Notes Tools",
      contributes: {
        commands: [
          {
            command: "notes.insertDate",
            title: "Insert Date",
            category: "Notes"
          }
        ],
        menus: [
          {
            id: "titlebar.notes.insertDate",
            menu: "titlebar.primary",
            command: "notes.insertDate",
            title: "Insert Date",
            icon: "calendar",
            group: "20_notes",
            order: 10
          }
        ],
        keybindings: [
          {
            command: "notes.insertDate",
            keybinding: { key: "d", primary: true },
            weight: 20
          }
        ]
      }
    });

    expect(extensionService.getExtensions().map((extension) => extension.id)).toEqual(["notes.tools"]);
    expect(commandService.getCommands().map((command) => ({
      id: command.id,
      title: command.title,
      category: command.category
    }))).toEqual([
      { id: "notes.insertDate", title: "Insert Date", category: "Notes" }
    ]);
    expect(menuService.getMenuItems("titlebar.primary").map((item) => item.command)).toEqual(["notes.insertDate"]);
    expect(keybindingService.resolve({ key: "d", ctrlKey: true })).toBe("notes.insertDate");
    await expect(commandService.executeCommand("notes.insertDate")).rejects.toThrow("No extension activation handler registered");
  });

  it("indexes explicit and command-derived activation events", async () => {
    const activationCalls: string[] = [];
    const { extensionService } = createExtensionServices((request) => {
      activationCalls.push(`${request.activationEvent}:${request.extension.id}:${request.extension.activationState}`);
    });

    extensionService.registerExtension({
      id: "notes.activation",
      displayName: "Notes Activation",
      activationEvents: ["onStartupFinished", "onLanguage:markdown", "onStartupFinished"],
      contributes: {
        commands: [
          {
            command: "notes.insertDate",
            title: "Insert Date"
          }
        ]
      }
    });

    expect(extensionService.getExtensions()).toEqual([
      {
        id: "notes.activation",
        displayName: "Notes Activation",
        activationEvents: [
          "onStartupFinished",
          "onLanguage:markdown",
          "onCommand:notes.insertDate"
        ],
        activationState: "inactive"
      }
    ]);

    await expect(extensionService.activateByEvent("onCommand:notes.insertDate")).resolves.toEqual([
      {
        id: "notes.activation",
        displayName: "Notes Activation",
        activationEvents: [
          "onStartupFinished",
          "onLanguage:markdown",
          "onCommand:notes.insertDate"
        ],
        activationState: "activated"
      }
    ]);
    await expect(extensionService.activateByEvent("onStartupFinished")).resolves.toEqual([]);
    await expect(extensionService.activateByEvent("onCommand:missing")).resolves.toEqual([]);
    expect(activationCalls).toEqual(["onCommand:notes.insertDate:notes.activation:activating"]);
  });

  it("activates extension command contributions before command execution", async () => {
    const activationCalls: string[] = [];
    const services = createExtensionServices((request) => {
      activationCalls.push(`${request.activationEvent}:${request.extension.id}`);
      request.context.commands.registerCommand("notes.runCommand", () => "activated command");
    });

    services.extensionService.registerExtension({
      id: "notes.commandActivation",
      contributes: {
        commands: [
          {
            command: "notes.runCommand",
            title: "Run Command"
          }
        ]
      }
    });

    await expect(services.commandService.executeCommand("notes.runCommand")).resolves.toBe("activated command");
    await expect(services.commandService.executeCommand("notes.runCommand")).resolves.toBe("activated command");
    expect(activationCalls).toEqual(["onCommand:notes.runCommand:notes.commandActivation"]);
  });

  it("cleans up runtime command handlers when unregistering extensions", async () => {
    const services = createExtensionServices((request) => {
      request.context.commands.registerCommand("notes.runtimeCleanup", () => "runtime command");
    });

    const disposable = services.extensionService.registerExtension({
      id: "notes.runtimeCleanup",
      contributes: {
        commands: [
          {
            command: "notes.runtimeCleanup",
            title: "Runtime Cleanup"
          }
        ]
      }
    });

    await expect(services.commandService.executeCommand("notes.runtimeCleanup")).resolves.toBe("runtime command");

    disposable.dispose();

    expect(services.extensionService.getExtensions()).toEqual([]);
    await expect(services.commandService.executeCommand("notes.runtimeCleanup")).rejects.toThrow("Unknown command");
  });

  it("disposes partial runtime registrations when activation fails", async () => {
    const services = createExtensionServices((request) => {
      request.context.commands.registerCommand("notes.failedRuntime", () => "leaked");
      throw new Error("Activation failed");
    });

    services.extensionService.registerExtension({
      id: "notes.failedRuntime",
      activationEvents: ["onStartupFinished"],
      contributes: {
        commands: [
          {
            command: "notes.failedRuntime",
            title: "Failed Runtime"
          }
        ]
      }
    });

    await expect(services.extensionService.activateByEvent("onStartupFinished")).rejects.toThrow("Activation failed");
    expect(() => services.commandService.registerCommand({
      id: "notes.failedRuntime",
      title: "Recovered Runtime",
      run: () => "recovered"
    })).not.toThrow();
    await expect(services.commandService.executeCommand("notes.failedRuntime")).resolves.toBe("recovered");
  });

  it("requires titles for uncontributed runtime commands", async () => {
    const services = createExtensionServices((request) => {
      request.context.commands.registerCommand("notes.hiddenRuntime", () => "hidden");
    });

    services.extensionService.registerExtension({
      id: "notes.hiddenRuntime",
      activationEvents: ["onStartupFinished"]
    });

    await expect(services.extensionService.activateByEvent("onStartupFinished"))
      .rejects.toThrow("Runtime command title must be provided for uncontributed command");
  });

  it("registers titled uncontributed runtime commands through the extension context", async () => {
    const services = createExtensionServices((request) => {
      request.context.commands.registerCommand("notes.hiddenRuntime", () => "hidden", {
        title: "Hidden Runtime",
        category: "Notes"
      });
    });

    const disposable = services.extensionService.registerExtension({
      id: "notes.hiddenRuntime",
      activationEvents: ["onStartupFinished"]
    });

    await expect(services.extensionService.activateByEvent("onStartupFinished")).resolves.toEqual([
      {
        id: "notes.hiddenRuntime",
        activationEvents: ["onStartupFinished"],
        activationState: "activated"
      }
    ]);
    expect(services.commandService.getCommands()).toEqual([
      { id: "notes.hiddenRuntime", title: "Hidden Runtime", category: "Notes" }
    ]);
    await expect(services.commandService.executeCommand("notes.hiddenRuntime")).resolves.toBe("hidden");

    disposable.dispose();

    expect(services.commandService.getCommands()).toEqual([]);
  });

  it("lets extension context keys drive contributed menu visibility", async () => {
    const services = createExtensionServices((request) => {
      request.context.contextKeys.setValue("notes.context.enabled", true);
      expect(request.context.contextKeys.getValue("notes.context.enabled")).toBe(true);
      request.context.commands.registerCommand("notes.context.disable", () => {
        request.context.contextKeys.setValue("notes.context.enabled", undefined);
      });
    });

    services.extensionService.registerExtension({
      id: "notes.context",
      activationEvents: ["onStartupFinished"],
      contributes: {
        commands: [
          {
            command: "notes.context.disable",
            title: "Disable Context"
          }
        ],
        menus: [
          {
            id: "activitybar.notes.context",
            menu: "activitybar.primary",
            command: "notes.context.disable",
            when: "notes.context.enabled"
          }
        ]
      }
    });

    expect(services.menuService.getMenuItems("activitybar.primary")).toEqual([]);

    await expect(services.extensionService.activateByEvent("onStartupFinished")).resolves.toHaveLength(1);

    expect(services.contextKeyService.getValue("notes.context.enabled")).toBe(true);
    expect(services.menuService.getMenuItems("activitybar.primary").map((item) => item.command)).toEqual(["notes.context.disable"]);

    await services.commandService.executeCommand("notes.context.disable");

    expect(services.contextKeyService.getValue("notes.context.enabled")).toBeUndefined();
    expect(services.menuService.getMenuItems("activitybar.primary")).toEqual([]);
  });

  it("clears extension-owned context keys when unregistering extensions", async () => {
    const services = createExtensionServices((request) => {
      request.context.contextKeys.setValue("notes.cleanup.enabled", true);
    });

    const disposable = services.extensionService.registerExtension({
      id: "notes.cleanup",
      activationEvents: ["onStartupFinished"],
      contributes: {
        menus: [
          {
            id: "activitybar.notes.cleanup",
            menu: "activitybar.primary",
            command: "notes.cleanup",
            when: "notes.cleanup.enabled"
          }
        ]
      }
    });

    await services.extensionService.activateByEvent("onStartupFinished");
    expect(services.contextKeyService.getValue("notes.cleanup.enabled")).toBe(true);

    disposable.dispose();

    expect(services.contextKeyService.getValue("notes.cleanup.enabled")).toBeUndefined();
    expect(services.menuService.getMenuItems("activitybar.primary")).toEqual([]);
  });

  it("clears extension-owned context keys when activation fails", async () => {
    const services = createExtensionServices((request) => {
      request.context.contextKeys.setValue("notes.failedContext.enabled", true);
      throw new Error("Activation failed");
    });

    services.extensionService.registerExtension({
      id: "notes.failedContext",
      activationEvents: ["onStartupFinished"]
    });

    await expect(services.extensionService.activateByEvent("onStartupFinished")).rejects.toThrow("Activation failed");
    expect(services.contextKeyService.getValue("notes.failedContext.enabled")).toBeUndefined();
  });

  it("keeps extension context keys inside the extension namespace", async () => {
    const services = createExtensionServices((request) => {
      request.context.contextKeys.setValue("workspace.open", true);
    });

    services.extensionService.registerExtension({
      id: "notes.namespace",
      activationEvents: ["onStartupFinished"]
    });

    await expect(services.extensionService.activateByEvent("onStartupFinished"))
      .rejects.toThrow("Extension context key must start with");
    expect(services.contextKeyService.getValue("workspace.open")).toBeUndefined();
  });

  it("rejects matching activation events when no activation handler is registered", async () => {
    const { extensionService } = createExtensionServices();

    extensionService.registerExtension({
      id: "notes.noActivationHost",
      activationEvents: ["onStartupFinished"]
    });

    await expect(extensionService.activateByEvent("onStartupFinished"))
      .rejects.toThrow("No extension activation handler registered");
    expect(extensionService.getExtensions().map((extension) => extension.activationState)).toEqual(["inactive"]);
  });

  it("removes activation events when unregistering extensions", async () => {
    const activationCalls: string[] = [];
    const { extensionService } = createExtensionServices((request) => {
      activationCalls.push(request.extension.id);
    });
    const disposable = extensionService.registerExtension({
      id: "notes.disposableActivation",
      activationEvents: ["onStartupFinished"]
    });

    disposable.dispose();

    await expect(extensionService.activateByEvent("onStartupFinished")).resolves.toEqual([]);
    expect(activationCalls).toEqual([]);
  });

  it("marks failed extension activation without unregistering contributions", async () => {
    const { commandService, extensionService } = createExtensionServices(() => {
      throw new Error("Activation failed");
    });

    extensionService.registerExtension({
      id: "notes.failedActivation",
      activationEvents: ["onStartupFinished"],
      contributes: {
        commands: [
          {
            command: "notes.failedCommand",
            title: "Failed Command"
          }
        ]
      }
    });

    await expect(extensionService.activateByEvent("onStartupFinished")).rejects.toThrow("Activation failed");
    expect(extensionService.getExtensions().map((extension) => ({
      id: extension.id,
      activationState: extension.activationState
    }))).toEqual([
      {
        id: "notes.failedActivation",
        activationState: "failed"
      }
    ]);
    expect(commandService.getCommands().map((command) => command.id)).toEqual(["notes.failedCommand"]);
  });

  it("parses manifest menu when clauses through context keys", () => {
    const { contextKeyService, extensionService, menuService } = createExtensionServices();

    extensionService.registerExtension({
      id: "notes.workspace",
      contributes: {
        menus: [
          {
            id: "activitybar.notes.workspace",
            menu: "activitybar.primary",
            command: "notes.workspace",
            title: "Workspace Notes",
            when: "workspace.open && activeResource.scheme == file"
          }
        ]
      }
    });

    expect(menuService.getMenuItems("activitybar.primary")).toEqual([]);

    contextKeyService.setValue("workspace.open", true);
    contextKeyService.setValue("activeResource.scheme", "file");

    expect(menuService.getMenuItems("activitybar.primary").map((item) => item.command)).toEqual(["notes.workspace"]);
  });

  it("unregisters all manifest contributions through the returned disposable", async () => {
    const { commandService, extensionService, keybindingService, menuService } = createExtensionServices();
    const disposable = extensionService.registerExtension({
      id: "notes.cleanup",
      contributes: {
        commands: [
          {
            command: "notes.cleanup",
            title: "Cleanup Notes"
          }
        ],
        menus: [
          {
            id: "titlebar.notes.cleanup",
            menu: "titlebar.primary",
            command: "notes.cleanup"
          }
        ],
        keybindings: [
          {
            command: "notes.cleanup",
            keybinding: { key: "x", primary: true }
          }
        ]
      }
    });

    disposable.dispose();

    expect(extensionService.getExtensions()).toEqual([]);
    expect(commandService.getCommands()).toEqual([]);
    expect(menuService.getMenuItems("titlebar.primary")).toEqual([]);
    expect(keybindingService.resolve({ key: "x", ctrlKey: true })).toBeUndefined();
    await expect(commandService.executeCommand("notes.cleanup")).rejects.toThrow("Unknown command");
  });

  it("rejects duplicate extension ids", () => {
    const { extensionService } = createExtensionServices();

    extensionService.registerExtension({ id: "notes.duplicate" });

    expect(() => extensionService.registerExtension({ id: "notes.duplicate" }))
      .toThrow("Extension already registered");
    expect(extensionService.getExtensions().map((extension) => extension.id)).toEqual(["notes.duplicate"]);
  });

  it("rejects invalid manifest contributions without partial registration", () => {
    const { commandService, extensionService } = createExtensionServices();

    expect(() => extensionService.registerExtension({
      id: "notes.invalid",
      contributes: {
        commands: [
          {
            command: "notes.partial",
            title: "Partial"
          }
        ],
        menus: [
          {
            id: "titlebar.notes.invalid",
            menu: "titlebar.primary",
            command: "notes.partial",
            when: "workspace.open &&"
          }
        ]
      }
    })).toThrow("Invalid menu when clause");
    expect(commandService.getCommands()).toEqual([]);
    expect(extensionService.getExtensions()).toEqual([]);

    expect(() => extensionService.registerExtension({
      id: "notes.invalid-command",
      contributes: {
        commands: [
          {
            command: "",
            title: "Missing Command"
          }
        ]
      }
    })).toThrow("Command contribution id");

    expect(() => extensionService.registerExtension({
      id: "notes.invalid-activation",
      activationEvents: [""]
    })).toThrow("Activation event");
  });
});

describe("exports", () => {
  it("exports documents through registered providers and saves through the native bridge", async () => {
    const savedDocuments: string[] = [];
    const service = new ExportService({
      nativeBridge: {
        isAvailable: true,
        async saveDocument(document) {
          savedDocuments.push(document.value);
          return true;
        }
      }
    });
    service.registerProvider({
      format: "html",
      title: "HTML",
      exportDocument(input) {
        return {
          format: "html",
          defaultFileName: `${input.name}.html`,
          mimeType: "text/html",
          value: `<h1>${input.value}</h1>`
        };
      }
    });

    await expect(service.exportAndSave({
      uri: URI.untitled("Draft.md"),
      name: "Draft.md",
      value: "Draft"
    }, "html")).resolves.toBe(true);

    expect(savedDocuments).toEqual(["<h1>Draft</h1>"]);
  });

  it("removes export providers through disposables", async () => {
    const service = new ExportService({
      browserSave: () => true
    });
    const disposable = service.registerProvider({
      format: "html",
      title: "HTML",
      exportDocument(input) {
        return {
          format: "html",
          defaultFileName: input.name,
          mimeType: "text/html",
          value: input.value
        };
      }
    });

    expect(service.getProviders().map((provider) => provider.format)).toEqual(["html"]);

    disposable.dispose();

    expect(service.getProviders()).toEqual([]);
    await expect(service.exportDocument({
      uri: URI.untitled("Draft.md"),
      name: "Draft.md",
      value: "Draft"
    }, "html")).rejects.toThrow("No export provider");
  });

  it("adds a resource resolver context to export provider input", async () => {
    const requestedResources: string[] = [];
    const service = new ExportService({
      browserSave: () => true,
      resourceService: {
        isAvailable: () => true,
        async resolveImageSource(noteUri, source) {
          requestedResources.push(`${noteUri.toString()}:${source}`);
          return `data:image/png;base64,${source}`;
        }
      }
    });
    service.registerProvider({
      format: "html",
      title: "HTML",
      async exportDocument(input) {
        const imageSource = await input.resolveImageSource?.("assets/a.png");

        return {
          format: "html",
          defaultFileName: input.name,
          mimeType: "text/html",
          value: `${input.assetMode}:${imageSource ?? "missing"}`
        };
      }
    });

    const exported = await service.exportDocument({
      uri: URI.file("C:/Notes/a.md"),
      name: "a.md",
      value: "Draft"
    }, "html");

    expect(exported.value).toBe("inline:data:image/png;base64,assets/a.png");
    expect(requestedResources).toEqual(["file://C:/Notes/a.md:assets/a.png"]);
  });

  it("uses file asset mode when native export saving is available", async () => {
    const service = new ExportService({
      nativeBridge: {
        isAvailable: true,
        async saveDocument() {
          return true;
        }
      }
    });
    service.registerProvider({
      format: "html",
      title: "HTML",
      exportDocument(input) {
        return {
          format: "html",
          defaultFileName: input.name,
          mimeType: "text/html",
          value: input.assetMode ?? "missing"
        };
      }
    });

    const exported = await service.exportDocument({
      uri: URI.file("C:/Notes/a.md"),
      name: "a.md",
      value: "Draft"
    }, "html");

    expect(exported.value).toBe("file");
  });

  it("preserves explicit export asset mode overrides", async () => {
    const service = new ExportService({
      nativeBridge: {
        isAvailable: true,
        async saveDocument() {
          return true;
        }
      }
    });
    service.registerProvider({
      format: "html",
      title: "HTML",
      exportDocument(input) {
        return {
          format: "html",
          defaultFileName: input.name,
          mimeType: "text/html",
          value: input.assetMode ?? "missing"
        };
      }
    });

    const exported = await service.exportDocument({
      uri: URI.file("C:/Notes/a.md"),
      name: "a.md",
      value: "Draft",
      assetMode: "inline"
    }, "html");

    expect(exported.value).toBe("inline");
  });
});

describe("keybindings", () => {
  it("resolves primary keybindings and prefers higher weighted rules", () => {
    const service = new KeybindingService();

    service.registerKeybinding({
      command: "workbench.quickOpen",
      keybinding: { key: "p", primary: true },
      weight: 1
    });
    service.registerKeybinding({
      command: "workbench.commandPalette.open",
      keybinding: { key: "p", primary: true },
      weight: 2
    });

    expect(service.resolve({ key: "P", ctrlKey: true })).toBe("workbench.commandPalette.open");
    expect(service.resolve({ key: "p", metaKey: true })).toBe("workbench.commandPalette.open");
    expect(service.resolve({ key: "p" })).toBeUndefined();
  });

  it("removes keybindings through disposables and formats labels", () => {
    const service = new KeybindingService({ primaryModifierLabel: "Cmd" });
    const disposable = service.registerKeybinding({
      command: "file.save",
      keybinding: { key: "s", primary: true, shift: true }
    });

    expect(service.getKeybindingLabel("file.save")).toBe("Cmd+Shift+S");

    disposable.dispose();

    expect(service.resolve({ key: "s", metaKey: true, shiftKey: true })).toBeUndefined();
    expect(service.getKeybindingLabel("file.save")).toBeUndefined();
  });

  it("dispatches resolved keybindings through the command service", async () => {
    const services = new ServiceCollection();
    const commandService = new CommandService(services);
    const keybindingService = new KeybindingService();
    let saved = false;

    commandService.registerCommand({
      id: "file.save",
      title: "Save",
      run: () => {
        saved = true;
      }
    });
    keybindingService.registerKeybinding({
      command: "file.save",
      keybinding: { key: "s", primary: true }
    });

    await expect(keybindingService.dispatch({ key: "s" }, commandService)).resolves.toBe(false);
    await expect(keybindingService.dispatch({ key: "s", ctrlKey: true }, commandService)).resolves.toBe(true);
    expect(saved).toBe(true);
  });

  it("applies user keybindings over defaults and replaces user rules", () => {
    const service = new KeybindingService();

    service.registerKeybinding({
      command: "file.save",
      keybinding: { key: "s", primary: true }
    });
    service.setUserKeybindings([
      {
        command: "workbench.settings.open",
        keybinding: { key: "s", primary: true }
      }
    ]);

    expect(service.resolve({ key: "s", ctrlKey: true })).toBe("workbench.settings.open");
    expect(service.getKeybindingLabel("workbench.settings.open")).toBe("Ctrl+S");
    expect(service.getKeybindingLabel("file.save")).toBeUndefined();
    expect(service.getKeybindings().map((rule) => rule.command)).toEqual(["workbench.settings.open"]);

    service.setUserKeybindings([]);

    expect(service.resolve({ key: "s", ctrlKey: true })).toBe("file.save");
    expect(service.getKeybindingLabel("file.save")).toBe("Ctrl+S");
    expect(service.getKeybindingLabel("workbench.settings.open")).toBeUndefined();
  });

  it("reports the active command and label for a keybinding", () => {
    const service = new KeybindingService();

    service.registerKeybinding({
      command: "file.save",
      keybinding: { key: "s", primary: true }
    });
    service.registerKeybinding({
      command: "file.saveAs",
      keybinding: { key: "s", primary: true, shift: true }
    });

    expect(service.getCommandForKeybinding({ key: "S", primary: true })).toBe("file.save");
    expect(service.getKeybindingLabelForKeybinding({ key: "s", primary: true, alt: true })).toBe("Ctrl+Alt+S");

    service.setUserKeybindings([
      {
        command: "workbench.settings.open",
        keybinding: { key: "s", primary: true }
      }
    ]);

    expect(service.getCommandForKeybinding({ key: "s", primary: true })).toBe("workbench.settings.open");
  });

  it("creates keybindings from keyboard events", () => {
    expect(keybindingFromEvent({ key: "K", ctrlKey: true, shiftKey: true })).toEqual({
      key: "k",
      primary: true,
      shift: true
    });
    expect(keybindingFromEvent({ key: "Control", ctrlKey: true })).toBeUndefined();
  });
});

describe("file tree", () => {
  it("flattens nested markdown files in stable tree order", () => {
    const root: FileTreeEntry = {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: [
        {
          uri: URI.file("C:/Notes/a.md"),
          name: "a.md",
          relativePath: "a.md",
          kind: "file"
        },
        {
          uri: URI.file("C:/Notes/folder"),
          name: "folder",
          relativePath: "folder",
          kind: "directory",
          children: [
            {
              uri: URI.file("C:/Notes/folder/b.md"),
              name: "b.md",
              relativePath: "folder/b.md",
              kind: "file"
            }
          ]
        }
      ]
    };

    expect(flattenFileTree(root).map((entry) => entry.relativePath)).toEqual(["a.md", "folder/b.md"]);
  });

  it("publishes native workspace file changes", () => {
    const emitter = new Emitter<WorkspaceFileTree | undefined>();
    const workspaceFiles = createWorkspaceFileTree();
    const host: NativeFileSystemHost = {
      isAvailable: true,
      onDidChangeWorkspaceFiles: emitter.event,
      async openWorkspace() {
        return workspaceFiles;
      },
      async openRecentWorkspace() {
        return workspaceFiles;
      },
      async refreshWorkspace() {
        return workspaceFiles;
      },
      async readFile() {
        throw new Error("Not used");
      },
      async writeFile() {
        throw new Error("Not used");
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const service = new NativeFileService(host);
    let observed: WorkspaceFileTree | undefined;

    service.onDidChangeWorkspaceFiles((workspace) => {
      observed = workspace;
    });

    emitter.fire(workspaceFiles);

    expect(observed?.root.name).toBe("Notes");
    expect(service.getWorkspaceFiles()?.files.map((entry) => entry.name)).toEqual(["a.md"]);
  });

  it("opens recent workspaces through the native file host", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    let requestedUri: string | undefined;
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace(uri) {
        requestedUri = uri;
        return workspaceFiles;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile() {
        throw new Error("Not used");
      },
      async writeFile() {
        throw new Error("Not used");
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const service = new NativeFileService(host);
    let observed: WorkspaceFileTree | undefined;

    service.onDidChangeWorkspaceFiles((workspace) => {
      observed = workspace;
    });

    const opened = await service.openRecentWorkspace(URI.file("C:/Notes"));

    expect(requestedUri).toBe("file://C:/Notes");
    expect(opened?.root.name).toBe("Notes");
    expect(observed?.files.map((entry) => entry.name)).toEqual(["a.md"]);
  });
});

describe("workspace text files", () => {
  it("opens and saves native files through the file service", async () => {
    const host = createMemoryHost();
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    const opened = await textFileService.openFile(URI.file("C:/Notes/a.md"));
    expect(opened.value).toBe("# A");

    textFileService.updateContent("# Updated");
    const saved = await textFileService.save();

    expect(saved.dirty).toBe(false);
    expect(host.files.get("file://C:/Notes/a.md")).toBe("# Updated");
  });

  it("uses the last disk mtime when saving native files", async () => {
    const writes: SaveFileOptions[] = [];
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace() {
        return undefined;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile(uri) {
        return {
          uri: URI.parse(uri),
          name: "a.md",
          value: "# A",
          mtime: 10
        };
      },
      async writeFile(uri, value, options) {
        writes.push(options ?? {});
        return {
          uri: URI.parse(uri),
          name: "a.md",
          value,
          mtime: 20
        };
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-mtime-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    const opened = await textFileService.openFile(URI.file("C:/Notes/a.md"));
    textFileService.updateContent("# Local");
    const saved = await textFileService.save();

    expect(opened.lastSavedMtime).toBe(10);
    expect(writes[0]).toEqual({ expectedMtime: 10 });
    expect(saved.lastSavedMtime).toBe(20);
  });

  it("keeps the active model dirty when native save reports a conflict", async () => {
    const uri = URI.file("C:/Notes/a.md");
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace() {
        return undefined;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile() {
        return {
          uri,
          name: "a.md",
          value: "# A",
          mtime: 10
        };
      },
      async writeFile() {
        throw new FileSaveConflictError({
          uri,
          expectedMtime: 10,
          diskMtime: 20
        });
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-conflict-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    await textFileService.openFile(uri);
    textFileService.updateContent("# Local");

    await expect(textFileService.save()).rejects.toBeInstanceOf(FileSaveConflictError);
    expect(textFileService.getActiveModel().dirty).toBe(true);
    expect(textFileService.getActiveModel().value).toBe("# Local");
  });
});

describe("workspace index", () => {
  it("uses a native index snapshot bridge when available", () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;
    const values = new Map<string, string>();
    (globalThis as {
      typoraPlus?: {
        readonly indexSnapshots: {
          readonly isAvailable: boolean;
          read(key: string): string | undefined;
          write(key: string, value: string): void;
        };
      };
    }).typoraPlus = {
      indexSnapshots: {
        isAvailable: true,
        read: (key) => values.get(key),
        write: (key, value) => values.set(key, value)
      }
    };

    try {
      const storage = createDefaultWorkspaceIndexSnapshotStorage();

      storage?.write("typora-plus.workspaceIndex.snapshot", "snapshot");

      expect(storage?.read("typora-plus.workspaceIndex.snapshot")).toBe("snapshot");
      expect(values.get("typora-plus.workspaceIndex.snapshot")).toBe("snapshot");
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });

  it("indexes workspace files and returns cross-file search results", async () => {
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "# Alpha\nShared topic"],
      ["file://C:/Notes/folder/b.md", "# Beta\nAnother shared topic"]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10,
      maxPreviewLength: 80
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md"),
      createFileEntry("C:/Notes/folder/b.md", "b.md", "folder/b.md")
    ]));

    const results = service.query("shared topic");

    expect(service.getStatus().state).toBe("ready");
    expect(results.map((result) => result.relativePath)).toEqual(["a.md", "folder/b.md"]);
    expect(results.map((result) => result.line)).toEqual([2, 2]);
  });

  it("skips files larger than the configured index limit", async () => {
    const host = createMemoryHost([["file://C:/Notes/large.md", "searchable"]]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxFileSizeBytes: 4,
      maxResults: 10
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      {
        ...createFileEntry("C:/Notes/large.md", "large.md", "large.md"),
        size: 100
      }
    ]));

    expect(service.getStatus().skippedFiles).toBe(1);
    expect(service.query("searchable")).toEqual([]);
  });

  it("applies updated index configuration to queries and future indexing", async () => {
    const workspaceFiles = createWorkspaceFileTree([
      {
        ...createFileEntry("C:/Notes/a.md", "a.md", "a.md"),
        size: 20
      },
      {
        ...createFileEntry("C:/Notes/b.md", "b.md", "b.md"),
        size: 20
      }
    ]);
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "shared topic"],
      ["file://C:/Notes/b.md", "shared topic"]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxFileSizeBytes: 4,
      maxResults: 1
    });

    await service.indexWorkspace(workspaceFiles);

    expect(service.getStatus().skippedFiles).toBe(2);
    expect(service.query("shared")).toEqual([]);

    service.configure({
      maxFileSizeBytes: 100,
      maxResults: 2
    });
    await service.indexWorkspace(workspaceFiles);

    expect(service.getStatus().skippedFiles).toBe(0);
    expect(service.query("shared").map((result) => result.relativePath)).toEqual(["a.md", "b.md"]);

    service.configure({
      maxFileSizeBytes: 100,
      maxResults: 1
    });

    expect(service.query("shared").map((result) => result.relativePath)).toEqual(["a.md"]);
  });

  it("updates a saved workspace file in the index without a full reindex", async () => {
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "# Alpha\n#old\n[Beta](b.md)"],
      ["file://C:/Notes/b.md", "# Beta"]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });
    const alphaFile = createFileEntry("C:/Notes/a.md", "a.md", "a.md");
    const betaFile = createFileEntry("C:/Notes/b.md", "b.md", "b.md");

    await service.indexWorkspace(createWorkspaceFileTree([
      alphaFile,
      betaFile
    ]));

    expect(service.query("Alpha").map((result) => result.relativePath)).toEqual(["a.md"]);
    expect(service.getTaggedResources("old").map((tag) => tag.relativePath)).toEqual(["a.md"]);
    expect(service.getBacklinks(URI.file("C:/Notes/b.md")).map((link) => link.relativePath)).toEqual(["a.md"]);

    await service.indexFile(alphaFile, "# Revised\n#fresh");

    expect(service.query("Alpha")).toEqual([]);
    expect(service.query("Revised").map((result) => result.relativePath)).toEqual(["a.md"]);
    expect(service.getTaggedResources("old")).toEqual([]);
    expect(service.getTaggedResources("fresh").map((tag) => tag.relativePath)).toEqual(["a.md"]);
    expect(service.getBacklinks(URI.file("C:/Notes/b.md"))).toEqual([]);
  });

  it("delegates indexed storage and queries through a provider boundary", async () => {
    const host = createMemoryHost([["file://C:/Notes/a.md", "# Alpha\nShared topic"]]);
    const provider = new RecordingWorkspaceIndexProvider();
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    }, provider);

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md")
    ]));

    expect(provider.storedDocuments.map((document) => document.relativePath)).toEqual(["a.md"]);

    const results = service.query("shared");

    expect(provider.lastQuery).toEqual({
      value: "shared",
      options: {
        maxPreviewLength: 160,
        maxResults: 10
      }
    });
    expect(results.map((result) => result.relativePath)).toEqual(["provider.md"]);
  });

  it("persists indexed snapshots through injected provider storage", async () => {
    const storage = createMemoryStorage();
    const host = createMemoryHost([[
      "file://C:/Notes/a.md",
      "# Alpha\nShared topic #project\n[Beta](b.md)"
    ]]);
    const file = createFileEntry("C:/Notes/a.md", "a.md", "a.md");
    const provider = new PersistedWorkspaceIndexProvider({
      storage,
      storageKey: "workspace-index",
      maxSnapshotBytes: 10000
    });
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    }, provider);

    await service.indexWorkspace(createWorkspaceFileTree([file]));

    const restoredProvider = new PersistedWorkspaceIndexProvider({
      storage,
      storageKey: "workspace-index",
      maxSnapshotBytes: 10000
    });
    restoredProvider.setSnapshotScope(URI.file("C:/Notes").toString());
    const restoredService = new WorkspaceIndexService(new NativeFileService(createMemoryHost()), {
      maxResults: 10
    }, restoredProvider);

    expect(restoredService.getStatus().state).toBe("ready");
    expect(restoredService.query("shared").map((result) => result.relativePath)).toEqual(["a.md"]);
    expect(restoredService.getTaggedResources("project").map((tag) => tag.relativePath)).toEqual(["a.md"]);
    expect(restoredService.getMetadata().links.map((link) => link.target)).toEqual(["b.md"]);
  });

  it("scopes persisted index snapshots by workspace root", async () => {
    const storage = createMemoryStorage();
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "alpha workspace topic"],
      ["file://D:/Other/b.md", "beta workspace topic"]
    ]);
    const provider = new PersistedWorkspaceIndexProvider({
      storage,
      storageKey: "workspace-index",
      maxSnapshotBytes: 10000
    });
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    }, provider);

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md")
    ], "C:/Notes", "Notes"));
    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("D:/Other/b.md", "b.md", "b.md")
    ], "D:/Other", "Other"));

    const notesProvider = new PersistedWorkspaceIndexProvider({
      storage,
      storageKey: "workspace-index",
      maxSnapshotBytes: 10000
    });
    notesProvider.setSnapshotScope(URI.file("C:/Notes").toString());
    const otherProvider = new PersistedWorkspaceIndexProvider({
      storage,
      storageKey: "workspace-index",
      maxSnapshotBytes: 10000
    });
    otherProvider.setSnapshotScope(URI.file("D:/Other").toString());

    expect(notesProvider.query("alpha", { maxPreviewLength: 80, maxResults: 10 }).map((result) => result.relativePath))
      .toEqual(["a.md"]);
    expect(notesProvider.query("beta", { maxPreviewLength: 80, maxResults: 10 })).toEqual([]);
    expect(otherProvider.query("beta", { maxPreviewLength: 80, maxResults: 10 }).map((result) => result.relativePath))
      .toEqual(["b.md"]);
    expect(otherProvider.query("alpha", { maxPreviewLength: 80, maxResults: 10 })).toEqual([]);
  });

  it("does not let a canceled workspace scan write stale documents", async () => {
    let resolveStaleRead: ((value: { readonly uri: URI; readonly name: string; readonly value: string }) => void) | undefined;
    const staleRead = new Promise<{ readonly uri: URI; readonly name: string; readonly value: string }>((resolve) => {
      resolveStaleRead = resolve;
    });
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace() {
        return undefined;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile(uri) {
        if (uri.endsWith("stale.md")) {
          return staleRead;
        }

        return {
          uri: URI.parse(uri),
          name: "fresh.md",
          value: "fresh topic"
        };
      },
      async writeFile() {
        throw new Error("Not used");
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });
    const staleScan = service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/stale.md", "stale.md", "stale.md")
    ]));

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/fresh.md", "fresh.md", "fresh.md")
    ]));
    resolveStaleRead?.({
      uri: URI.file("C:/Notes/stale.md"),
      name: "stale.md",
      value: "stale topic"
    });
    await staleScan;

    expect(service.query("fresh").map((result) => result.relativePath)).toEqual(["fresh.md"]);
    expect(service.query("stale")).toEqual([]);
  });

  it("collects headings, tags, and links as workspace metadata", async () => {
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", [
        "# Alpha",
        "See [Beta](folder/b.md) and [[Daily Note|Daily]] #topic #topic/nested",
        "`#ignored` `[Ignored](ignored.md)` ![Image](image.png)",
        "```",
        "# Ignored",
        "[Ignored](ignored.md) #ignored",
        "```"
      ].join("\n")]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md")
    ]));

    const metadata = service.getMetadata();

    expect(metadata.headings.map((heading) => ({
      line: heading.line,
      level: heading.level,
      relativePath: heading.relativePath,
      text: heading.text
    }))).toEqual([
      { line: 1, level: 1, relativePath: "a.md", text: "Alpha" }
    ]);
    expect(metadata.tags.map((tag) => ({
      line: tag.line,
      relativePath: tag.relativePath,
      tag: tag.tag
    }))).toEqual([
      { line: 2, relativePath: "a.md", tag: "topic" },
      { line: 2, relativePath: "a.md", tag: "topic/nested" }
    ]);
    expect(metadata.links.map((link) => ({
      kind: link.kind,
      label: link.label,
      line: link.line,
      relativePath: link.relativePath,
      target: link.target
    }))).toEqual([
      { kind: "markdown", label: "Beta", line: 2, relativePath: "a.md", target: "folder/b.md" },
      { kind: "wiki", label: "Daily", line: 2, relativePath: "a.md", target: "Daily Note" }
    ]);
  });

  it("resolves workspace backlinks from markdown and wiki links", async () => {
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "See [Beta](folder/b.md#details), [Daily](Daily%20Note.md?view=1#intro), and [[Daily Note]]."],
      ["file://C:/Notes/folder/b.md", "# Beta\n[Self](b.md)"],
      ["file://C:/Notes/folder/c.md", "Sibling [Beta](b.md) and [External](https://example.com)."],
      ["file://C:/Notes/Daily Note.md", "# Daily"]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md"),
      createFileEntry("C:/Notes/folder/b.md", "b.md", "folder/b.md"),
      createFileEntry("C:/Notes/folder/c.md", "c.md", "folder/c.md"),
      createFileEntry("C:/Notes/Daily Note.md", "Daily Note.md", "Daily Note.md")
    ]));

    expect(service.getBacklinks(URI.file("C:/Notes/folder/b.md")).map((link) => ({
      kind: link.kind,
      label: link.label,
      line: link.line,
      relativePath: link.relativePath,
      target: link.target
    }))).toEqual([
      { kind: "markdown", label: "Beta", line: 1, relativePath: "a.md", target: "folder/b.md#details" },
      { kind: "markdown", label: "Beta", line: 1, relativePath: "folder/c.md", target: "b.md" }
    ]);
    expect(service.getBacklinks(URI.file("C:/Notes/Daily Note.md")).map((link) => ({
      kind: link.kind,
      label: link.label,
      line: link.line,
      relativePath: link.relativePath,
      target: link.target
    }))).toEqual([
      { kind: "wiki", label: "Daily Note", line: 1, relativePath: "a.md", target: "Daily Note" },
      { kind: "markdown", label: "Daily", line: 1, relativePath: "a.md", target: "Daily%20Note.md?view=1#intro" }
    ]);
    expect(service.getBacklinks(URI.file("C:/Notes/missing.md"))).toEqual([]);
  });

  it("queries indexed tags and tagged resources", async () => {
    const host = createMemoryHost([
      ["file://C:/Notes/a.md", "# Alpha\n#Project #topic/nested"],
      ["file://C:/Notes/b.md", "# Beta\n#project"],
      ["file://C:/Notes/c.md", "`#project`\n#archive"]
    ]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md"),
      createFileEntry("C:/Notes/b.md", "b.md", "b.md"),
      createFileEntry("C:/Notes/c.md", "c.md", "c.md")
    ]));

    expect(service.getTags()).toEqual([
      { tag: "archive", count: 1 },
      { tag: "Project", count: 2 },
      { tag: "topic/nested", count: 1 }
    ]);
    expect(service.getTaggedResources(" project ").map((tag) => ({
      line: tag.line,
      relativePath: tag.relativePath,
      tag: tag.tag
    }))).toEqual([
      { line: 2, relativePath: "a.md", tag: "Project" },
      { line: 2, relativePath: "b.md", tag: "project" }
    ]);
    expect(service.getTaggedResources("missing")).toEqual([]);
  });

  it("clears indexed workspace metadata", async () => {
    const host = createMemoryHost([["file://C:/Notes/a.md", "# Alpha\n#topic"]]);
    const service = new WorkspaceIndexService(new NativeFileService(host), {
      maxResults: 10
    });

    await service.indexWorkspace(createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md", "a.md")
    ]));
    service.clear();

    expect(service.getStatus().state).toBe("idle");
    expect(service.getMetadata()).toEqual({ headings: [], links: [], tags: [] });
    expect(service.getBacklinks(URI.file("C:/Notes/a.md"))).toEqual([]);
    expect(service.getTags()).toEqual([]);
    expect(service.getTaggedResources("topic")).toEqual([]);
  });
});

class RecordingWorkspaceIndexProvider implements WorkspaceIndexProvider {
  storedDocuments: WorkspaceIndexedDocument[] = [];
  lastQuery: { readonly value: string; readonly options: WorkspaceIndexQueryOptions } | undefined;

  clear(): void {
    this.storedDocuments = [];
  }

  getDocumentCount(): number {
    return this.storedDocuments.length;
  }

  upsertDocument(document: WorkspaceIndexedDocument): void {
    this.storedDocuments = [...this.storedDocuments, document];
  }

  removeDocument(uri: URI): void {
    this.storedDocuments = this.storedDocuments.filter((document) => document.uri.toString() !== uri.toString());
  }

  query(value: string, options: WorkspaceIndexQueryOptions): readonly WorkspaceSearchResult[] {
    this.lastQuery = { value, options };
    return [{
      uri: URI.file("C:/Notes/provider.md"),
      name: "provider.md",
      relativePath: "provider.md",
      line: 1,
      preview: "provider result",
      score: 1
    }];
  }

  getMetadata(): WorkspaceIndexMetadata {
    return { headings: [], links: [], tags: [] };
  }

  getTags(): readonly WorkspaceIndexedTagSummary[] {
    return [];
  }

  getTaggedResources(): readonly WorkspaceIndexedTag[] {
    return [];
  }

  getBacklinks(): readonly WorkspaceIndexedLink[] {
    return [];
  }
}

describe("attachments", () => {
  it("saves images through the native bridge", async () => {
    const service = new NativeAttachmentService("assets", {
      isAvailable: true,
      async saveImage(noteUri, image, assetFolder) {
        return {
          uri: "file://C:/Notes/assets/a/image.png",
          relativePath: `${assetFolder}/a/${image.name}`,
          markdown: `![image](${assetFolder}/a/${image.name})`
        };
      }
    });

    const saved = await service.saveImage(URI.file("C:/Notes/a.md"), {
      name: "image.png",
      mimeType: "image/png",
      base64: "AA=="
    });

    expect(saved?.uri.toString()).toBe("file://C:/Notes/assets/a/image.png");
    expect(saved?.markdown).toBe("![image](assets/a/image.png)");
  });

  it("uses updated asset folder configuration for later image saves", async () => {
    const usedAssetFolders: string[] = [];
    const service = new NativeAttachmentService("assets", {
      isAvailable: true,
      async saveImage(_noteUri, image, assetFolder) {
        usedAssetFolders.push(assetFolder);
        return {
          uri: `file://C:/Notes/${assetFolder}/a/${image.name}`,
          relativePath: `${assetFolder}/a/${image.name}`,
          markdown: `![image](${assetFolder}/a/${image.name})`
        };
      }
    });

    await service.saveImage(URI.file("C:/Notes/a.md"), {
      name: "first.png",
      mimeType: "image/png",
      base64: "AA=="
    });
    service.configure({
      assetFolder: "media"
    });
    const saved = await service.saveImage(URI.file("C:/Notes/a.md"), {
      name: "second.png",
      mimeType: "image/png",
      base64: "AA=="
    });

    expect(usedAssetFolders).toEqual(["assets", "media"]);
    expect(saved?.markdown).toBe("![image](media/a/second.png)");
  });
});

describe("resources", () => {
  it("resolves image sources through the native bridge for file notes", async () => {
    const service = new NativeResourceService({
      isAvailable: true,
      async resolveImage(noteUri, source) {
        return {
          dataUrl: "data:image/png;base64,AA==",
          mimeType: "image/png",
          source: `${noteUri}:${source}`
        };
      }
    });

    await expect(service.resolveImageSource(URI.file("C:/Notes/a.md"), "assets/a.png")).resolves.toBe(
      "data:image/png;base64,AA=="
    );
  });

  it("does not resolve image sources for untitled notes", async () => {
    const service = new NativeResourceService({
      isAvailable: true,
      async resolveImage() {
        return {
          dataUrl: "data:image/png;base64,AA==",
          mimeType: "image/png",
          source: "unused"
        };
      }
    });

    await expect(service.resolveImageSource(URI.untitled("Untitled.md"), "assets/a.png")).resolves.toBeUndefined();
  });
});

describe("recents", () => {
  it("deduplicates and persists recent resources", () => {
    const storage = createMemoryStorage();
    const service = new RecentService({
      storageKey: "recents",
      maxEntries: 2,
      now: createCounterClock(),
      storage
    });

    service.addRecentFile(URI.file("C:/Notes/a.md"), "a.md");
    service.addRecentWorkspace(URI.file("C:/Notes"), "Notes");
    service.addRecentFile(URI.file("C:/Notes/a.md"), "a.md");

    expect(service.getRecents().map((recent) => recent.name)).toEqual(["a.md", "Notes"]);

    const restored = new RecentService({
      storageKey: "recents",
      maxEntries: 2,
      storage
    });

    expect(restored.getRecentFiles()[0]?.uri.toString()).toBe("file://C:/Notes/a.md");
  });
});

function createMemoryHost(entries: readonly (readonly [string, string])[] = [["file://C:/Notes/a.md", "# A"]]) {
  const files = new Map<string, string>(entries);
  const host: NativeFileSystemHost & { readonly files: Map<string, string> } = {
    files,
    isAvailable: true,
    async openWorkspace() {
      return undefined;
    },
    async openRecentWorkspace() {
      return undefined;
    },
    async refreshWorkspace() {
      return undefined;
    },
    async readFile(uri) {
      const value = files.get(uri);

      if (value === undefined) {
        throw new Error(`Missing file: ${uri}`);
      }

      return {
        uri: URI.parse(uri),
        name: "a.md",
        value
      };
    },
    async writeFile(uri, value) {
      files.set(uri, value);
      return {
        uri: URI.parse(uri),
        name: "a.md",
        value
      };
    },
    async saveFileAs(defaultName, value) {
      const uri = URI.file(`C:/Notes/${defaultName}`);
      files.set(uri.toString(), value);
      return {
        uri,
        name: defaultName,
        value
      };
    }
  };

  return host;
}

function createWorkspaceFileTree(files: readonly FileTreeEntry[] = [
  createFileEntry("C:/Notes/a.md", "a.md", "a.md")
], rootPath = "C:/Notes", rootName = "Notes"): WorkspaceFileTree {

  return {
    root: {
      uri: URI.file(rootPath),
      name: rootName,
      relativePath: "",
      kind: "directory",
      children: files
    },
    files
  };
}

function createFileEntry(path: string, name: string, relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(path),
    name,
    relativePath,
    kind: "file"
  };
}

function createExtensionServices(activationHandler?: ExtensionActivationHandler) {
  const serviceCollection = new ServiceCollection();
  let extensionService: ExtensionService | undefined;
  const commandService = new CommandService(serviceCollection, {
    activationHandler: async (command) => {
      await extensionService?.activateByEvent(`onCommand:${command}`);
    }
  });
  const contextKeyService = new ContextKeyService();
  const menuService = new MenuService(contextKeyService);
  const keybindingService = new KeybindingService();
  extensionService = new ExtensionService(
    commandService,
    menuService,
    keybindingService,
    {
      contextKeyService,
      ...(activationHandler ? { activationHandler } : {})
    }
  );

  return {
    commandService,
    contextKeyService,
    extensionService,
    keybindingService,
    menuService
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    read(key: string) {
      return values.get(key);
    },
    write(key: string, value: string) {
      values.set(key, value);
    }
  };
}

function createCounterClock() {
  let value = 0;
  return () => {
    value += 1;
    return value;
  };
}
