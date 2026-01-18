// Collect input
const playernames = prompt("Player names?")?.split(",");

// Slice: command
import { MemoryEventStore, createFilter } from './deno.eventstore/index.ts';

const es = new MemoryEventStore();

const event = {
    eventType: "GameStarted",
    payload: {
        playernames
    }
}

await es.append([event]);



// Example setup
await es.append([
    {eventType:"TaskAdded", payload:{description:"Call Paul"}},
    {eventType:"TaskAdded", payload:{description:"Buy milk", assignee:"Peter"}},
    {eventType:"TaskAdded", payload:{description:"Buy eggs", assignee:"Mary"}},
]);


// Collect input
const assignee = prompt("Assignee?");

// Slice: query
const context = await es.query(createFilter(["TaskAdded"], [{assignee}]));

const contextModel = context.events.map(event => event.payload.description);
const result = {
    assignee,
    tasks: contextModel
}

// Project output
console.log(`${result.assignee}'s tasks:`)
for (const t of result.tasks) {
    console.log("- " + t);
}
