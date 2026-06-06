export interface URI {
  readonly scheme: string;
  readonly path: string;
  toString(): string;
}

class URIImpl implements URI {
  constructor(
    readonly scheme: string,
    readonly path: string
  ) {}

  toString(): string {
    if (this.scheme === "file") {
      return `file://${this.path}`;
    }

    return `${this.scheme}:${this.path}`;
  }
}

export const URI = {
  file(path: string): URI {
    return new URIImpl("file", normalizePath(path));
  },

  untitled(name: string): URI {
    return new URIImpl("untitled", normalizePath(name));
  },

  parse(value: string): URI {
    const separator = value.indexOf(":");

    if (separator === -1) {
      return URI.file(value);
    }

    const scheme = value.slice(0, separator);
    const path = value.slice(separator + 1).replace(/^\/\//, "");
    return new URIImpl(scheme, normalizePath(path));
  }
};

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}
