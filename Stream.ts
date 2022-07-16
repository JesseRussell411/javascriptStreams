import { and, or } from "./logic";
import { Streamable, StreamableArray, StreamableTuple } from "./Streamable";
import {
    lazy,
    iter,
    partialCopy,
    asArray,
    asSet,
    includes,
    join,
    isIterable,
    breakSignal,
    numberComparator,
    setAndGet,
    isArray,
    last,
    at,
    count,
    smartCompare,
    merge,
    DeLiterall as DeLiteral,
    SmartCompareOptions,
    EntryLike,
    EntryLikeValue,
    EntryLikeKey,
    asMap,
    toMap,
    isSet,
    isMap,
    multiCompare,
    Comparator,
    append,
    Order,
    reverseOrder,
    shuffled,
    prepend,
    range,
    generate,
} from "./utils";

function isSolid(collection: Iterable<any>): boolean {
    return (
        Array.isArray(collection) ||
        collection instanceof Set ||
        collection instanceof Map
    );
}

export default class Stream<T> implements Iterable<T>, Streamable<T> {
    protected readonly getSource: () => Iterable<T>;
    protected readonly sourceProperties: { oneOff?: true };

    public constructor(
        getSource: () => Iterable<T>,
        sourceProperties: { oneOff?: true } = {}
    ) {
        this.sourceProperties = sourceProperties;
        this.getSource = getSource;
    }

    public static empty<T>(): Stream<T> {
        return new Stream<T>(() => [], {});
    }

    public static of<T>(source: Iterable<T>) {
        return new Stream(() => source, {});
    }

    /** @returns A Stream of the collection from the given function. */
    public static from<T>(sourceGetter: () => Iterable<T>) {
        return new Stream(sourceGetter, {});
    }

    /** @returns A Stream of the generator from the given function. */
    public static iter<T>(generatorGetter: () => Generator<T>) {
        return new Stream(() => iter(generatorGetter), {});
    }

    public static range(
        start: bigint,
        end: bigint,
        step: bigint
    ): Stream<bigint>;
    public static range(start: bigint, end: bigint): Stream<bigint>;
    public static range(end: bigint): Stream<bigint>;

    public static range(
        start: number | bigint,
        end: number | bigint,
        step: number | bigint
    ): Stream<number>;
    public static range(
        start: number | bigint,
        end: number | bigint
    ): Stream<number>;
    public static range(end: number | bigint): Stream<number>;

    public static range(arg1: any, arg2?: any, arg3?: any): any {
        return Stream.of(range(arg1, arg2, arg3));
    }

    public static generate<T>(from: () => T, length: number | bigint) {
        return Stream.from(() => generate(from, length));
    }

    /** @returns An iterator over the Stream. */
    public [Symbol.iterator]() {
        return this.getSource()[Symbol.iterator]();
    }

    /**
     * Calls the callback on each value in the Stream. Like {@link Array.forEach}.
     * @param callback What to call for each value. If {@link breakSignal} is returned, iteration is stopped.
     * @returns The Stream.
     */
    public forEach(callback: (value: T, index: number) => Symbol | void): this {
        let index = 0;
        for (const value of this) {
            if (callback(value, index++) === breakSignal) break;
        }

        return this;
    }

    /** @returns A Stream of the given mapping from the original Stream. Like {@link Array.map}. */
    public map<R>(mapping: (value: T, index: number) => R): Stream<R> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) yield mapping(value, index++);
        });
    }

    /**
     * @returns A stream of the values that pass the filter. Like {@link Array.filter}.
     * @param filter Whether the given value passes the filter. Return true to include the value in the returned Stream and false to not include it.
     */
    public filter(filter: (value: T, index: number) => boolean): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) if (filter(value, index)) yield value;
        });
    }

    public repeat(times: number | bigint): Stream<T> {
        const usableTimes = BigInt(times);
        if (usableTimes < 0n) return this.reverse().repeat(-usableTimes);

        const self = this;
        return Stream.iter(function* () {
            for (let i = 0n; i < usableTimes; i++)
                for (const value of self) yield value;
        });
    }

    /**
     * Groups the values in the Stream by the given key selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K>(
        keySelector: (value: T, index: number) => K
    ): Stream<[K, StreamableArray<T>]> {
        return new Stream(
            () => {
                const groups = new Map<K, StreamableArray<T>>();

                let index = 0;
                for (const value of this) {
                    const key = keySelector(value, index++);

                    const group =
                        groups.get(key) ??
                        setAndGet(groups, key, new StreamableArray());

                    group.push(value);
                }

                return groups;
            },
            { oneOff: true }
        );
    }

    /**
     * An out-of-place sort of the values in the Stream bases on the given comparator. Like {@link Array.sort}.
     * @returns A Stream of the original Streams values sorted by the comparator.
     * @params comparator How to sort the values. If ommited, the values are sorted in ascending, ASCII order.
     */
    public sort(comparator?: (a: T, b: T) => number): Stream<T> {
        return Stream.from(() => {
            const sorted = this.toArray();
            sorted.sort(comparator);
            return sorted;
        });
    }

    public orderBy(comparator: Comparator<T>): OrderedStream<T>;
    public orderBy(parameter: (value: T) => any): OrderedStream<T>;
    public orderBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(
            this.getSource,
            [order],
            this.sourceProperties
        );
    }

    public orderByDescending(comparator: Comparator<T>): OrderedStream<T>;
    public orderByDescending(parameter: (value: T) => any): OrderedStream<T>;
    public orderByDescending(order: Order<T>): OrderedStream<T> {
        return this.orderBy(reverseOrder(order));
    }

    public order(): OrderedStream<T> {
        return this.orderBy(value => value);
    }

    public orderDescending(): OrderedStream<T> {
        return this.orderByDescending(value => value);
    }

    /**
     * Reverses the stream.
     * @returns A Stream of the original Stream in reverse order.
     */
    public reverse(): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const array = self.asArray();
            for (let i = array.length - 1; i >= 0; i--) yield array[i];
        });
    }

    /**
     * Takes the values in the start of the Stream that pass the given test. All values following and including the first value that does not pass the test are ommitted.
     * @param test Returns true if the value passes and false if it fails.
     * @returns A Stream over the first values in the original Stream that pass the given test.
     */
    public takeWhile(test: (value: T, index: number) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) {
                if (!test(value, index++)) break;
                yield value;
            }
        });
    }

    public skipWhile(test: (value: T, index: number) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) if (test(value, index++)) break;
            for (const value of self) yield value;
        });
    }

    public take(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().take(-count).reverse();
        return this.takeWhile((_, index) => index < usableCount);
    }

    public skip(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().skip(-count).reverse();
        return this.skipWhile((_, index) => index < usableCount);
    }

    public concat<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of self) yield value;
            for (const value of other) yield value;
        });
    }

    public unShift<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of other) yield value;
            for (const value of self) yield value;
        });
    }

    public distinct(identifier: (value: T) => any = value => value): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const returned = new Set<any>();
            for (const value of self) {
                const id = identifier(value);
                if (returned.has(id)) continue;
                yield value;
                returned.add(id);
            }
        });
    }

    public alternate(interval: number | bigint): Stream<T> {
        const usableInterval = BigInt(interval);

        const self = this;
        return Stream.iter(function* () {
            let i = 1;
            for (const value of self) {
                if (i++ >= usableInterval) {
                    i = 1;
                    yield value;
                }
            }
        });
    }

    public shuffle(): Stream<T> {
        return Stream.from(() => shuffled(this));
    }

    public append(value: T) {
        return Stream.from(() => append(this, value));
    }

    public prepend(value: T) {
        return Stream.from(() => prepend(this, value));
    }

    public with(needed: Iterable<T>): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const remainingNeeded = new Set(needed);
            for (const value of self) {
                remainingNeeded.delete(value);
                yield value;
            }

            for (const value of remainingNeeded) yield value;
        });
    }

    public without(remove: Iterable<T>): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            const setToRemove = asSet(remove);

            for (const value of self) if (!setToRemove.has(value)) yield value;
        });
    }

    public merge<O>(other: Iterable<O>): Stream<T | O> {
        return Stream.of(merge(this, other));
    }

    branch(): StreamableTuple<[]>;
    branch<A>(branchA: (Stream: Stream<T>) => A): StreamableTuple<[A]>;
    branch<A, B>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B
    ): StreamableTuple<[A, B]>;
    branch<A, B, C>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C
    ): StreamableTuple<[A, B, C]>;
    branch<A, B, C, D>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C,
        branchD: (Stream: Stream<T>) => D
    ): StreamableTuple<[A, B, C, D]>;
    branch<A, B, C, D, E>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C,
        branchD: (Stream: Stream<T>) => D,
        branchE: (Stream: Stream<T>) => E
    ): StreamableTuple<[A, B, C, D, E]>;
    branch<A, B, C, D, E, F>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C,
        branchD: (Stream: Stream<T>) => D,
        branchE: (Stream: Stream<T>) => E,
        branchF: (Stream: Stream<T>) => F
    ): StreamableTuple<[A, B, C, D, E, F]>;
    branch<A, B, C, D, E, F, G>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C,
        branchD: (Stream: Stream<T>) => D,
        branchE: (Stream: Stream<T>) => E,
        branchF: (Stream: Stream<T>) => F,
        branchG: (Stream: Stream<T>) => G
    ): StreamableTuple<[A, B, C, D, E, F, G]>;
    branch<A, B, C, D, E, F, G, H>(
        branchA: (Stream: Stream<T>) => A,
        branchB: (Stream: Stream<T>) => B,
        branchC: (Stream: Stream<T>) => C,
        branchD: (Stream: Stream<T>) => D,
        branchE: (Stream: Stream<T>) => E,
        branchF: (Stream: Stream<T>) => F,
        branchG: (Stream: Stream<T>) => G,
        branchH: (Stream: Stream<T>) => H
    ): StreamableTuple<[A, B, C, D, E, F, G, H]>;

    branch<R>(...branches: ((stream: Stream<T>) => R)[]): StreamableArray<R>;

    branch(...branches: ((stream: Stream<T>) => any)[]): StreamableArray<any> {
        const stream = this.stream();

        const results = new StreamableArray<any>();
        for (let i = 0; i < branches.length; i++) {
            results.push(branches[i](stream));
        }

        return results;
    }

    public defined(): Stream<T extends undefined ? never : T> {
        return this.filter(value => value !== undefined) as any;
    }

    public nonNull(): Stream<T extends null ? never : T> {
        return this.filter(value => value !== null) as any;
    }

    public undefined(): Stream<T extends undefined ? T : never> {
        return this.filter(value => value === undefined) as any;
    }

    public null(): Stream<T extends null ? T : never> {
        return this.filter(value => value === null) as any;
    }

    public nullableObjects(): Stream<T extends object | null ? T : never> {
        return this.filter(value => typeof value === "object") as any;
    }

    public objects(): Stream<T extends object ? T : never> {
        return this.filter(
            value => value !== null && typeof value === "object"
        ) as any;
    }

    public numbers(): Stream<T extends number ? T : never> {
        return this.filter(value => typeof value === "bigint") as any;
    }

    public bigints(): Stream<T extends bigint ? T : never> {
        return this.filter(value => typeof value === "bigint") as any;
    }

    public strings(): Stream<T extends string ? T : never> {
        return this.filter(value => typeof value === "string") as any;
    }

    public booleans(): Stream<T extends boolean ? T : never> {
        return this.filter(value => typeof value === "boolean") as any;
    }

    public functions(): Stream<T extends Function ? T : never> {
        return this.filter(
            value => typeof value === "function" || value instanceof Function
        ) as any;
    }

    public toArray(): T[] {
        const source = this.getSource();
        if (this.sourceProperties.oneOff && isArray(source)) return source;

        return [...source];
    }

    public toSet(): Set<T> {
        const source = this.getSource();
        if (this.sourceProperties.oneOff && isSet(source)) return source;

        return new Set(source);
    }

    public stream(): Stream<T> {
        const source = this.getSource();

        if (this.sourceProperties.oneOff && isSolid(source))
            return Stream.of(source);

        return Stream.of(this.toArray());
    }

    public asArray(): readonly T[] {
        return asArray(this.getSource());
    }

    public asSet(): ReadonlySet<T> {
        return asSet(this.getSource());
    }

    public asMap(): T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : never;

    public asMap<K>(
        keySelector: (value: T, index: number) => K
    ): T extends EntryLikeValue<infer V> ? ReadonlyMap<K, V> : never;

    public asMap<V>(
        keySelector: undefined,
        valueSelector: (value: T, index: number) => V
    ): T extends EntryLikeKey<infer K> ? ReadonlyMap<K, V> : never;

    public asMap<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): ReadonlyMap<K, V>;

    public asMap<K, V>(
        keySelector?: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => V
    ): ReadonlyMap<K, V> {
        return asMap(
            this.getSource(),
            keySelector as any,
            valueSelector as any
        );
    }

    public toMap(): T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : never;

    public toMap<K>(
        keySelector: (value: T, index: number) => K
    ): T extends EntryLikeValue<infer V> ? ReadonlyMap<K, V> : never;

    public toMap<V>(
        keySelector: undefined,
        valueSelector: (value: T, index: number) => V
    ): T extends EntryLikeKey<infer K> ? ReadonlyMap<K, V> : never;

    public toMap<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): ReadonlyMap<K, V>;

    public toMap<K, V>(
        keySelector?: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => V
    ): ReadonlyMap<K, V> {
        const source = this.getSource();
        if (this.sourceProperties.oneOff && source instanceof Map)
            return source;
        return toMap(source, keySelector as any, valueSelector as any);
    }

    public reduce(
        reduction: (
            previousResult: DeLiteral<T>,
            current: T,
            index: number
        ) => DeLiteral<T>
    ): DeLiteral<T> | undefined;

    public reduce<R>(
        reduction: (previousResult: R, current: T, index: number) => R,
        initialValue: R
    ): R;

    public reduce(
        reduction: (previousResult: any, current: T, index: number) => any,
        initialValue?: any
    ): any {
        const iterator = this[Symbol.iterator]();
        let next;
        let result;
        let index: number;

        if (arguments.length > 1) {
            result = initialValue;
            index = 0;
        } else {
            next = iterator.next();
            if (next.done) return undefined;
            result = next.value;
            index = 1;
        }

        while (!(next = iterator.next()).done) {
            result = reduction(result, next.value, index);
        }

        return result;
    }

    public includes(value: T): boolean {
        return includes(this.getSource(), value);
    }

    /** @returns Whether the Stream conains any value. */
    public some(): boolean;

    /** @returns Whether the stream contains any values that pass the given test. */
    public some(test: (value: T, index: number) => boolean): boolean;

    public some(
        test: (value: T, index: number) => boolean = () => true
    ): boolean {
        let index = 0;
        for (const value of this) if (test(value, index++)) return true;
        return false;
    }

    /** @returns Whether the Stream is empty. */
    public none(): boolean;
    /** @returns Whether none of the values in the stream pass the given test. */
    public none(test: (value: T, index: number) => boolean): boolean;
    public none(
        test: (value: T, index: number) => boolean = () => true
    ): boolean {
        return !this.some(test);
    }

    /** Whether all values in the Stream pass the given test. */
    public every(test: (value: T, index: number) => boolean): boolean {
        let index = 0;
        for (const value of this) if (!test(value, index++)) return false;
        return true;
    }

    public join(separator: string = ""): string {
        return join(this, separator);
    }

    public flat(): Stream<T extends Iterable<infer subT> ? subT : unknown> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of self) {
                if (isIterable(value))
                    for (const subValue of value) yield subValue;
                else yield value;
            }
        }) as any;
    }

    public find(test: (value: T, index: number) => boolean): T | undefined {
        let index = 0;
        for (const value of this) if (test(value, index++)) return value;
        return undefined;
    }

    public findIndex(
        test: (value: T, index: number) => boolean
    ): number | undefined {
        let index = 0;
        for (const value of this) {
            if (test(value, index)) return index;
            index++;
        }
        return undefined;
    }

    public indexOf(value: T): number | undefined {
        return this.findIndex(streamValue => Object.is(value, streamValue));
    }

    public first(): T | undefined {
        for (const value of this) return value;
        return undefined;
    }

    public last(): T | undefined {
        return last(this.getSource());
    }

    public at(index: number | bigint) {
        return at(this.getSource(), index);
    }

    public count(): number {
        return count(this.getSource());
    }

    public single(test: (value: T, index: number) => boolean): T {
        let result: T | undefined = undefined;
        let found = false;
        let index = 0;
        for (const value of this) {
            if (test(value, index++)) {
                if (found) throw new Error("More that one value found.");
                found = true;
                result = value;
            }
        }
        if (found) return result as T;
        throw new Error("No value found.");
    }

    public singleOrUndefined(
        test: (value: T, index: number) => boolean
    ): T | undefined {
        let result: T | undefined = undefined;
        let found = false;
        let index = 0;
        for (const value of this) {
            if (test(value, index++)) {
                if (found) return undefined;
                found = true;
                result = value;
            }
        }

        if (found) return result as T;
        return undefined;
    }
}

export class OrderedStream<T> extends Stream<T> {
    private readonly orderedBy: Comparator<T>[];

    public constructor(
        getSource: () => Iterable<T>,
        orderedBy: Iterable<Order<T>>,
        sourceProperties: { oneOff?: true } = {}
    ) {
        super(
            () => {
                const source = getSource();
                const sorted: T[] =
                    sourceProperties.oneOff && isArray(source)
                        ? source
                        : [...source];

                sorted.sort((a, b) => multiCompare(a, b, this.orderedBy));
                return sorted;
            },
            { oneOff: true }
        );
        this.orderedBy = [...orderedBy];
    }

    public static empty<T>(
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream<T>(() => [], orderedBy);
    }

    public static of<T>(
        source: Iterable<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(() => source ?? [], orderedBy);
    }

    public static from<T>(
        sourceGetter: () => Iterable<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(sourceGetter, orderedBy);
    }

    public static iter<T>(
        generatorGetter: () => Generator<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(() => generatorGetter(), orderedBy);
    }

    public thenBy(comparator: Comparator<T>): OrderedStream<T>;
    public thenBy(parameter: (value: T) => any): OrderedStream<T>;
    public thenBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(
            this.getSource,
            append(this.orderedBy, order),
            this.sourceProperties
        );
    }

    public thenByDescending(comparator: Comparator<T>): OrderedStream<T>;
    public thenByDescending(parameter: (value: T) => any): OrderedStream<T>;
    public thenByDescending(order: Order<T>): OrderedStream<T> {
        return this.thenBy(reverseOrder(order));
    }
}
