# Enquiry Repository Methods Design

**Date:** 2026-02-13
**Status:** Approved

## Overview

Add three new methods to the EnquiryRepository interface: `getByStatus`, `update`, and `delete`. These methods extend the existing repository pattern to support filtering by status, updating enquiries with automatic timestamp tracking, and removing enquiries from storage.

## Method Signatures

```typescript
export interface EnquiryRepository {
  // Existing methods
  put(enquiry: Enquiry): Promise<void>;
  getById(id: string): Promise<Enquiry | null>;
  listAll(): Promise<Enquiry[]>;

  // New methods
  getByStatus(status: Enquiry['status']): Promise<Enquiry[]>;
  update(enquiry: Enquiry): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Method Details

**getByStatus(status)**
- Takes a status string (enum value: "new", "viewed", "contacted", "converted", "archived")
- Returns array of matching enquiries
- Returns empty array if no matches found

**update(enquiry)**
- Takes full Enquiry object
- Automatically sets `updatedAt` field to current ISO timestamp
- Replaces entire record in storage
- Returns void (fire-and-forget like put)

**delete(id)**
- Takes enquiry ID string
- Removes enquiry from storage
- Returns void (no confirmation)

## Implementation Approach

### DynamoDB Implementation

**getByStatus:**
- Use ScanCommand with FilterExpression
- Filter expression: `"status = :status"`
- Expression attribute values: `{ ":status": status }`
- Return Items array or empty array

**update:**
- Clone enquiry object
- Set `updatedAt: new Date().toISOString()`
- Use PutCommand (same as existing put method)
- Overwrites entire item

**delete:**
- Import DeleteCommand from @aws-sdk/lib-dynamodb
- Use DeleteCommand with Key: { id }
- Fire-and-forget operation

### InMemory Implementation

**getByStatus:**
- Filter Map values by status field
- Return matching array

**update:**
- Clone enquiry object
- Set updatedAt timestamp
- Call store.set() with updated item

**delete:**
- Call store.delete(id)
- Return void

## Error Handling & Edge Cases

### Error Philosophy
- Match existing repository pattern
- No explicit error throwing
- Let AWS SDK errors bubble up naturally
- No existence validation before operations

### Edge Cases

1. **Invalid status in getByStatus**: Returns empty array (DynamoDB returns no results)
2. **Update non-existent item**: PutCommand creates it (standard DynamoDB behavior)
3. **Delete non-existent item**: Silently succeeds (idempotent operation)
4. **updatedAt field**: Auto-generated, caller's value ignored
5. **getByStatus performance**: Uses Scan (O(n)), acceptable for typical volumes, can add GSI later if needed

## Design Decisions

### Why Scan for getByStatus?
- Table has no GSI on status field
- Scan with filter is simplest implementation
- Works immediately without infrastructure changes
- Sufficient for typical enquiry volumes
- Can optimize with GSI later if needed

### Why Full Replacement for Update?
- Consistent with existing put() method
- Simpler than partial updates
- Clear semantics: caller provides complete state
- Automatic updatedAt timestamp ensures audit trail

### Why Hard Delete?
- Simple and clean
- No filtering needed elsewhere
- Status "archived" already exists for soft deletion use cases
- Consistent with fire-and-forget pattern

## Breaking Changes

None. Only additions to the interface. All existing code continues to work unchanged.

## Implementation Notes

- Both DynamoDB and InMemory implementations must stay in sync
- Import DeleteCommand in repository.ts
- No changes to DynamoDB table schema required
- No API route changes needed (can be added separately)
