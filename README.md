# Event Sourcing Made Simple and Easy

Event sourcing is a very straightforward concept. Or at least it can be, if it's not burdened with concepts from Domain Driven Design (DDD) or premature optimization. The notion of Aggregate or features like streams or tags are not necessary to understand and benefit from event sourcing.

The event stores in this repository are thus focused on the essential: recording and (selectively) replaying events while enforcing consistency when needed.

Currently only a Typescript in-memory event store is provided which is best used with Typescript on the Deno Runtime. But that should not stop you from getting to know the event sourcing paradigm for storing application state. Typescript is a great language - strongly typed, and still flexible - and vibe coding allows you to write Typescript code even if you're not familiar with the language.

And once you deem event sourcing worth applying in your domain on your tech stack, you'll find it easy to code your own event store and base it on a relational database like PostgreSQL. Yes, there is no need to make yourself dependent on yet another tool vendor. Relational databases are tried and true and blindlingly fast nowadays; they are a great match for event stores as their base storage engine on which the event store puts just a thin abstraction layer.

# Using the Event Store

## What is an Event?

An event signifies a change in the state of an application. It's a difference worth recording. The structure for each event is this:

```
interface Event {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}
```

The event store only knows about these two properties:

- a type which describes some meaning in the domain of the application
- a "blob" of data which you structure as you like

Here are two unrelated examples for events:

```
{ eventType:"taskAdded", payload:{ title: "go shopping", dueDate: "2026-01-26"}}
{ eventType:"gameStarted", payload:{ players: ["Peter", "Mary"] }}
```

This fixed, trivial structure makes it so easy to implement event stores on top of relational databases or document stores. Regardless of the domain the basic schema for storing its state always is the same.

But enough with the theory; here's how to actually use the event store:

## Importing the Event Store

First make the event store available with all the relevant types by importing it from this repository with this URL: `https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts`. The Deno runtime will get you all related modules in the background; it's really that easy. No separate installation steps needed.

Use the above URL for the latest version -- or reaplce "main" with a certain commit, e.g. `https://raw.githubusercontent.com/ralfw/ccceventstores/1e0f1a7/src/mod.ts` to not run into risk suffering breaking changes in future commits.

```
import { MemoryEventStore } from "https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts";

const es = new MemoryEventStore();
```

If you instantiate `MemoryEventStore` you'll get an in-memory event store implementing this interface:

```
export interface EventStore {
  query(filterCriteria: EventQuery): Promise<QueryResult>;
  query(filterCriteria: EventFilter): Promise<QueryResult>;

  append(events: Event[]): Promise<void>;
  append(events: Event[], filterCriteria: EventQuery, expectedMaxSequenceNumber: number): Promise<void>;
  append(events: Event[], filterCriteria: EventFilter, expectedMaxSequenceNumber: number): Promise<void>;
  
  subscribe(handle: HandleEvents): Promise<EventSubscription>;
}
```

The interface gives you the essential two functions to operate with the event sourcing paradigm:

- `append()` to record new events
- `query()` to replay recorded events

## Recording Events

To record an event, call one of the `append()` methods. It adds the event to the ever expanding event stream. All events are fixed in the event stream in chronological order. They are never changed, never deleted. The event stream never forgets.

```
import { MemoryEventStore } from "https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts";

const es = new MemoryEventStore();

await es.append([{ eventType:"taskAdded", payload:{ title: "go shopping", dueDate: "2026-01-26"}}]);
await es.append([{ eventType:"gameStarted", payload:{ players: ["Peter", "Mary"] }}])
```

Pass one or more events to `append()` at a time.

```
await es.append([
    { eventType:"taskAdded", payload:{ title: "go shopping", dueDate: "2026-01-26"}},
    { eventType:"gameStarted", payload:{ players: ["Peter", "Mary"] }}
]);
```

The event store will look like this afterwards:

```
{
  events: [
    {
      sequenceNumber: 1,
      timestamp: 2026-01-21T10:22:37.183Z,
      eventType: "taskAdded",
      payload: { title: "go shopping", dueDate: "2026-01-26" }
    },
    {
      sequenceNumber: 2,
      timestamp: 2026-01-21T10:22:37.183Z,
      eventType: "gameStarted",
      payload: { players: [ "Peter", "Mary" ] }
    }
  ],
  ...
}
```

As you see, some data has been added to the event.

- The `timestamp` tells when the event was recorded, but does not reliably order them.
- That's what the `sequenceNumber` does; it guarantees that all events are recorded in the order they where appended.

That's a peak under the hood. But you do not have access to these additional properties. They are purely for internal use. (And we even can argue about whether the timestamp really should be recorded. But it seemed so natural...)

The event store has one task: To record events in a strictly and unchangeable order. It does not care about what gets recorded. However, events have a meaning in the context of a domain, hence not only payloads get recorded, but also an event type.

## Replaying Events

Event stores are read/write. But there are limitations:

- The write is limited to only ever appending data.
- The read is limited to replaying events in chronological order; there is no random access.

The most simple way to get events from the event store is by replaying them all:

```
const result = await es.queryAll();

for(const e of result.events)
    console.log(e.eventType)
```

`queryAll()` is a method on the class `MemoryEventStore`, not in the interface. For an in-memory event store it was easy enough and seemed useful to provide such an easy access to all events. There probably won't be that many, since an in-memory event store will hardly be used in production.

On the general interface `EventStore`, though, replaying always requires specification of some selection criteria.

### Filtering

In reality you always are interested only in a subset of all events. That's what the `query()` interface methods are for.

A query is not an SQL-like string, though, there is no query language, but a hierarchy of structured filters.

A filter specifies a list of event types you're interested in and optionally a pattern for their payload. And a query is a collection of filters joined with a logical OR: *query = filter1 OR filter2 OR ...*

Let's add some events to an event store and query them:

```
import { MemoryEventStore, createFilter } from "https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts";

const es = new MemoryEventStore();

await es.append([{ eventType:"taskAdded", payload:{ title: "go shopping", description: "...", dueDate: "2026-01-26"}}]);
await es.append([{ eventType:"gameStarted", payload:{ players: ["Peter", "Mary"] }}])
await es.append([{ eventType:"taskAdded", payload:{ title: "write article", description: "...", dueDate: "2026-03-07"}}]);

const filter = createFilter(["taskAdded"]);

const result = await es.query(filter);

for(const e of result.events)
    console.log(e.payload.title)

```

Notice how `createFilter()` is now imported, too. That's the function to ensure a filter has the correct structure. In this example we're only asking for events of a particular type, "taskAdded".

The filter is passed to `query()` and only the first and last recorded events are retrieved.

If you put multiple event types into the filter they are combined with OR, e.g. `createFilter(["taskAdded", "gameStarted"])`. And if you do not provide any event types... all events are returned like with `queryAll()`.

If you want to further narrow down the events selected, you can describe the payload you're looking for:

```
const filter = createFilter(["taskAdded"], [{ title: "go shopping" }]);
```

If one of the events selected by type has a payload matching the provided pattern in the filter, it's included in the query result. Please notice: payload patterns are always compared for equality. You don't need to provide the full payload of an event, of course, just the part you're interested in for selection.

Multiple payload patterns are combined with OR.

The filter `createFilter(["et1", "et2"], [{p1: "vp1", px:"vpx"}, {p2: "vp2"}])` would thus translate to a SQL where clause like this: *(eventType="et1" OR eventType="et2) AND ((payload.p1="vp1" and payload.px="vpx") OR (payload.p2="vp2"))*

You can of course also query into array, e.g. `createFilter(["gameStarted"], [{players:["Mary"]}])` A filter payload pattern just needs to match an existing "path" inside a payload.

### Persising Events 

## Ensuring Consistency: Conditional Append

## Keeping Models Uptodate through Subscriptions

