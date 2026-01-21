import { MemoryEventStore, createFilter } from "https://raw.githubusercontent.com/ralfw/ccceventstores/main/src/mod.ts";

const es = new MemoryEventStore();

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

const student = {socialSecurityNumber: "", name: "", tuitionPaid: false};

context.events.forEach(e => {
    const payload = e.payload as { studentRegisteredID?: string, name?: string, amount?: number, scopes?: { studentRegisteredID: string }[] };
    if (e.eventType == "studenRegistered") {
        student.socialSecurityNumber = payload.socialSecurityNumber || "";   
        student.name = payload.name || "";
    } else if (e.eventType == "studenPaidTuition") {
            student.tuitionPaid = true;
    }
})

console.log(student)