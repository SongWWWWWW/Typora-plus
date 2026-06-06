import { Disposable, Emitter, type Event, URI } from "@typora-plus/base";
import type { IFileService, SaveFileOptions, TextFileContent } from "./files";
import { createServiceIdentifier } from "./instantiation";

export interface TextFileModel {
  readonly uri: URI;
  readonly name: string;
  readonly languageId: "markdown";
  readonly value: string;
  readonly dirty: boolean;
  readonly version: number;
  readonly lastSavedAt?: Date;
  readonly lastSavedMtime?: number;
}

export interface TextFileSaveOptions {
  readonly overwrite?: boolean;
}

export interface TextFileServiceOptions {
  readonly storageKey: string;
  readonly defaultName: string;
  readonly defaultContent: string;
  readonly now?: () => Date;
}

export interface ITextFileService {
  readonly onDidChangeModel: Event<TextFileModel>;
  openDefault(): TextFileModel;
  getActiveModel(): TextFileModel;
  openFile(uri: URI): Promise<TextFileModel>;
  newUntitled(): TextFileModel;
  updateContent(value: string): TextFileModel;
  save(options?: TextFileSaveOptions): Promise<TextFileModel>;
  saveAs(): Promise<TextFileModel | undefined>;
}

export const ITextFileService = createServiceIdentifier<ITextFileService>("textFile");

export class BrowserTextFileService extends Disposable implements ITextFileService {
  private readonly emitter = new Emitter<TextFileModel>();
  private readonly now: () => Date;
  private model: TextFileModel;

  readonly onDidChangeModel = this.emitter.event;

  constructor(private readonly options: TextFileServiceOptions) {
    super();
    this.now = options.now ?? (() => new Date());
    this.model = this.createInitialModel();
  }

  openDefault(): TextFileModel {
    this.emitter.fire(this.model);
    return this.model;
  }

  getActiveModel(): TextFileModel {
    return this.model;
  }

  async openFile(_uri: URI): Promise<TextFileModel> {
    throw new Error("BrowserTextFileService cannot open native files");
  }

  newUntitled(): TextFileModel {
    this.model = {
      uri: URI.untitled(this.options.defaultName),
      name: this.options.defaultName,
      languageId: "markdown",
      value: this.options.defaultContent,
      dirty: false,
      version: this.model.version + 1
    };
    this.persistDraft();
    this.emitter.fire(this.model);
    return this.model;
  }

  updateContent(value: string): TextFileModel {
    if (value === this.model.value) {
      return this.model;
    }

    this.model = {
      ...this.model,
      value,
      dirty: true,
      version: this.model.version + 1
    };

    this.persistDraft();
    this.emitter.fire(this.model);
    return this.model;
  }

  async save(_options: TextFileSaveOptions = {}): Promise<TextFileModel> {
    this.model = {
      ...this.model,
      dirty: false,
      lastSavedAt: this.now()
    };

    this.persistDraft();
    this.emitter.fire(this.model);
    return this.model;
  }

  async saveAs(): Promise<TextFileModel | undefined> {
    return this.save();
  }

  private createInitialModel(): TextFileModel {
    const stored = readStorage(this.options.storageKey);
    const value = stored?.value ?? this.options.defaultContent;
    const lastSavedAt = stored?.lastSavedAt ? new Date(stored.lastSavedAt) : undefined;

    return {
      uri: URI.untitled(this.options.defaultName),
      name: this.options.defaultName,
      languageId: "markdown",
      value,
      dirty: stored?.dirty ?? false,
      version: 1,
      ...(lastSavedAt ? { lastSavedAt } : {}),
      ...(stored?.lastSavedMtime === undefined ? {} : { lastSavedMtime: stored.lastSavedMtime })
    };
  }

  private persistDraft(): void {
    const storedModel: StoredTextFileModel = {
      value: this.model.value,
      dirty: this.model.dirty
    };

    if (this.model.lastSavedAt) {
      writeStorage(this.options.storageKey, {
        ...storedModel,
        lastSavedAt: this.model.lastSavedAt.toISOString(),
        ...(this.model.lastSavedMtime === undefined ? {} : { lastSavedMtime: this.model.lastSavedMtime })
      });
      return;
    }

    writeStorage(this.options.storageKey, storedModel);
  }
}

export class WorkspaceTextFileService extends Disposable implements ITextFileService {
  private readonly emitter = new Emitter<TextFileModel>();
  private model: TextFileModel;

  readonly onDidChangeModel = this.emitter.event;

  constructor(
    private readonly fileService: IFileService,
    private readonly options: TextFileServiceOptions
  ) {
    super();
    this.model = this.createInitialModel();
  }

  openDefault(): TextFileModel {
    this.emitter.fire(this.model);
    return this.model;
  }

  getActiveModel(): TextFileModel {
    return this.model;
  }

  async openFile(uri: URI): Promise<TextFileModel> {
    const content = await this.fileService.openFile(uri);
    this.model = modelFromContent(content, this.model.version + 1, false);
    this.persistDraft(false);
    this.emitter.fire(this.model);
    return this.model;
  }

  newUntitled(): TextFileModel {
    this.model = {
      uri: URI.untitled(this.options.defaultName),
      name: this.options.defaultName,
      languageId: "markdown",
      value: this.options.defaultContent,
      dirty: false,
      version: this.model.version + 1
    };
    this.persistDraft(true);
    this.emitter.fire(this.model);
    return this.model;
  }

  updateContent(value: string): TextFileModel {
    if (value === this.model.value) {
      return this.model;
    }

    this.model = {
      ...this.model,
      value,
      dirty: true,
      version: this.model.version + 1
    };

    this.persistDraft(true);
    this.emitter.fire(this.model);
    return this.model;
  }

  async save(options: TextFileSaveOptions = {}): Promise<TextFileModel> {
    if (this.model.uri.scheme !== "file") {
      const saved = await this.saveAs();
      return saved ?? this.model;
    }

    const content = await this.fileService.saveFile(this.model.uri, this.model.value, createSaveFileOptions(this.model, options));
    this.model = modelFromContent(content, this.model.version + 1, false);
    this.persistDraft(false);
    this.emitter.fire(this.model);
    return this.model;
  }

  async saveAs(): Promise<TextFileModel | undefined> {
    const content = await this.fileService.saveFileAs(this.model.name, this.model.value);

    if (!content) {
      return undefined;
    }

    this.model = modelFromContent(content, this.model.version + 1, false);
    this.persistDraft(false);
    this.emitter.fire(this.model);
    return this.model;
  }

  private createInitialModel(): TextFileModel {
    const stored = readStorage(this.options.storageKey);
    const value = stored?.value ?? this.options.defaultContent;
    const lastSavedAt = stored?.lastSavedAt ? new Date(stored.lastSavedAt) : undefined;

    return {
      uri: URI.untitled(this.options.defaultName),
      name: this.options.defaultName,
      languageId: "markdown",
      value,
      dirty: stored?.dirty ?? false,
      version: 1,
      ...(lastSavedAt ? { lastSavedAt } : {}),
      ...(stored?.lastSavedMtime === undefined ? {} : { lastSavedMtime: stored.lastSavedMtime })
    };
  }

  private persistDraft(includeContent: boolean): void {
    const storedModel: StoredTextFileModel = {
      value: includeContent ? this.model.value : "",
      dirty: includeContent ? this.model.dirty : false
    };

    if (this.model.lastSavedAt) {
      writeStorage(this.options.storageKey, {
        ...storedModel,
        lastSavedAt: this.model.lastSavedAt.toISOString(),
        ...(this.model.lastSavedMtime === undefined ? {} : { lastSavedMtime: this.model.lastSavedMtime })
      });
      return;
    }

    writeStorage(this.options.storageKey, storedModel);
  }
}

interface StoredTextFileModel {
  readonly value: string;
  readonly dirty: boolean;
  readonly lastSavedAt?: string;
  readonly lastSavedMtime?: number;
}

function readStorage(key: string): StoredTextFileModel | undefined {
  if (!hasLocalStorage()) {
    return undefined;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue) as StoredTextFileModel;
  } catch {
    window.localStorage.removeItem(key);
    return undefined;
  }
}

function writeStorage(key: string, value: StoredTextFileModel): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function modelFromContent(content: TextFileContent, version: number, dirty: boolean): TextFileModel {
  return {
    uri: content.uri,
    name: content.name,
    languageId: "markdown",
    value: content.value,
    dirty,
    version,
    ...(content.mtime === undefined ? {} : { lastSavedAt: new Date(content.mtime), lastSavedMtime: content.mtime })
  };
}

function createSaveFileOptions(model: TextFileModel, options: TextFileSaveOptions): SaveFileOptions {
  return {
    ...(model.lastSavedMtime === undefined ? {} : { expectedMtime: model.lastSavedMtime }),
    ...(options.overwrite ? { overwrite: true } : {})
  };
}
