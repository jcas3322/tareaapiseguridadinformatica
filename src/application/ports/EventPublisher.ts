/**
 * EventPublisher Port
 * Interface for publishing domain events
 */

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly eventData: Record<string, unknown>;
  readonly occurredAt: Date;
  readonly version: number;
}

export interface EventPublisher {
  /**
   * Publish a single domain event
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publish multiple domain events
   */
  publishMany(events: DomainEvent[]): Promise<void>;

  /**
   * Publish event with retry mechanism
   */
  publishWithRetry(event: DomainEvent, maxRetries?: number): Promise<void>;
}

export class DomainEventBuilder {
  private eventId?: string;
  private eventType?: string;
  private aggregateId?: string;
  private aggregateType?: string;
  private eventData?: Record<string, unknown>;
  private occurredAt?: Date;
  private version?: number;

  public setEventId(id: string): DomainEventBuilder {
    this.eventId = id;
    return this;
  }

  public setEventType(type: string): DomainEventBuilder {
    this.eventType = type;
    return this;
  }

  public setAggregateId(id: string): DomainEventBuilder {
    this.aggregateId = id;
    return this;
  }

  public setAggregateType(type: string): DomainEventBuilder {
    this.aggregateType = type;
    return this;
  }

  public setEventData(data: Record<string, unknown>): DomainEventBuilder {
    this.eventData = data;
    return this;
  }

  public setOccurredAt(date: Date): DomainEventBuilder {
    this.occurredAt = date;
    return this;
  }

  public setVersion(version: number): DomainEventBuilder {
    this.version = version;
    return this;
  }

  public build(): DomainEvent {
    if (!this.eventId) {
      throw new Error('Event ID is required');
    }

    if (!this.eventType) {
      throw new Error('Event type is required');
    }

    if (!this.aggregateId) {
      throw new Error('Aggregate ID is required');
    }

    if (!this.aggregateType) {
      throw new Error('Aggregate type is required');
    }

    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventData: this.eventData || {},
      occurredAt: this.occurredAt || new Date(),
      version: this.version || 1
    };
  }
}