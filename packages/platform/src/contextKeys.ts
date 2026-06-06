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
