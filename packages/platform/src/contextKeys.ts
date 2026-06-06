import { Emitter, type Event } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type ContextKeyValue = boolean | number | string | null;

export type ContextKeyExpression =
  | { readonly op: "defined"; readonly key: string }
  | { readonly op: "equals"; readonly key: string; readonly value: ContextKeyValue }
  | { readonly op: "notEquals"; readonly key: string; readonly value: ContextKeyValue }
  | { readonly op: "not"; readonly expression: ContextKeyExpression }
  | { readonly op: "and"; readonly expressions: readonly ContextKeyExpression[] }
  | { readonly op: "or"; readonly expressions: readonly ContextKeyExpression[] };

export interface ContextKeyChangeEvent {
  readonly keys: readonly string[];
}

export interface IContextKeyService {
  readonly onDidChangeContext: Event<ContextKeyChangeEvent>;
  setValue(key: string, value: ContextKeyValue | undefined): void;
  getValue(key: string): ContextKeyValue | undefined;
  matches(expression: ContextKeyExpression | undefined): boolean;
}

export const IContextKeyService = createServiceIdentifier<IContextKeyService>("contextKey");

export class ContextKeyService implements IContextKeyService {
  private readonly values = new Map<string, ContextKeyValue>();
  private readonly onDidChangeContextEmitter = new Emitter<ContextKeyChangeEvent>();

  readonly onDidChangeContext = this.onDidChangeContextEmitter.event;

  setValue(key: string, value: ContextKeyValue | undefined): void {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("Context key must not be empty");
    }

    const previousValue = this.values.get(normalizedKey);

    if (value === undefined) {
      if (!this.values.has(normalizedKey)) {
        return;
      }

      this.values.delete(normalizedKey);
      this.onDidChangeContextEmitter.fire({ keys: [normalizedKey] });
      return;
    }

    if (previousValue === value && this.values.has(normalizedKey)) {
      return;
    }

    this.values.set(normalizedKey, value);
    this.onDidChangeContextEmitter.fire({ keys: [normalizedKey] });
  }

  getValue(key: string): ContextKeyValue | undefined {
    return this.values.get(key);
  }

  matches(expression: ContextKeyExpression | undefined): boolean {
    return expression ? evaluateContextKeyExpression(expression, (key) => this.getValue(key)) : true;
  }
}

export const ContextKeyExpr = {
  defined(key: string): ContextKeyExpression {
    return { op: "defined", key };
  },
  equals(key: string, value: ContextKeyValue): ContextKeyExpression {
    return { op: "equals", key, value };
  },
  notEquals(key: string, value: ContextKeyValue): ContextKeyExpression {
    return { op: "notEquals", key, value };
  },
  not(expression: ContextKeyExpression): ContextKeyExpression {
    return { op: "not", expression };
  },
  and(...expressions: readonly ContextKeyExpression[]): ContextKeyExpression {
    return { op: "and", expressions };
  },
  or(...expressions: readonly ContextKeyExpression[]): ContextKeyExpression {
    return { op: "or", expressions };
  }
} as const;

export function parseContextKeyExpression(value: string): ContextKeyExpression | undefined {
  const tokens = tokenizeContextKeyExpression(value);

  if (tokens.length === 1 && tokens[0]?.type === "eof") {
    return undefined;
  }

  const parser = new ContextKeyExpressionParser(tokens);
  return parser.parse();
}

export function contextKeyExpressionKeys(expression: ContextKeyExpression | undefined): readonly string[] {
  if (!expression) {
    return [];
  }

  switch (expression.op) {
    case "defined":
    case "equals":
    case "notEquals":
      return [expression.key];
    case "not":
      return contextKeyExpressionKeys(expression.expression);
    case "and":
    case "or":
      return uniqueKeys(expression.expressions.flatMap(contextKeyExpressionKeys));
  }
}

function evaluateContextKeyExpression(
  expression: ContextKeyExpression,
  readValue: (key: string) => ContextKeyValue | undefined
): boolean {
  switch (expression.op) {
    case "defined":
      return readValue(expression.key) !== undefined;
    case "equals":
      return readValue(expression.key) === expression.value;
    case "notEquals":
      return readValue(expression.key) !== expression.value;
    case "not":
      return !evaluateContextKeyExpression(expression.expression, readValue);
    case "and":
      return expression.expressions.every((child) => evaluateContextKeyExpression(child, readValue));
    case "or":
      return expression.expressions.some((child) => evaluateContextKeyExpression(child, readValue));
  }
}

function uniqueKeys(keys: readonly string[]): readonly string[] {
  return [...new Set(keys)];
}

type ContextKeyToken =
  | { readonly type: "identifier"; readonly value: string }
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "number"; readonly value: number }
  | { readonly type: "boolean"; readonly value: boolean }
  | { readonly type: "null" }
  | { readonly type: "and" }
  | { readonly type: "or" }
  | { readonly type: "not" }
  | { readonly type: "equals" }
  | { readonly type: "notEquals" }
  | { readonly type: "leftParen" }
  | { readonly type: "rightParen" }
  | { readonly type: "eof" };

class ContextKeyExpressionParser {
  private index = 0;

  constructor(private readonly tokens: readonly ContextKeyToken[]) {}

  parse(): ContextKeyExpression {
    const expression = this.parseOr();
    this.expect("eof");
    return expression;
  }

  private parseOr(): ContextKeyExpression {
    const expressions = [this.parseAnd()];

    while (this.match("or")) {
      expressions.push(this.parseAnd());
    }

    return expressions.length === 1 ? expressions[0] as ContextKeyExpression : ContextKeyExpr.or(...expressions);
  }

  private parseAnd(): ContextKeyExpression {
    const expressions = [this.parseUnary()];

    while (this.match("and")) {
      expressions.push(this.parseUnary());
    }

    return expressions.length === 1 ? expressions[0] as ContextKeyExpression : ContextKeyExpr.and(...expressions);
  }

  private parseUnary(): ContextKeyExpression {
    if (this.match("not")) {
      return ContextKeyExpr.not(this.parseUnary());
    }

    if (this.match("leftParen")) {
      const expression = this.parseOr();
      this.expect("rightParen");
      return expression;
    }

    return this.parseComparison();
  }

  private parseComparison(): ContextKeyExpression {
    const key = this.expect("identifier").value;

    if (this.match("equals")) {
      return ContextKeyExpr.equals(key, this.parseValue());
    }

    if (this.match("notEquals")) {
      return ContextKeyExpr.notEquals(key, this.parseValue());
    }

    return ContextKeyExpr.equals(key, true);
  }

  private parseValue(): ContextKeyValue {
    const token = this.current();

    switch (token.type) {
      case "identifier":
      case "string":
      case "number":
      case "boolean":
        this.index += 1;
        return token.value;
      case "null":
        this.index += 1;
        return null;
      default:
        throw new Error(`Expected context key value but found ${token.type}`);
    }
  }

  private match(type: ContextKeyToken["type"]): boolean {
    if (this.current().type !== type) {
      return false;
    }

    this.index += 1;
    return true;
  }

  private expect<T extends ContextKeyToken["type"]>(type: T): Extract<ContextKeyToken, { readonly type: T }> {
    const token = this.current();

    if (token.type !== type) {
      throw new Error(`Expected ${type} but found ${token.type}`);
    }

    this.index += 1;
    return token as Extract<ContextKeyToken, { readonly type: T }>;
  }

  private current(): ContextKeyToken {
    return this.tokens[this.index] ?? { type: "eof" };
  }
}

function tokenizeContextKeyExpression(value: string): readonly ContextKeyToken[] {
  const tokens: ContextKeyToken[] = [];
  let index = 0;

  while (index < value.length) {
    const character = value[index] as string;

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (value.startsWith("&&", index)) {
      tokens.push({ type: "and" });
      index += 2;
      continue;
    }

    if (value.startsWith("||", index)) {
      tokens.push({ type: "or" });
      index += 2;
      continue;
    }

    if (value.startsWith("==", index)) {
      tokens.push({ type: "equals" });
      index += 2;
      continue;
    }

    if (value.startsWith("!=", index)) {
      tokens.push({ type: "notEquals" });
      index += 2;
      continue;
    }

    if (character === "!") {
      tokens.push({ type: "not" });
      index += 1;
      continue;
    }

    if (character === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }

    if (character === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }

    if (character === "\"" || character === "'") {
      const result = readQuotedString(value, index);
      tokens.push({ type: "string", value: result.value });
      index = result.nextIndex;
      continue;
    }

    if (isNumberStart(value, index)) {
      const result = readNumber(value, index);
      tokens.push({ type: "number", value: result.value });
      index = result.nextIndex;
      continue;
    }

    if (isIdentifierStart(character)) {
      const result = readIdentifier(value, index);
      tokens.push(createIdentifierToken(result.value));
      index = result.nextIndex;
      continue;
    }

    throw new Error(`Unexpected context key token: ${character}`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

function readQuotedString(value: string, startIndex: number): { readonly value: string; readonly nextIndex: number } {
  const quote = value[startIndex] as string;
  let index = startIndex + 1;
  let result = "";

  while (index < value.length) {
    const character = value[index] as string;

    if (character === quote) {
      return { value: result, nextIndex: index + 1 };
    }

    if (character === "\\") {
      const next = value[index + 1];

      if (next === undefined) {
        break;
      }

      result += next;
      index += 2;
      continue;
    }

    result += character;
    index += 1;
  }

  throw new Error("Unterminated context key string");
}

function readNumber(value: string, startIndex: number): { readonly value: number; readonly nextIndex: number } {
  const match = /^-?\d+(?:\.\d+)?/.exec(value.slice(startIndex));

  if (!match) {
    throw new Error("Invalid context key number");
  }

  return {
    value: Number(match[0]),
    nextIndex: startIndex + match[0].length
  };
}

function readIdentifier(value: string, startIndex: number): { readonly value: string; readonly nextIndex: number } {
  let index = startIndex + 1;

  while (index < value.length && isIdentifierPart(value[index] as string)) {
    index += 1;
  }

  return {
    value: value.slice(startIndex, index),
    nextIndex: index
  };
}

function createIdentifierToken(value: string): ContextKeyToken {
  switch (value) {
    case "true":
      return { type: "boolean", value: true };
    case "false":
      return { type: "boolean", value: false };
    case "null":
      return { type: "null" };
    default:
      return { type: "identifier", value };
  }
}

function isNumberStart(value: string, index: number): boolean {
  const character = value[index] as string;
  const next = value[index + 1];

  return /\d/.test(character) || (character === "-" && next !== undefined && /\d/.test(next));
}

function isIdentifierStart(character: string): boolean {
  return /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string): boolean {
  return /[A-Za-z0-9_.:-]/.test(character);
}
