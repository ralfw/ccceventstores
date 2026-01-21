import { MemoryEventStore, createFilter } from "https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts";
import { EventFilter, QueryResult } from "../src/mod.ts";

const es = new MemoryEventStore();

console.log(await deposit(100));
console.log(await withdraw(20))
console.log(await deposit(50));
console.log(await withdraw(130))


async function deposit(amount:number):Promise<number> {
    await es.append([{eventType:"moneyDeposited", payload:{amount}}])
    return await calcBalance()
}

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