import { MemoryEventStore, createFilter } from './deno.eventstore/index.ts';

const es = new MemoryEventStore();

await es.append([
    {eventType:"AccountOpened", payload:{client:"Darlene", accountnumber:"123456"}},
    {eventType:"MoneyDeposited", payload:{amount:100, accountnumber:"123456"}}
]);

// Withdrawl #1 without any checks
await es.append([
    {eventType:"MoneyWithdrawn", payload:{amount:40, accountnumber:"123456"}} // 60 in account
]);

// Withdrawl #2 with check of funds
let amountToWithdraw = 10;

let context = await es.query(createFilter(["MoneyDeposited", "MoneyWithdrawn"], [{accountnumber:"123456"}]));
let contextModel = context.events.reduce((acc, event) => {
    if (event.eventType === "MoneyDeposited") {
        acc.balance += event.payload.amount as number;
    }
    if (event.eventType === "MoneyWithdrawn") {
        acc.balance -= event.payload.amount as number;
    }
    return acc;
}, {balance: 0});
if (contextModel.balance < amountToWithdraw)
    throw new Error("Not enough funds! #2")

await es.append([
    {eventType:"MoneyWithdrawn", payload:{amount:amountToWithdraw, accountnumber:"123456"}} // 50 in account
]);

// Withdrawl #3 with conditional append
amountToWithdraw = 40;

const contextFilter = createFilter(["MoneyDeposited", "MoneyWithdrawn"], [{accountnumber:"123456"}]);
context = await es.query(contextFilter);

// <<< concurrent successful withdrawl
await es.append([
    {eventType:"MoneyWithdrawn", payload:{amount:20, accountnumber:"123456"}}
]);
// >>>

contextModel = context.events.reduce((acc, event) => {
    if (event.eventType === "MoneyDeposited") {
        acc.balance += event.payload.amount as number;
    }
    if (event.eventType === "MoneyWithdrawn") {
        acc.balance -= event.payload.amount as number;
    }
    return acc;
}, {balance: 0});
if (contextModel.balance < amountToWithdraw)
    throw new Error("Not enough funds! #3")

await es.append([{eventType:"MoneyWithdrawn", payload:{amount:amountToWithdraw, accountnumber:"123456"}}], 
                contextFilter, context.maxSequenceNumber);