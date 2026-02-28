# Hexagonal Architecture (DDD)

## Overview

Server-side features use a Domain-Driven Design pattern with hexagonal architecture. The core principle: **inner layers never depend on outer layers**.

## Layer Structure

```
<feature>/
├── domain/                 # Inner layer - pure business logic
│   ├── entities/           # Domain entities with behavior
│   ├── repositories/       # Repository INTERFACES (ports)
│   └── types.ts            # Domain-specific types
├── application/            # Middle layer - orchestration
│   ├── dto/                # Request/Response DTOs (data transfer objects)
│   └── use-cases/          # One class per business operation
└── infrastructure/         # Outer layer - external dependencies
    └── persistence/        # Repository IMPLEMENTATIONS (adapters)
```

## Dependency Rule

```
Infrastructure -> Application -> Domain
     (depends on)    (depends on)
```

- **Domain** knows nothing about Application or Infrastructure
- **Application** knows about Domain, but not Infrastructure
- **Infrastructure** knows about both (implements domain interfaces)

## Domain Layer

Contains pure business logic. No framework imports, no Supabase, no HTTP concerns.

**Entities** encapsulate data + behavior:
```typescript
// domain/entities/SpreadsheetRow.ts
export class SpreadsheetRow {
  private constructor(private props: SpreadsheetRowProps) {}

  toInvoiceItem(): InvoiceItem {
    // Domain logic - converts row to invoice format
  }
}
```

**Repository interfaces** define the contract (ports):
```typescript
// domain/repositories/SpreadsheetRepository.ts
export interface SpreadsheetRepository {
  findById(id: string): Promise<Spreadsheet | null>
  save(spreadsheet: Spreadsheet): Promise<void>
  delete(id: string): Promise<void>
}
```

## Application Layer

Use cases orchestrate domain logic. They receive repository interfaces via constructor (dependency injection).

```typescript
// application/use-cases/CreateSpreadsheet.ts
export class CreateSpreadsheet {
  constructor(private repository: SpreadsheetRepository) {}

  async execute(request: CreateSpreadsheetRequest): Promise<SpreadsheetResponse> {
    // Validate input via DTO
    // Create domain entity
    // Persist via repository
    // Return response DTO
  }
}
```

**DTOs** separate the API boundary from domain entities:
```typescript
// application/dto/SpreadsheetRequest.ts
export interface CreateSpreadsheetRequest {
  name: string
  headerData: Record<string, string>
  rows: SpreadsheetRowRequest[]
}
```

## Infrastructure Layer

Implements repository interfaces with actual database access. This is the **only layer** that knows about Supabase.

```typescript
// persistence/SupabaseSpreadsheetRepository.ts
export class SupabaseSpreadsheetRepository implements SpreadsheetRepository {
  async findById(id: string): Promise<Spreadsheet | null> {
    const { data } = await supabase.from('spreadsheets').select('*').eq('id', id)
    // Map DB row to domain entity
  }
}
```

## Canonical Example

See `src/server/spreadsheets/` for a complete implementation of this pattern.
