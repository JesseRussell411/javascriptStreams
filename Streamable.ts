import Stream from "./Stream";
import { ValueOf } from "./utils";

export interface Streamable<T> {
    stream: () => Stream<T>;
}

export type StreamableTuple<T extends any[]> = T & StreamableArray<ValueOf<T>>;

export class StreamableArray<T> extends Array<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.of(this);
    }
}

export class StreamableSet<T> extends Set<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.of(this);
    }
}

export class StreamableMap<K, V>
    extends Map<K, V>
    implements Streamable<[K, V]>
{
    public stream(): Stream<[K, V]> {
        return Stream.of(this);
    }
}
