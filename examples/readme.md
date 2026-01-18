# Example 1

Persisting events.

1. Creating events an memory.
2. Then storing them to a file.
3. Then opening an event store on the file.

Run: `deno run --allow-all example1.ts`

# Example 2

Simulating concurrent conflicting changes to an event store.

The conflicting change is detected during a conditional append.

Run: `deno run example2.ts`