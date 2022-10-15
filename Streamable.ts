import Stream from "./Stream";
import { ValueOfArray } from "./utils";

export interface Streamable<T> {
    stream: () => Stream<T>;
}

export type StreamableTuple<T extends readonly any[] | any[]> = T &
    StreamableArray<ValueOfArray<T>>;

export class StreamableArray<T> extends Array<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.from(this);
    }
}

export class StreamableSet<T> extends Set<T> implements Streamable<T> {
    public stream(): Stream<T> {
        return Stream.from(this);
    }
}

export class StreamableMap<K, V>
    extends Map<K, V>
    implements Streamable<[K, V]>
{
    public stream(): Stream<[K, V]> {
        return Stream.from(this);
    }
}