import { Event, EventRecord } from '../../types.ts';


export class EventStream {
    public readonly eventRecords: EventRecord[] = [];
    private lastSequenceNumber:number = 0;

    append(events: Event[]): EventRecord[] {
        const eventRecords = events.map((e) => {
            return {
                sequenceNumber: ++this.lastSequenceNumber,
                timestamp: new Date(),
                eventType: e.eventType,
                payload: e.payload
            }
        })
        this.eventRecords.push(...eventRecords);
        return eventRecords;
    }

    serialize(): string {
        // Start with opening the JSON object and events array
        let result = '{ "events": [\n';
        
        // Serialize each event record separately
        const serializedEvents = this.eventRecords.map(record => {
            const serializedRecord = {
                ...record,
                timestamp: record.timestamp.toISOString()
            };
            return JSON.stringify(serializedRecord);
        });
        
        // Join events with comma and newline
        result += serializedEvents.join(',\n');
        
        // Close array and add lastSequenceNumber
        result += '\n],\n';
        result += `"lastSequenceNumber": ${this.lastSequenceNumber}\n}`;
        
        return result;
    }

    static deserialize(serialized: string): EventStream {
        const obj = JSON.parse(serialized);
        const eventStream = new EventStream();
        eventStream.lastSequenceNumber = obj.lastSequenceNumber;
        eventStream.eventRecords.push(...obj.events.map((record: any) => ({
            ...record,
            timestamp: new Date(record.timestamp)
        })));
        return eventStream;
    }
}
