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
      return `file://${encodeFileUriPath(this.path)}`;
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
    const pathSource = value.slice(separator + 1);
    const path = scheme === "file" && /^\/\/\/[A-Za-z]:/.test(pathSource)
      ? pathSource.slice(3)
      : pathSource.replace(/^\/\//, "");

    if (scheme === "file") {
      return new URIImpl(scheme, normalizePath(decodeFileUriPath(path)));
    }

    return new URIImpl(scheme, normalizePath(path));
  }
};

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function encodeFileUriPath(path: string): string {
  return normalizePath(path)
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment))
    .join("/");
}

function decodeFileUriPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}
