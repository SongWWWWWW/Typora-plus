export type ServiceIdentifier<T> = symbol & { readonly __serviceType?: T };

export interface ServicesAccessor {
  get<T>(id: ServiceIdentifier<T>): T;
}

export function createServiceIdentifier<T>(description: string): ServiceIdentifier<T> {
  return Symbol.for(`typora-plus.service.${description}`) as ServiceIdentifier<T>;
}

export class ServiceCollection implements ServicesAccessor {
  private readonly services = new Map<ServiceIdentifier<unknown>, unknown>();

  set<T>(id: ServiceIdentifier<T>, instance: T): void {
    this.services.set(id, instance);
  }

  get<T>(id: ServiceIdentifier<T>): T {
    if (!this.services.has(id)) {
      throw new Error(`Missing service: ${String(id.description)}`);
    }

    return this.services.get(id) as T;
  }

  has<T>(id: ServiceIdentifier<T>): boolean {
    return this.services.has(id);
  }
}

export class InstantiationService {
  constructor(private readonly services: ServiceCollection) {}

  invokeFunction<R>(fn: (accessor: ServicesAccessor) => R): R {
    return fn(this.services);
  }
}
