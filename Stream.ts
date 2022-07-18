import { and, or } from "./logic";
import { Streamable, StreamableArray, StreamableTuple } from "./streamable";
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
    DeLiteral as DeLiteral,
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
    shuffle,
    including,
    excluding,
    groupBy,
    groupJoin,
    getNonIteratedCountOrUndefined,
    intersection,
    random,
    ReadonlySolid,
    Solid,
    isSolid,
    asSolid,
    bigintComparator,
    alternate,
    getNonIteratedCount,
} from "./utils";

export interface StreamSourceProperties<T> {
    oneOff?: true;
    immutable?: true;
}
export type OrderedStreamSourceProperties<T> = StreamSourceProperties<T> & {};

export function stream<T>(...values: T[]): Stream<T> {
    return Stream.of(values);
}

export default class Stream<T> implements Iterable<T> {
    protected readonly getSource: () => Iterable<T>;
    protected readonly sourceProperties: StreamSourceProperties<T>;

    public constructor(
        getSource: () => Iterable<T>,
        sourceProperties: StreamSourceProperties<T> = {}
    ) {
        this.sourceProperties = sourceProperties;
        this.getSource = getSource;
        const asArrayBase = () => asArray(getSource());
        const asSetBase = () => asSet(getSource());
        const asMapParameterlessBase = () => asMap(getSource());
        if (this.sourceProperties.immutable) {
            this.asArray = lazy(asArrayBase);
            this.asSet = lazy(asSetBase);
            this.asMapParameterless = lazy(asMapParameterlessBase);
        } else {
            this.asArray = asArrayBase;
            this.asSet = asSetBase;
            this.asMapParameterless = asMapParameterlessBase;
        }
    }

    public static empty<T>(): Stream<T> {
        return new Stream<T>(() => [], { oneOff: true, immutable: true });
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
        return new Stream(() => range(arg1, arg2, arg3), { immutable: true });
    }

    public static generate<T>(from: () => T, length: number | bigint) {
        return Stream.of(generate(from, length));
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
        return new Stream(
            () =>
                iter(function* () {
                    const cache: T[] = [];

                    let i = 0n;
                    if (i < usableTimes) {
                        for (const value of self) {
                            cache.push(value);
                            yield value;
                        }
                        i++;
                        for (; i < usableTimes; i++)
                            for (const value of cache) yield value;
                    }
                }),
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Groups the values in the Stream by the given key selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K>(
        keySelector: (value: T, index: number) => K
    ): Stream<[K, StreamableArray<T>]>;
    public groupBy<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): Stream<[K, StreamableArray<V>]>;
    public groupBy<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => any = value => value
    ): Stream<[K, StreamableArray<T>]> {
        return new Stream(() => groupBy(this, keySelector, valueSelector), {
            oneOff: true,
        });
    }

    public groupJoin<I, K, R>(
        inner: Iterable<I>,
        keySelector: (value: T) => K,
        innerKeySelector: (value: I) => K,
        resultSelector: (outer: T, inner: Stream<I>) => R
    ): Stream<R> {
        return Stream.of(
            groupJoin(
                this,
                inner,
                keySelector,
                innerKeySelector,
                (inner, outer) =>
                    resultSelector(
                        inner,
                        new Stream(() => outer, { oneOff: true })
                    )
            )
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
        return new Stream(
            () =>
                iter(function* () {
                    const array = self.asArray();
                    for (let i = array.length - 1; i >= 0; i--) yield array[i];
                }),
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Iterates over the Stream, stopping at the first value to fail the test.
     */
    public takeWhile(test: (value: T, index: number) => boolean) {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    let index = 0;
                    for (const value of self) {
                        if (!test(value, index++)) break;
                        yield value;
                    }
                }),
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Iterates over the Stream, starting at the first value to fail the test.
     */
    public skipWhile(test: (value: T, index: number) => boolean) {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    let index = 0;
                    for (const value of self)
                        if (test(value, index++)) {
                            yield value;
                            break;
                        }

                    for (const value of self) yield value;
                }),
            { immutable: this.sourceProperties.immutable }
        );
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

    public insert<O>(other: Iterable<O>, at: number | bigint): Stream<T | O> {
        const usableAt = BigInt(at);
        if (usableAt < 0n)
            throw new Error(`at must be 0 or greater but ${at} was given`);
        const self = this;
        return Stream.iter(function* () {
            const iter = self[Symbol.iterator]();
            let next;

            for (let i = 0n; i < usableAt && !(next = iter.next()).done; i++)
                yield next.value;
            for (const value of other) yield value;
            while (!(next = iter.next()).done) yield next.value;
        });
    }

    public insertSingle(value: T, at: number | bigint) {
        const usableAt = BigInt(at);
        if (usableAt < 0n)
            throw new Error(`at must be 0 or greater but ${at} was given`);
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    const iter = self[Symbol.iterator]();
                    let next;

                    for (
                        let i = 0n;
                        i < usableAt && !(next = iter.next()).done;
                        i++
                    ) {
                        yield next.value;
                    }

                    yield value;

                    while (!(next = iter.next()).done) yield next.value;
                }),
            { immutable: this.sourceProperties.immutable }
        );
    }

    public unShift<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of other) yield value;
            for (const value of self) yield value;
        });
    }

    public distinct(identifier?: (value: T) => any): Stream<T> {
        const self = this;
        const usableIdentifier = identifier ?? (value => value);
        return new Stream(
            () =>
                iter(function* () {
                    const returned = new Set<any>();
                    for (const value of self) {
                        const id = usableIdentifier(value);
                        if (returned.has(id)) continue;
                        yield value;
                        returned.add(id);
                    }
                }),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    identifier === this.undefined
                        ? true
                        : undefined,
            }
        );
    }

    /**
     * Removes a number of values from the Stream.
     * @param start Where to start the removal.
     * @param deleteCount How many values to remvoe.
     */
    public splice(start: number | bigint, deleteCount: number | bigint) {
        const useableStart = BigInt(start);
        const useableDeleteCount = BigInt(start);
        if (useableStart < 0n) {
            return new Stream(
                () => {
                    const array = this.toArray();
                    array.splice(
                        array.length + Number(useableStart),
                        Number(useableDeleteCount)
                    );
                    return array;
                },
                { oneOff: true, immutable: this.sourceProperties.immutable }
            );
        }
        if (useableDeleteCount < 0n)
            throw new Error(
                `deleteCount must be 0 or greater but ${deleteCount} was given`
            );

        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    const iter = self[Symbol.iterator]();
                    let next;
                    for (
                        let i = 0n;
                        i < useableStart && !(next = iter.next()).done;
                        i++
                    )
                        yield next.value;

                    for (
                        let i = 0n;
                        i < useableDeleteCount && !(next = iter.next()).done;
                        i++
                    );

                    while (!(next = iter.next()).done) yield next.value;
                }),
            this.sourceProperties
        );
    }

    public alternate(interval: number | bigint = 2n): Stream<T> {
        return new Stream(
            () => alternate(this, interval),
            this.sourceProperties
        );
    }

    public takeSparse(count: number | bigint) {
        const usableCount = BigInt(count);
        if (count < 0)
            throw new Error(
                `count must be 0 or greater but ${count} was given`
            );
        if (count === 0) return Stream.empty<T>();
        const self = this;
        return new Stream(() => {
            const solid = this.asSolid();
            const count = getNonIteratedCount(solid);
            return alternate(solid, BigInt(count) / usableCount);
        }, this.sourceProperties);
    }

    public shuffle(): Stream<T> {
        return new Stream(
            () => {
                const array = this.toArray();
                shuffle(array);
                return array;
            },
            { oneOff: true }
        );
    }

    public append(value: T) {
        return new Stream(() => append(this, value), {
            immutable: this.sourceProperties.immutable,
        });
    }

    public prepend(value: T) {
        return new Stream(() => prepend(this, value), {
            immutable: this.sourceProperties.immutable,
        });
    }

    public with(needed: Iterable<T>): Stream<T> {
        return Stream.from(() => including(this, needed));
    }

    public without(remove: Iterable<T>): Stream<T> {
        return Stream.from(() => excluding(this, remove));
    }

    public merge<O>(other: Iterable<O>): Stream<T | O> {
        return Stream.of(merge(this, other));
    }

    public intersect(other: Iterable<T>): Stream<T> {
        return Stream.from(() => intersection(this.getSource(), other));
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
        if (this.sourceProperties.oneOff && Array.isArray(source))
            return source as T[];

        return [...source];
    }

    public toSet(): Set<T> {
        const source = this.getSource();
        if (this.sourceProperties.oneOff && source instanceof Set)
            return source as Set<T>;

        return new Set(source);
    }

    /**
     * Normally Streams are recalculated every time they are iterated in order to be consistent with the Stream's source. The method records the result of the stream and returns a new Stream of that recording. The returned stream no longer followws changes to the source of the original Stream and the original Stream won't be recalculated when the new Stream is iterated.
     */
    public solidify(): Stream<T> {
        const solid = this.asSolid();
        return new Stream(() => solid, { immutable: true });
    }

    public asArray: () => readonly T[];

    public asSet: () => ReadonlySet<T>;

    private asMapParameterless: () => T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? ReadonlyMap<unknown, V>
        : ReadonlyMap<unknown, unknown>;

    public asMap(): T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? ReadonlyMap<unknown, V>
        : ReadonlyMap<unknown, unknown>;

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
        if (keySelector === undefined && valueSelector === undefined)
            return this.asMapParameterless() as any;
        return asMap(
            this.getSource(),
            keySelector as any,
            valueSelector as any
        );
    }

    public asSolid(): ReadonlySolid<T> {
        const source = this.getSource();
        if (isArray(source)) return source;
        if (isSet(source)) return source;
        if (source instanceof Map) return source as any;
        return [...source];
    }

    public toMap(): T extends EntryLike<infer K, infer V>
        ? Map<K, V>
        : T extends EntryLikeKey<infer K>
        ? Map<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? Map<unknown, V>
        : Map<unknown, unknown>;

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

    private cache_toSolid: Solid<T> | undefined = undefined;
    public toSolid(): Solid<T> {
        const source = this.getSource();
        if (this.sourceProperties.oneOff) {
            if (Array.isArray(source)) return source;
            if (source instanceof Set) return source;
            if (source instanceof Map) return source as any;
        }
        if (this.sourceProperties.immutable) {
            if (this.cache_toSolid === undefined)
                this.cache_toSolid = [...source];
            return this.cache_toSolid;
        } else return [...source];
    }

    /**
     * Performs a reduction of the values in the Stream. Like {@link Array.reduce}.
     * @throws If The Stream is empty.
     */
    public reduce(
        reduction: (
            previousResult: DeLiteral<T>,
            current: T,
            index: number
        ) => DeLiteral<T>
    ): DeLiteral<T>;

    /**
     * Performs a reduction of the values in the Stream. Like {@link array.reduce}.
     */
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
            if (next.done)
                throw new Error("reduce of empty Stream with no initial value");
            result = next.value;
            index = 1;
        }

        while (!(next = iterator.next()).done) {
            result = reduction(result, next.value, index);
        }

        return result;
    }

    /** @returns Whether the stream contains the given value. */
    public includes(value: T): boolean {
        return includes(this.getSource(), value);
    }

    /** @returns Whether the Stream contains any values. */
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

    /**
     * Adds all the value in the Stream into a string, separated by the specified separator string. Like {@link Array.join}.
     * @param separator Put in between the values in the resulting string. Defaults to a comma (,).
     */
    public join(separator?: string): string {
        return join(this, separator);
    }

    /** Returns a Stream with sub-Stream elements concatenated into it. */
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

    /** @returns The first value to pass the test or undefined if one wasn't found. */
    public find(test: (value: T, index: number) => boolean): T | undefined {
        let index = 0;
        for (const value of this) if (test(value, index++)) return value;
        return undefined;
    }

    /** @returns The index of the first value to pass the test or undefined if one wasn't found. */
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

    /** @returns The first index of the given value or undefined if the value isn't found. */
    public indexOf(value: T): number | undefined {
        return this.findIndex(streamValue => Object.is(value, streamValue));
    }

    /** @returns The first value in the Stream or undefined if the Stream is empty. */
    public first(): T | undefined {
        for (const value of this) return value;
        return undefined;
    }

    /** @returns The last value in the Stream or undefined if the Stream is empty. */
    public last(): T | undefined {
        return last(this.getSource());
    }

    /**
     * @returns A random value from the Stream.
     * @throws If the Stream is empty.
     */
    public random(): T;

    /**
     * @returns A Stream of random values from the original Stream. If the original Stream is empty, an empty Stream is returned.
     * @param count The length of the Stream
     */
    public random(count: number | bigint): Stream<T>;

    public random(_count?: number | bigint): T | undefined | Stream<T> {
        const count = BigInt(_count ?? 1);
        if (count < 0)
            throw new Error(
                `count must be 0 or greater but ${_count} was given`
            );

        if (_count === undefined) {
            return random.choice(this.asSolid());
        } else {
            const self = this;
            return Stream.iter(function* () {
                const array = self.asArray();
                if (array.length === 0) return;
                for (let i = 0n; i < count; i++)
                    yield array[Math.trunc(Math.random() * array.length)];
            });
        }
    }

    /** @returns The value at the given index or the value at the given negative index from the end of the Stream (-1 returns the last value, -2 returns the second to last value, etc.).*/
    public at(index: number | bigint) {
        return at(this.getSource(), index);
    }

    /**
     * Counts how many value are in the Stream.
     * @returns The number of values in the Stream.
     * */
    public count(): number {
        return count(this.getSource());
    }

    /**
     * @returns The single item in the Stream that passes the given test.
     * @throws If no item passes the test or if more than one item passes the test.
     */
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

    /**
     * @returns The single item in the Stream that passes the given test or undefined if no items pass the test or if more than one item passes the test.
     */
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

    /**
     * Attempts to get the length of the Stream without iterating it.
     * @returns The Streams length or undefined if the length could not be found without iterating the Stream.
     */
    public getNonIteratedCountOrUndefined(): number | undefined {
        return getNonIteratedCountOrUndefined(this.getSource());
    }

    public then<R>(action: (stream: this) => R) {
        return action(this);
    }
}

/**
 * A {@link Stream} ordered by a collection of Comparators. Use {@link OrderedStream.thenBy} to add more comparators to sort by.
 */
export class OrderedStream<T> extends Stream<T> {
    protected readonly orderedBy: Iterable<Order<T>>;
    protected readonly originalGetSource: () => Iterable<T>;
    protected readonly sourceProperties: OrderedStreamSourceProperties<T>;

    public constructor(
        getSource: () => Iterable<T>,
        orderedBy: Iterable<Order<T>>,
        sourceProperties: OrderedStreamSourceProperties<T> = {}
    ) {
        super(
            () => {
                const source = getSource();
                const sorted: T[] =
                    sourceProperties.oneOff && Array.isArray(source)
                        ? (source as T[])
                        : [...source];

                sorted.sort((a, b) => multiCompare(a, b, orderedBy));
                return sorted;
            },
            { oneOff: true }
        );

        this.originalGetSource = getSource;
        this.orderedBy = orderedBy;
        this.sourceProperties = sourceProperties;
    }

    /**
     * @returns An empty OrderedStream of the given type and order.
     * @param orderedBy Describes the order of the returned Stream.
     */
    public static empty<T>(
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream<T>(() => [], [...orderedBy], {
            oneOff: true,
            immutable: true,
        });
    }

    /**
     * @returns An OrderedSteam of the given source and order.
     * @param orderedBy Described the order of the returned Stream.
     */
    public static of<T>(
        source: Iterable<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(() => source ?? [], [...orderedBy]);
    }

    /**
     * @returns A stream of the source from the given source-getter function. Note that the function will be called every time the Stream is iterated to generate a new source.
     * @param orderedBy Defines the order of the returned Stream.
     */
    public static from<T>(
        sourceGetter: () => Iterable<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(sourceGetter, [...orderedBy]);
    }

    public static iter<T>(
        generatorGetter: () => Generator<T>,
        orderedBy: Iterable<Order<T>> = []
    ): OrderedStream<T> {
        return new OrderedStream(() => generatorGetter(), [...orderedBy]);
    }

    public thenBy(comparator: Comparator<T>): OrderedStream<T>;
    public thenBy(parameter: (value: T) => any): OrderedStream<T>;
    public thenBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            [...this.orderedBy, order],
            this.sourceProperties
        );
    }

    public thenByDescending(comparator: Comparator<T>): OrderedStream<T>;
    public thenByDescending(parameter: (value: T) => any): OrderedStream<T>;
    public thenByDescending(order: Order<T>): OrderedStream<T> {
        return this.thenBy(reverseOrder(order));
    }
}
