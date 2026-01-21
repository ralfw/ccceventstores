# Event Sourcing Made Simple and Easy

Event sourcing is a very straightforward concept. Or at least it can be, if it's not burdened with concepts from Domain Driven Design (DDD) or premature optimization. The notion of an *Aggregate* or features like streams or tags are not necessary to understand and benefit from event sourcing.

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

Event though the `MemoryEventStore` only keeps events in memory, there is a way to persist them and created a new event store from persisted events. This is intended to be primarily be used when starting and closing an application.

Storing events at any time is as easy as calling this function:


```
await es.storeToFile("events.json")
```

Creating an event store from such a file then is done with a factory method:

```
const es = await MemoryEventStore.createFromFile("events.json") // file needs to exist
```

If you want to tolerate a non-existing event stream file, pass `true` as the second parameter to `createFromFile()`:

```
const es = await MemoryEventStore.createFromFile("events.json", true) // file may not exist
```

#### Write-through Mode

Despite this event store being specifically build for in-memory use, in some cases (especially when experimenting with event sourcing) it's convenient to have persistence you don't need to think about. For a couple of hundred or thousand events it's no problem to simulate real, fine grained persistence by just persisting the whole event stream every time events get recorded.

This is achived by instantiating the event store in `write-through mode`:

```
const es = new MemoryEventStore("events.json");
```

No need to call `storeToFile()` on this event store. All events appended will already be saved to `events.json`.

In an application to start, stop, start again etc. you'd use the factory method, though. Get events stored during the last run right at the start. To ignore a missing file pass `true` as the first parameter, and to put the event store into *write-through mode* pass `true` as the second parameter:

```
const es = await MemoryEventStore.createFromFile("events.json", true, true)
```

## Ensuring Consistency: Conditional Append

Even an in-memory event store might be used in a concurrent manner. This might lead to inconsistent updates. Think of a bank account: you deposit money and you withdraw money; when withdrawing the money, the account balance must cover the amount.

Here are a couple of transactions:

```
const es = new MemoryEventStore();

console.log(await deposit(100));
console.log(await withdraw(20))
console.log(await deposit(50));
console.log(await withdraw(130)); // balance = 0
```

If all goes well, at the end the account balance is 0.

For a start, all the methods are very simple. `deposit()` and `withdraw()` just append the respective events. And `calcBalance()` retrieves them all to calculate the balance.

```
async function deposit(amount:number):Promise<number>
{
    await es.append([{eventType:"moneyDeposited", payload:{amount}}])
    return await calcBalance()
}

async function withdraw(amount:number):Promise<number> {
    await es.append([{eventType:"moneyWithdrawn", payload:{amount}}])
    return await calcBalance()
}

async function calcBalance():Promise<number> {
    const filter = createFilter(["moneyDeposited", "moneyWithdrawn"])
    const result = await es.query(filter);
    const balance = result.events.reduce((b, e) => {
        const payload = e.payload as { amount: number };

        if (e.eventType == "moneyDeposited")
            return b + payload.amount;
        else
            return b - payload.amount;
    }, 0);
    return balance;
}
```

At least for `withdraw()` this is naive, though. The function must not record as successful withdrawl if the current balance does not cover the amount.

The prudent thing thus would be to check for sufficient funds right at the start:

```
async function withdraw(amount:number):Promise<number> {
    const currentBalance = await calcBalance(); // (A)
    const futureBalance = currentBalance - amount;
    if (futureBalance < 0) throw new Error("Not enough funds!")

    await es.append([{eventType:"moneyWithdrawn", payload:{amount}}]) (B)
    
    return await calcBalance()
}
```

This works fine in general, i.e. while only a single thread works with the account.

But what if between (A) and (B) in the above code some other thread manages to withdraw money from the account? Then the initial condition at (A) might not be met anymore once the code gets to (B).

Here is a deterministic simulation of such a situation:

```
console.log(await deposit(100));
console.log(await withdraw(20))
console.log(await deposit(50));

// withdrawl 1 starting...
const amount1 = 130;
const currentBalance = await calcBalance();
const futureBalance = currentBalance - amount1;
if (futureBalance < 0) throw new Error("Not enough funds!")

    // withdrawl 2 happening in parallel
    const balance2 = await withdraw(1);
    console.log(`after withdrawl 2: ${balance2}`)

// withdrawl 1 finishing
await es.append([{eventType:"moneyWithdrawn", payload:{amount:amount1}}])

const balance1 = await calcBalance();

console.log(`after withdrawl 1: ${balance1}`);
```

A withdrawl is starting (1) and while it's being processed as second one (2) is rushing past it. The balance check of one has been done already, but when the first withdrawl wants to record the transaction's event the check is not valid anymore. The resulting account balance is negative.

This is the output of the code:

```
100
80
130
after withdrawl 2: 129
after withdrawl 1: -1
```

This can be avoided with a so called `conditional append`. This append only succeeds if a certain condition is met.

The relevant condition in this case is: does the query issued at the beginning still returns the same events? If that's the case, then the *context*  of the transaction is unchanged and the events can be written.

The context are the events relevant to assess if events should be written or not.

Here is the improved handling of such a situation:

```
const amount1 = 130;
const filter = createFilter(["moneyDeposited", "moneyWithdrawn"])
const context = await es.query(filter);
const currentBalance = context.events.reduce((b, e) => {
    const payload = e.payload as { amount: number };
    if (e.eventType == "moneyDeposited")
        return b + payload.amount;
    else
        return b - payload.amount;
}, 0);
const futureBalance = currentBalance - amount1;
if (futureBalance < 0) throw new Error("Not enough funds!")

    const balance2 = await withdraw(1);
    console.log(`after withdrawl 2: ${balance2}`)

await es.append([{eventType:"moneyWithdrawn", payload:{amount:amount1}}], 
                filter, context.maxSequenceNumber)

const balance1 = futureBalance
```

At the beginning a `filter` for the context is defined and applied during a `query()`. The resulting context events are projected into a single number: the current balance of the account. The future balance is calculated. If it's ok, an `append()` is attempted. But this time the initial `filter` is passed in after the event to record, as well as a `maxSequenceNumber`.

`append()` then executes the query again and checks if the `sequenceNumber` of the last retrieved event matches the `maxSequenceNumber` passed in. If so, all's well; the event stream hasn't been changed in a relevant way in the meantime. If there is a difference, though, something relevant has happened and the `append()` is aborted.

Both the filter check and recording the event happen in a transactional way. Even though it's again two operations on the event stream, no other call to append can get between them.

The new event is only appended under the condition of an event stream not changed in a relevant way. That's *conditional append*.

This leads to a change in how `withdraw()` is structured:

```
async function withdraw(amount:number):Promise<number> {
    const {balance, context} = await calcBalanceRaw()
    const futureBalance = balance - amount;
    if (futureBalance < 0) throw new Error("Not enough funds!")

    await es.append([{eventType:"moneyWithdrawn", payload:{amount:amount}}], 
                    context.filter, context.maxSequenceNumber)

    return futureBalance
}

async function calcBalance():Promise<number> {
    return (await calcBalanceRaw()).balance;
}

async function calcBalanceRaw():Promise<{balance:number, 
                                         context:{filter:EventFilter,
                                                  maxSequenceNumber:number}}> {
    const filter = createFilter(["moneyDeposited", "moneyWithdrawn"])
    const context = await es.query(filter);
    const balance = context.events.reduce((b, e) => {
        const payload = e.payload as { amount: number };
        if (e.eventType == "moneyDeposited")
            return b + payload.amount;
        else
            return b - payload.amount;
    }, 0);
    return {balance, context:{filter, maxSequenceNumber: context.maxSequenceNumber}};
}
```

It first retrieves the context and checks it, then tries a conditional append.

Since `withdraw()` and `calcBalance()` both do the same - calculating the balance -, a common function is extracted: `calcBalanceRaw()`. It does what `calcBalance()` did before, but also passes back the `filter` and the `maxSequenceNumber` which then can be used in the conditional append.

The general approach for conditional append is this:

1. Define context query.
2. Retrieve context using query.
3. Do, what's necessary with context and generate new events.
4. Call `append()` with new events and the initial query plus the `maxSequenceNumber` of the context.

This works very efficiently even with relational databases like PostgreSQL.

## Keeping Models Permanently Up-To-Date Through Subscriptions

*Documentation to come...*

## Identity and Scopes in Event Stores

So much for the documentationn of event store functionality. You're good to go. Give it a spin!

However... there are two problems addressed by other event store implementations through very specific features: the problem of the notorious DDD *Aggregate* and correlating events in general.

Both problems seem to not be related to event sourcing in particular. Hence the event store does not provide any specific features to address them. Nevertheless it can be assumed you want to hear what to do about them. They are so commonly discussed in the literature or on social media, this documentation would not be complete without mentioning them.

### Identity and Correlation

Identity comes up as soon as object-orientation enters the discussion. How to identify objets somehow persisted in an event store? There are no single entries for them like in a relational database.

There can be two answers to this:

1. If there is a natural ID for an object, by all means use it. Store it in all events relating to that object, if you like.
2. Do not rely on natural ID for identification and correlation. Instead assign events their own ID.

Here is an example for the first approach. See how the `socialSecurityNumber` is used to identify the student. It's repeated in every event pertaining to the student.

```
const es = new MemoryEventStore();

es.append([{eventType:"studenRegistered", payload:{socialSecurityNumber: "123", name:"John Doe"}}])
es.append([{eventType:"studenRegistered", payload:{socialSecurityNumber: "987", name:"Jane Doe"}}])
//...
es.append([{eventType:"studenPaidTuition", payload:{socialSecurityNumber: "123", amount: 1000}}])

const context = await es.query(createFilter(
                                ["studenRegistered", "studenPaidTuition"], 
                                [{socialSecurityNumber: "123"}]
))

const student = {socialSecurityNumber: "", name: "", tuitionPaid: false};

context.events.forEach(e => {
    const payload = e.payload as { socialSecurityNumber: string, name?: string, amount?: number };
    if (e.eventType == "studenRegistered") {
        student.socialSecurityNumber = payload.socialSecurityNumber;
        student.name = payload.name || "";
    } else if (e.eventType == "studenPaidTuition") {
        student.tuitionPaid = true;
    }
})

console.log(student)
```

This is a technically valid approach - but carries over the notion of objects into event sourcing. It's not congruent with the fundamentally different paradigm of event sourcing.

Event sourcing is about flexibility. Events are fine grained data, like sand, which can be modelled into all sorts of data structures. Tacking onto them an outside ID for keeping them together kind of works against it. It's suggests there is one superior model, the one represented by the outside ID. In DDD that's commonly called an *Aggregate* or *Entity*.

To fully embrance the event sourcing paradigm this thinking should be given up. Only then the inherent flexibility can be unleashed.

Here is an alternative approach:

- Each event gets an identifier (named like the event type + "ID"). If an event represents (the initial) state of an object, this event's ID will be used to link subsequent events to that object.
- Each event potentially opens a scope for other, correlated events. If subsequent belong to this scope, they reference the initial event by its event ID in `scopes` array of event IDs.

```
es.append([{eventType:"studenRegistered", payload:{studentRegisteredID: "abc", 
                                                   name:"John Doe", socialSecurityNumber: "123"}}])
es.append([{eventType:"studenRegistered", payload:{studentRegisteredID: "def", 
                                                   name:"Jane Doe", socialSecurityNumber: "987"}}])
//...
es.append([{eventType:"studenPaidTuition", payload:{studentPaidTuitionID: "ghi", 
                                                    amount: 1000, 
                                                    scopes:[{studentRegisteredID:"abc"}]}}])

const context = await es.query(createFilter(
                                ["studenRegistered", "studenPaidTuition"], 
                                [{studentRegisteredID: "abc"}, 
                                 {scopes:[{studentRegisteredID: "abc"}]}]
))
```

Both "studentRegistered" events are the initial events for all that belongs to a student's registration. Their IDs need to be remembered for reference by later events. The social security number is not used for that, but it is of course recorded as part of the student's data.

The "studentPaidTuition" event is related to the registration. It falls into its scope. That's why this event references the registration with its ID in the `scopes` section of the payload.

This makes the filter a little bit more complicated, because the scope root's event ID can appear in two places - as the root event's ID at the top level of the payload, and as a reference in the `scopes` array. But this is not that bad compared to the conceptual clarity that is gained.

No special features need to be implemented to correlated events. No foreign concepts leak into the event store implementation.