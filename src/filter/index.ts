import { EventFilter, EventQuery } from '../types.ts';

export function createFilter(
  eventTypes: string[],
  payloadPredicates?: Record<string, unknown>[]
): EventFilter {
  return {
    eventTypes,
    ...(payloadPredicates && { payloadPredicates })
  };
}

export function createQuery(...filters: EventFilter[]): EventQuery {
  return { filters };
}