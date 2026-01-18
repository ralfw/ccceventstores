import { MemoryEventStore, createFilter } from '../src/mod.ts';

const es = await MemoryEventStore.createFromFile("events.json", true, true)
await es.append([{eventType:"e1", payload:{message:"hello"}}])
await es.append([{eventType:"e1", payload:{message:"world!"}}])
await es.append([{eventType:"e2", payload:{amount:99}}])

const context = await es.query(createFilter(["e1"]));

for (const event of context.events) {
  console.log(event.eventType, event.payload);
}

console.log("reading from events.json");
const es2 = await MemoryEventStore.createFromFile("events.json", false, true) // write-thru mode
const context2 = await es2.query(createFilter(["e1"]));
for (const event of context2.events) {
  console.log(event.eventType, event.payload);
}
await es2.append([{eventType:"e1", payload:{message:"good bye"}}])
