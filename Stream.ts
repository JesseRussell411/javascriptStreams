import now from "./javascriptStopwatch/now";
import { and, or } from "./logic";
import {
    takeAlternating,
    skipAlternating,
    append,
    asArray,
    asMap,
    AsMap,
    AsMapWithKey,
    AsMapWithValue,
    asSet,
    asSolid,
    at,
    atOrDefault,
    Comparator,
    count,
    DeLiteral,
    distinct,
    eager,
    zipperMerge,
    filter,
    generate,
    getNonIteratedCount,
    getNonIteratedCountOrUndefined,
    groupBy,
    groupJoin,
    includes,
    intersection,
    IsBigIntLiteral,
    isIterable,
    isMap,
    IsNumberLiteral,
    isSolid,
    IsStringLiteral,
    iter,
    join,
    last,
    lastOrDefault,
    lastOrUndefined,
    lazyCacheIterable,
    leftJoin,
    looseMerge,
    map,
    merge,
    mkString,
    multiCompare,
    Order,
    random,
    range,
    ReadonlySolid,
    reduce,
    reduceAndFinalize,
    ReduceAndFinalizeInfo,
    requireInteger,
    require0OrGreater,
    reverseOrder,
    shuffle,
    skip,
    skipRandom,
    skipRandomToArray,
    skipSparse,
    skipWhile,
    smartCompare,
    Solid,
    split,
    take,
    takeRandom,
    takeSparse,
    takeWhile,
    toMap,
    ToMap,
    ToMapWithKey,
    ToMapWithValue,
    ToObject,
    toObject,
    ToObjectWithKey,
    ToObjectWithValue,
    TupleOfLength,
    looseZipperMerge,
    isSet,
    concat,
    Replace,
    flat,
    Flat,
    ValueOf,
    lazy,
    getAllPropertyEntries,
    getOwnPropertyEntries,
    KeySelector,
    max,
    min,
} from "./utils";

// TODO maybe? rename to sequence or pipeline or river or creek or flow or drain or plumbing or stupid or Enumerable or iteration or enumeration or assemblyLine or conveyerBelt or relay or line or construction or structuredIteration or dataModel or flow or dataFlow or Fly or Fling or transformation or translation or shift or alteration or transmute or transition or conversion or morph or tabulation or beam or quiter (query-able iterable)

/** Properties of a Stream's source. */
export interface StreamSourceProperties<T> {
    /** Whether the Iterable from {@link Stream.getSource} is a new instance every time that can be modified safely. */
    readonly fresh?: boolean;
    /** Whether the values in the Iterable from {@link Stream.getSource} will never change. Note that this doesn't mean the values themselves can't be mutable (like if the values are object, they can have mutable fields), it just means that the values can't be swapped out with other values, can't be re-arranged, or removed and values cannot be added into the source. Essentially, the source can't change but the values in the source can. */
    readonly immutable?: boolean;
    /** How many values are in the Iterable from {@link Stream.getSource}. */
    readonly count?: number;
}

//TODO DOCS
export type ValueOfStream<S extends Stream<any>> = S extends Stream<infer T>
    ? T
    : never;

//TODO DOCS
export function isStream<T>(collection: Iterable<T>): collection is Stream<T> {
    return collection instanceof Stream;
}

//TODO DOCS
export function asStream<T>(collection: Iterable<T>): Stream<T> {
    if (isStream(collection)) {
        return collection;
    } else {
        return Stream.from(collection);
    }
}

// TODO docs
export default class Stream<T> implements Iterable<T> {
    /** Returns the Source Iterable that the Stream is over. */
    protected readonly getSource: () => Iterable<T>;
    /** Properties of the Source. */
    protected readonly sourceProperties: StreamSourceProperties<T>;

    /** @returns The total count of the stream and collection if it can be found without iterating either or undefined if it can't. */
    protected static totalNonIteratedCountOrUndefined(
        stream: Stream<any>,
        collection: Iterable<any>
    ): number | undefined {
        const otherCount = getNonIteratedCountOrUndefined(collection);

        if (
            stream.sourceProperties.count !== undefined &&
            otherCount !== undefined
        )
            return stream.sourceProperties.count + otherCount;
        else return undefined;
    }

    // TODO  docs
    protected static addCountOrUndefined(
        stream: Stream<any>,
        addition: number
    ): number | undefined {
        if (stream.sourceProperties.count !== undefined)
            return stream.sourceProperties.count + addition;
        else return undefined;
    }

    protected static getSource<T>(maybeStream: Iterable<T>): Iterable<T> {
        if (maybeStream instanceof Stream) {
            return maybeStream.getSource();
        } else {
            return maybeStream;
        }
    }

    public constructor(
        getSource: () => Iterable<T>,
        sourceProperties: StreamSourceProperties<T> = {}
    ) {
        this.sourceProperties = sourceProperties;
        this.getSource = getSource;
    }

    /** @returns An empty Stream of the given type. */
    public static empty<T = never>(): Stream<T> {
        return new Stream<T>(() => [], {
            fresh: true,
            immutable: true,
            count: 0,
        });
    }

    /** @return A Stream of the given values. */
    public static of<T = never>(...values: T[]) {
        return new Stream(() => values, {
            immutable: true,
            count: values.length,
        });
    }

    /** @returns A Stream of the given collection or an empty Stream if undefined is given. */
    public static from<T>(
        source: Iterable<T> | (() => Iterable<T>) | undefined
    ) {
        if (source === undefined) return Stream.empty<T>();

        if (typeof source === "function") {
            return new Stream(source, {});
        } else {
            return new Stream(eager(source ?? []));
        }
    }

    //TODO docs
    public static fromObject<K extends keyof any, V>(
        source: Record<K, V> | (() => Record<K, V>)
    ): Stream<[Replace<K, number, string>, V]> {
        if (typeof source === "function") {
            return new Stream(() => getOwnPropertyEntries(source()), {
                fresh: true,
            });
        } else {
            return new Stream(() => getOwnPropertyEntries(source), {
                fresh: true,
            });
        }
    }

    //TODO DOCS
    public static fromObjectHierarchy(
        source: (any & {}) | (() => any & {})
    ): Stream<[string | symbol, unknown]> {
        if (typeof source === "function") {
            return new Stream(() => getAllPropertyEntries(source()), {
                fresh: true,
            });
        } else {
            return new Stream(() => getAllPropertyEntries(source), {
                fresh: true,
            });
        }
    }

    /** @returns A Stream of the generator from the given function. */
    public static iter<T>(generatorGetter: () => Generator<T>) {
        return new Stream(() => iter(generatorGetter), {});
    }

    /**
     * Creates a new Stream of {@link BigInt}s from the start (inclusive) to the end (exclusive) on the given step size.
     * @param start The number to start on (inclusive)
     * @param end The number to end on (exclusive, stops before this number)
     * @param step The interval size.
     */
    public static range(
        start: bigint,
        end: bigint,
        step: bigint
    ): Stream<bigint>;
    /**
     * Creates a new Stream of {@link BigInt}s from the start (inclusive) to the end (exclusive) on the interval size of 1.
     * @param start The number to start on (inclusive)
     * @param end The number to end on (exclusive, stops before this number)
     */
    public static range(start: bigint, end: bigint): Stream<bigint>;
    /**
     * Creates a new Stream of {@link BigInt}s from the 1 (inclusive) to the end (exclusive) on the interval size of 1.
     * @param end The number to end on (exclusive, stops before this number)
     */
    public static range(end: bigint): Stream<bigint>;

    /**
     * Creates a new Stream of {@link Number}s from the start (inclusive) to the end (exclusive) on the interval size of 1.
     * @param start The number to start on (inclusive)
     * @param end The number to end on (exclusive, stops before this number)
     */
    public static range(
        start: number | bigint,
        end: number | bigint,
        step: number | bigint
    ): Stream<number>;

    /**
     * Creates a new Stream of {@link Number}s from the start (inclusive) to the end (exclusive) on the interval size of 1.
     * @param start The number to start on (inclusive)
     * @param end The number to end on (exclusive, stops before this number)
     */
    public static range(
        start: number | bigint,
        end: number | bigint
    ): Stream<number>;
    /**
     * Creates a new Stream of {@link Number}s from the 1 (inclusive) to the end (exclusive) on the interval size of 1.
     * @param end The number to end on (exclusive, stops before this number)
     */
    public static range(end: number | bigint): Stream<number>;

    public static range(_startOrEnd: any, _end?: any, _step?: any): any {
        return new Stream(() => range(_startOrEnd, _end, _step), {
            immutable: true,
        });
    }

    /** Generate a new Stream from the given generator function. */
    public static generate<T>(
        from: (index: number) => T,
        length: number | bigint
    ) {
        requireInteger(require0OrGreater(length));
        return new Stream(() => generate(from, length), {
            count: Number(length),
        });
    }

    /** @returns An iterator over the Stream. */
    public [Symbol.iterator]() {
        return this.getSource()[Symbol.iterator]();
    }

    /**
     * Calls the callback on each value in the Stream. Like {@link Array.forEach}.
     * @param callback What to call for each value. If {@link Stream.breakSignal} is returned, iteration is stopped.
     * @returns The Stream for chaining purposes.
     */
    public forEach(callback: (value: T, index: number) => Symbol | void): this {
        let i = 0;
        for (const value of this.getSource()) {
            if (callback(value, i++) === Stream.breakSignal) break;
        }
        return this;
    }

    /**
     * Signals for a {@link Stream.forEach} loop to stop.
     */
    public static breakSignal: Symbol = Symbol("Stream break signal");

    /**
     * @param mapping The mapping function. Not guarantied to be run for every value in the Stream if not necessary.
     * @returns A Stream of the given mapping from the original Stream. Like {@link Array.map}.
     */
    public map<R>(mapping: (value: T, index: number) => R): Stream<R> {
        return new MappedStream(
            this.getSource,
            [mapping],
            this.sourceProperties
        );
    }

    /**
     * @returns A stream of tuples containing the original stream's values following the value's index: [index, value].
     */
    public withIndex(): Stream<[number, T]> {
        return this.map((t, i) => [i, t]);
    }

    /**
     * @returns A stream of the values that pass the filter. Like {@link Array.filter}.
     * @param test Whether the given value passes the filter. Return true to include the value in the returned Stream and false to not include it.
     */
    public filter(test: (value: T, index: number) => boolean): Stream<T> {
        return new FilteredStream(
            this.getSource,
            [test],
            this.sourceProperties
        );
    }

    /**
     * Filters the stream to values of the specified type. Use {@link TypeFilteredStream.and} to add more constraints.
     */
    public filterTo<Option extends TypeFilterOption>(
        option: Option
    ): TypeFilteredStream<T, TypeFilterTest<Option, T>, Option> {
        return new TypeFilteredStream(
            this.getSource,
            [getTypeFilterTest(option)],
            this.sourceProperties
        );
    }

    /**
     * Filters the stream to values that aren't of the specified type. Use {@link TypeFilteredOutStream.and} to add more constraints.
     */
    public filterOut<Option extends TypeFilterOption>(
        option: Option
    ): TypeFilteredOutStream<T, TypeFilterOutTest<Option, T>, Option> {
        return new TypeFilteredOutStream(
            this.getSource,
            [getTypeFilterTest(option)],
            this.sourceProperties
        );
    }

    /**
     * Repeats the Stream the given number of times.
     * @param times How many times to repeat the Stream. If negative, the stream is reversed and then repeated.
     */
    public repeat(times: number | bigint): Stream<T> {
        requireInteger(times);

        const usableTimes = BigInt(times);
        if (usableTimes < 0n) return this.reverse().repeat(-usableTimes);
        if (usableTimes === 0n) return Stream.empty<T>();

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
                        for (; i < usableTimes; i++) yield* cache;
                    }
                }),
            {
                immutable: this.sourceProperties.immutable,
                count:
                    this.sourceProperties.count !== undefined
                        ? this.sourceProperties.count * Number(usableTimes)
                        : undefined,
            }
        );
    }

    /**
     * Groups the values in the Stream by the given key selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K>(
        keySelector: (value: T, index: number) => K
    ): Stream<[K, T[]]>;

    /**
     * Groups the values in the Stream by the given key selector and then applying a mapping to the values using the value selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @param valueSelector The mapping to apply to the values after the grouping.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): Stream<[K, V[]]>;

    // TODO DOCS
    public groupBy<K, V, G>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V,
        groupSelector: (group: V[], key: K, index: number) => G
    ): Stream<[K, G]>;

    // TODO DOCS
    public groupBy<K, G>(
        keySelector: (value: T, index: number) => K,
        valueSelector: undefined,
        groupSelector: (group: T[], key: K, index: number) => G
    ): Stream<[K, G]>;

    public groupBy<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => any,
        groupSelector?: (group: any[], key: K, index: number) => any
    ): Stream<[K, any]> {
        return new Stream(
            () =>
                (groupBy as Function)(
                    this.getSource(),
                    keySelector,
                    valueSelector,
                    groupSelector
                ),
            {
                fresh: true,
            }
        );
    }

    // TODO docs
    public indexBy<K>(
        keySelector: (value: T, index: number) => K
    ): Stream<[K, T]>;

    //TODO DOCS
    public indexBy<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): Stream<[K, V]>;

    public indexBy<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => any = v => v
    ): Stream<[K, any]> {
        return new Stream(
            () => {
                const index = new Map<K, T>();

                let i = 0;
                for (const value of this) {
                    const key = keySelector(value, i);
                    if (!index.has(key)) {
                        index.set(key, valueSelector(value, i));
                    }
                    i++;
                }

                return index;
            },
            { fresh: true }
        );
    }

    // TODO write documentation for this.
    public groupJoin<I, K, R>(
        inner: Iterable<I>,
        keySelector: (value: T) => K,
        innerKeySelector: (value: I) => K,
        resultSelector: (outer: T, inner: I[]) => R,
        comparison?: (outer: T, inner: I) => boolean
    ): Stream<R> {
        return new Stream(() =>
            groupJoin(
                this.getSource(),
                Stream.getSource(inner),
                keySelector,
                innerKeySelector,
                resultSelector,
                comparison
            )
        );
    }

    //TODO docs
    public join<I, K, R>(
        inner: Iterable<I>,
        keySelector: (value: T) => K,
        innerKeySelector: (value: I) => K,
        resultSelector: (outer: T, inner: I) => R,
        comparison?: (outer: T, inner: I) => boolean
    ): Stream<R> {
        return new Stream(() =>
            join(
                this.getSource(),
                Stream.getSource(inner),
                keySelector,
                innerKeySelector,
                resultSelector,
                comparison
            )
        );
    }

    //TODO docs
    public leftJoin<Right, Key, Result>(
        right: Iterable<Right>,
        keySelector: (left: T) => Key,
        rightKeySelector: (right: Right) => Key,
        resultSelector: ((left: T, right: Right) => Result) &
            ((left: T) => Result),
        comparison?: (left: T, right: Right) => boolean
    ): Stream<Result> {
        return new Stream(() =>
            leftJoin(
                this.getSource(),
                Stream.getSource(right),
                keySelector,
                rightKeySelector,
                resultSelector,
                comparison
            )
        );
    }

    /**
     * Sorts the Stream from least to greatest using the given comparator function.
     */
    public orderBy(comparator: Comparator<T>): OrderedStream<T>;
    /**
     * Sorts the Stream from least to greatest based on the key from the given key selector function. Comparison is done by {@link smartCompare}.
     */
    public orderBy(keySelector: (value: T) => any): OrderedStream<T>;

    public orderBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(this.getSource, [order], {
            count: this.sourceProperties.count,
        });
    }

    /**
     * Sorts the Stream from greatest to least using the given comparator function.
     */
    public orderByDescending(comparator: Comparator<T>): OrderedStream<T>;
    /**
     * Sorts the Stream from greatest to least based on the key from the given key selector function. Comparison is done by {@link smartCompare}.
     */
    public orderByDescending(keySelector: (value: T) => any): OrderedStream<T>;

    public orderByDescending(order: Order<T>): OrderedStream<T> {
        return this.orderBy(reverseOrder(order));
    }

    /**
     * Sorts the Stream from least to greatest. Comparison is done by {@link smartCompare}.
     */
    public order(): OrderedStream<T> {
        return this.orderBy(value => value);
    }

    /**
     * Sorts the Stream from greatest to least. Comparison is done by {@link smartCompare}.
     */
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
                    for (let i = array.length - 1; i >= 0; i--)
                        yield array[i] as T;
                }),
            {
                immutable: this.sourceProperties.immutable,
                count: this.sourceProperties.count,
            }
        );
    }

    // TODO add some kind of randomizer seed parameter
    /** @returns A Stream over the original Stream in random order. */
    public shuffle(): Stream<T> {
        return new Stream(
            () => {
                const array = this.toArray();
                shuffle(array);
                return array;
            },
            { fresh: true, count: this.sourceProperties.count }
        );
    }

    /**
     * Skips every n value in the Stream.
     * @param interval The interval on which to skip. Defaults to 2.
     */
    public skipAlternating(interval: number | bigint = 2n): Stream<T> {
        return new Stream(() => skipAlternating(this.getSource(), interval), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Skips a specified number of values in the Stream, spread out from the start to the end.
     * @param count How many values to skip.
     * @returns A Stream of values spread out across the original Stream.
     */
    public skipSparse(count: number | bigint): Stream<T> {
        return new Stream(() => skipSparse(this.getSource(), count), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Iterates over the Stream, starting at the first value to fail the test.
     */
    public skipWhile(test: (value: T, index: number) => boolean) {
        return new Stream(() => skipWhile(this.getSource(), test));
    }

    /**
     * Skips a number of random values in the Stream. The values to be skipped are essentially taken without replacement. The same item is never skipped twice.
     */
    public skipRandom(count: number | bigint): Stream<T> {
        return new Stream(() => skipRandomToArray(this.getSource(), count), {
            fresh: true,
        });
    }

    /**
     * Skips a number of values from the start of the Stream.
     */
    public skip(count: number | bigint): Stream<T> {
        return new Stream(() => skip(this.getSource(), count), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Takes every n value in the Stream.
     * @param interval The interval on which to take. Defaults to 2.
     */
    public takeAlternating(interval: number | bigint = 2n): Stream<T> {
        return new Stream(() => takeAlternating(this.getSource(), interval), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Takes a specified number of values from the Stream, spread out from the start to the end.
     * @param count How many values to take from the Stream.
     * @returns A Stream of values spread out across the original Stream.
     */
    public takeSparse(count: number | bigint): Stream<T> {
        return new Stream(() => takeSparse(this.getSource(), count), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Iterates over the Stream, stopping at the first value to fail the test.
     */
    public takeWhile(test: (value: T, index: number) => boolean) {
        return new Stream(() => takeWhile(this.getSource(), test));
    }

    /**
     * Takes a number of random values from the Stream. The values to be taken are essentially taken without replacement. The same item is never taken twice.
     */
    public takeRandom(count: number | bigint): Stream<T> {
        requireInteger(require0OrGreater(count));
        return this.shuffle().take(count);
    }

    /**
     * Takes a number of values from the start of the Stream.
     */
    public take(count: number | bigint): Stream<T> {
        return new Stream(() => take(this.getSource(), count), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Concatenates the Iterable to the end of the Stream. Similar to {@link Array.push} and {@link Array.concat}.
     */
    public concat<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    yield* self;
                    yield* other;
                }),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
                count: Stream.totalNonIteratedCountOrUndefined(this, other),
            }
        );
    }

    /**
     * Concatenates the Iterable to the start of the Stream. Similar to {@link Array.unshift}.
     */
    public unshift<O>(other: Iterable<O>): Stream<T | O> {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    yield* other;
                    yield* self;
                }),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
                count: Stream.totalNonIteratedCountOrUndefined(this, other),
            }
        );
    }

    /**
     * Inserts the Iterable at the given index.
     * @param other What to insert.
     * @param at Where to insert. Must be 0 or greater.
     */
    public insertAll<O>(
        other: Iterable<O>,
        at: number | bigint
    ): Stream<T | O> {
        requireInteger(require0OrGreater(at));
        const usableAt = BigInt(at);
        // TODO add upper bound.

        const self = this;
        return new Stream(
            eager(
                iter(function* () {
                    const iter = self[Symbol.iterator]();
                    let next;

                    for (
                        let i = 0n;
                        i < usableAt && !(next = iter.next()).done;
                        i++
                    )
                        yield next.value;

                    yield* other;
                    while (!(next = iter.next()).done) yield next.value;
                })
            ),
            {
                immutable:
                    other instanceof Stream &&
                    this.sourceProperties.immutable &&
                    other.sourceProperties.immutable,
                count: Stream.totalNonIteratedCountOrUndefined(this, other),
            }
        );
    }

    /**
     * Removes a number of values from the Stream. Similar to {@link Array.splice}.
     * @param start Where to start the removal.
     * @param deleteCount How many values to remove.
     */
    public remove(start: number | bigint, deleteCount: number | bigint = 1) {
        requireInteger(require0OrGreater(start));
        requireInteger(require0OrGreater(deleteCount));

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
                { fresh: true, immutable: this.sourceProperties.immutable }
            );
        }

        const self = this;
        return new Stream<T>(
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
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Inserts the value into the Stream at the given index.
     * @param value What to insert.
     * @param at Where to insert. Must be 0 or greater.
     */
    public insert(value: T, at: number | bigint) {
        //TODO add upper bound
        //TODO insert from end if it is negative
        requireInteger(require0OrGreater(at));

        const usableAt = BigInt(at);
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
            {
                immutable: this.sourceProperties.immutable,
                count: Stream.addCountOrUndefined(this, 1),
            }
        );
    }

    /**
     * Appends the value to the end of the Stream.
     */
    public append(value: T) {
        return new Stream(() => append(this.getSource(), value), {
            immutable: this.sourceProperties.immutable,
            count: Stream.addCountOrUndefined(this, 1),
        });
    }

    /**
     * Appends the value to the start of the Stream.
     */
    public prepend(value: T) {
        return new Stream(() => append(this.getSource(), value), {
            immutable: this.sourceProperties.immutable,
            count: Stream.addCountOrUndefined(this, 1),
        });
    }

    /**
     * Removes all the values found in the given Iterable from the Stream. Essentially performing a difference operation between the Stream and the given Iterable.
     * @param other What not to include in the returned stream.
     * @returns A Stream of all the values in the original Stream that are not found in the given Iterable (essentially original Stream - given Iterable).
     */
    public difference(other: Iterable<any>): Stream<T> {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    const setOfExcluding = asSet(other);
                    for (const value of self.getSource()) {
                        if (!setOfExcluding.has(value)) yield value;
                    }
                }),
            {
                immutable:
                    other instanceof Stream &&
                    this.sourceProperties.immutable &&
                    other.sourceProperties.immutable,
            }
        );
    }

    /**
     * Appends the values from the given Iterable to the end of the Stream if they aren't already in the Stream. Essentially performing a union operation between the Stream and the given Iterable.
     * @param needed
     * @returns
     */
    public union<O>(needed: Iterable<O>): Stream<T | O> {
        const self = this;
        return new Stream(
            () =>
                iter(function* () {
                    const remaining = new Set<T | O>(needed);
                    for (const value of self.getSource()) {
                        remaining.delete(value);
                        yield value;
                    }

                    yield* remaining;
                }),
            {
                immutable:
                    needed instanceof Stream &&
                    this.sourceProperties.immutable &&
                    needed.sourceProperties.immutable,
            }
        );
    }

    /** Keeps only the values that are in both the Stream and the given Iterable */
    public intersection(other: Iterable<T>): Stream<T> {
        return new Stream(
            () => intersection(this.getSource(), Stream.getSource(other)),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
            }
        );
    }

    //TODO DOCS
    public without(value: any): Stream<T> {
        return new Stream(
            () => {
                const source = this.getSource();
                if (isSet(source) && !source.has(value)) {
                    return source;
                } else {
                    return iter(function* () {
                        for (const sourceValue of source) {
                            if (!Object.is(value, sourceValue)) {
                                yield sourceValue;
                            }
                        }
                    });
                }
            },
            { immutable: this.sourceProperties.immutable }
        );
    }

    //TODO DOcs
    public with<O>(value: O): Stream<T | O> {
        return new Stream(
            () => {
                const source = this.getSource();
                if (isSet(source) && (source as Set<T | O>).has(value)) {
                    return source;
                } else {
                    return iter(function* () {
                        let found = false;
                        for (const sourceValue of source) {
                            if (!found && Object.is(value, sourceValue)) {
                                found = true;
                            }
                            yield sourceValue;
                        }
                        if (!found) yield value;
                    });
                }
            },
            { immutable: this.sourceProperties.immutable }
        ) as any;
    }

    /**
     * Removes duplicated values from the Stream.
     */
    public distinct(identifier?: (value: T) => any): Stream<T> {
        return new Stream(() => distinct(this.getSource(), identifier), {
            immutable:
                this.sourceProperties.immutable && identifier === undefined
                    ? true
                    : undefined,
        });
    }

    // TODO docs
    public looseMerge<O>(
        other: Iterable<O>
    ): Stream<[T | undefined, O | undefined]>;
    // TODO docs

    public looseMerge<O, R>(
        other: Iterable<O>,
        merger: (t: T | undefined, o: O | undefined) => R
    ): Stream<R>;

    public looseMerge<O>(
        other: Iterable<O>,
        merger: (t: T | undefined, o: O | undefined) => any = (t, o) => [t, o]
    ): Stream<any> {
        const otherCount = getNonIteratedCountOrUndefined(other);
        return new Stream(
            () => looseMerge(this.getSource(), Stream.getSource(other), merger),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
                count:
                    this.sourceProperties.count !== undefined &&
                    otherCount !== undefined
                        ? Math.max(this.sourceProperties.count, otherCount)
                        : undefined,
            }
        );
    }

    // TODO docs
    public merge<O>(other: Iterable<O>): Stream<[T, O]>;

    // TODO docs
    public merge<O, R>(
        other: Iterable<O>,
        merger: (t: T, o: O) => R
    ): Stream<R>;

    public merge<O>(
        other: Iterable<O>,
        merger: (t: T, o: O) => any = (t, o) => [t, o]
    ): Stream<any> {
        const otherCount = getNonIteratedCountOrUndefined(other);
        return new Stream(
            () => merge(this.getSource(), Stream.getSource(other), merger),
            {
                immutable:
                    other instanceof Stream &&
                    this.sourceProperties.immutable &&
                    other.sourceProperties.immutable,
                count:
                    this.sourceProperties.count !== undefined &&
                    otherCount !== undefined
                        ? Math.min(this.sourceProperties.count, otherCount)
                        : undefined,
            }
        );
    }

    /** Performs a zipper merge with the given Iterable. */
    public looseZipperMerge<O>(other: Iterable<O>): Stream<T | O> {
        const otherCount = getNonIteratedCountOrUndefined(other);
        return new Stream(
            () => looseZipperMerge(this.getSource(), Stream.getSource(other)),
            {
                immutable:
                    other instanceof Stream &&
                    this.sourceProperties.immutable &&
                    other.sourceProperties.immutable,
                count:
                    this.sourceProperties.count !== undefined &&
                    otherCount !== undefined
                        ? this.sourceProperties.count + otherCount
                        : undefined,
            }
        );
    }

    // TODO docs
    public zipperMerge<O>(other: Iterable<O>): Stream<T | O> {
        return new Stream(
            () => zipperMerge(this.getSource(), Stream.getSource(other)),
            {
                immutable:
                    other instanceof Stream &&
                    this.sourceProperties.immutable &&
                    other.sourceProperties.immutable,
            }
        );
    }

    /** Keeps only the values in the Stream that aren't undefined. For more advanced type filtering try {@link filterTo} and {@link filterOut}. */
    public defined(): FilteredStream<T, T extends undefined ? never : T> {
        return this.filterOut("undefined");
    }

    /** Keeps only the values in the Stream that aren't null. For more advanced type filtering try {@link filterTo} and {@link filterOut}. */
    public nonNull(): FilteredStream<T, T extends null ? never : T> {
        return this.filterOut("null");
    }

    /** Does the same thing as {@link Array.copyWithin} but of course it doesn't modify the original source. */
    public copyWithin(
        target: number | bigint,
        start: number | bigint,
        end: number | bigint | undefined
    ): Stream<T> {
        const usableTarget = Number(target);
        const usableStart = Number(start);
        const usableEnd = end === undefined ? undefined : Number(end);

        return new Stream(
            () => {
                return this.toArray().copyWithin(
                    usableTarget,
                    usableStart,
                    usableEnd
                );
            },
            { fresh: true, immutable: this.sourceProperties.immutable }
        );
    }

    // TODO docs
    public split(deliminator: Iterable<any>): Stream<T[]> {
        return new Stream(() => split(this.getSource(), deliminator), {
            immutable:
                (this.sourceProperties.immutable &&
                    typeof deliminator === "string") ||
                (deliminator instanceof Stream &&
                    deliminator.sourceProperties.immutable),
        });
    }

    /**
     * Breaks the stream into partitions of the given size.
     *
     * @param size Must be a whole number of 1 or greater. How big to make the partitions. Note that the last partition will be smaller than this if the Stream runs out of items before it can be completely filled.
     */
    public partition<S extends number | bigint>(
        size: S
    ): Stream<TupleOfLength<S, T>> {
        require0OrGreater(requireInteger(size));

        if (size <= 0 || size <= 0n)
            throw new Error("size must be greater than 0");

        const self = this;
        return Stream.iter(function* () {
            const iterator = self.getSource()[Symbol.iterator]();
            let next: IteratorResult<T> = iterator.next();

            while (!next.done) {
                const partition: T[] = [];
                for (let count = 0n; count < size; count++) {
                    if (next.done) break;
                    partition.push(next.value);
                    next = iterator.next();
                }

                yield partition;
            }
        }) as any;
    }

    /**
     *  Returns a Stream with sub-Iterable elements (to the given depth) concatenated into it.
     */
    public flat<D extends number>(depth: D): Stream<ValueOf<Flat<this, D>>>;
    /**
     * Returns a Stream with sub-Iterable elements concatenated into it.
     */
    public flat(): Stream<ValueOf<Flat<this, 1>>>;
    public flat(depth: number = 1): Stream<any> {
        return new Stream<any>(() => flat(this.getSource(), depth), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Normally Streams are recalculated every iteration in order to stay consistent with the Stream's source. This method records the result of the stream and returns a new Stream of that recording. The returned Stream no longer follows changes to the original source and iterating the new Stream doesn't iterate the original Stream.
     *
     * The copy of the Stream is made at call time. For lazy execution use {@link cached}.
     */
    public cache(): Stream<T> {
        const solid = this.toSolid();
        return new Stream(() => solid, {
            immutable: true,
            count: getNonIteratedCount(solid),
        });
    }

    /** Lazy version of {@link cache}. The Stream is copied on the first iteration of the result which is cached for later iterations. */
    public cached(): Stream<T> {
        return new Stream(
            lazy(() => [...this.getSource()]),
            {
                immutable: true,
            }
        );
    }

    /**
     * Copies the Stream into an Array. The Array is safe to modify.
     *
     * If the Array does not need to be modifiable, consider using {@link Stream.asArray} instead.
     */
    public toArray(): T[] {
        const source = this.getSource();
        if (this.sourceProperties.fresh && Array.isArray(source)) return source;

        return [...source];
    }

    /**
     * Copies the Stream into a Set. The Set is safe to modify.
     *
     * If the Set does not need to be modifiable, consider using {@link Stream.asSet} instead.
     */
    public toSet(): Set<T> {
        const source = this.getSource();
        if (this.sourceProperties.fresh && source instanceof Set) return source;

        return new Set(source);
    }

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     */
    public toMap(): ToMap<Iterable<T>>;

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public toMap<K>(
        keySelector: (value: T, index: number) => K
    ): ToMapWithKey<Iterable<T>, K>;

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public toMap<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector: undefined
    ): ToMapWithKey<Iterable<T>, K>;

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     * @param keySelector
     * @param valueSelector Selects the map's values from the values in the Stream.
     */
    public toMap<V>(
        keySelector: undefined,
        valueSelector: (value: T, index: number) => V
    ): ToMapWithValue<Iterable<T>, V>;

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     * @param valueSelector Selects the map's values from the values in the Stream.
     */
    public toMap<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): ReadonlyMap<K, V>;

    public toMap<K, V>(
        keySelector?: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => V
    ): Map<unknown, unknown> {
        const source = this.getSource();
        if (
            this.sourceProperties.fresh &&
            isMap(source) &&
            keySelector === undefined &&
            valueSelector === undefined
        ) {
            return source;
        } else {
            return (toMap as Function)(source, keySelector, valueSelector);
        }
    }

    // TODO DOCS
    public toObject(): ToObject<Iterable<T>>;

    // TODO DOCS
    public toObject<K extends keyof any>(
        keySelector: (value: T, index: number) => K
    ): ToObjectWithKey<Iterable<T>, K>;

    // TODO DOCS
    public toObject<K extends keyof any>(
        keySelector: (value: T, index: number) => K,
        valueSelector: undefined
    ): ToObjectWithKey<Iterable<T>, K>;

    // TODO DOCS
    public toObject<V>(
        keySelector: undefined,
        valueSelector: (value: T, index: number) => V
    ): ToObjectWithValue<Iterable<T>, V>;

    // TODO DOCS
    public toObject<K extends keyof any, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): Record<K, V>;

    public toObject<K extends keyof any, V>(
        keySelector?: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => V
    ): Record<K, V> {
        return (toObject as Function)(
            this.getSource(),
            keySelector,
            valueSelector
        );
    }

    // TODO docs
    public toSolid(): Solid<T> {
        const source = this.getSource();
        if (this.sourceProperties.fresh && isSolid(source)) return source;
        else return [...source];
    }

    private cache_asArray?: readonly T[];
    /**
     * Provides a readonly Array of the contents of the Stream. If the Array needs to be modifiable consider using {@link Stream.toArray} instead.
     */
    public asArray(): readonly T[] {
        if (this.sourceProperties.immutable) {
            if (this.cache_asArray === undefined)
                this.cache_asArray = asArray(this.getSource());
            return this.cache_asArray;
        } else {
            return asArray(this.getSource());
        }
    }

    private cache_asSet?: ReadonlySet<T>;
    /**
     * Provides a readonly Set of the contents of the Stream. If the Set needs to be modifiable consider using {@link Stream.toSet} instead.
     */
    public asSet(): ReadonlySet<T> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asSet === undefined)
                this.cache_asSet = asSet(this.getSource());
            return this.cache_asSet;
        } else {
            return asSet(this.getSource());
        }
    }

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     */
    public asMap(): AsMap<Iterable<T>>;

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public asMap<K>(
        keySelector: (value: T, index: number) => K
    ): AsMapWithKey<Iterable<T>, K>;

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public asMap<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector: undefined
    ): AsMapWithKey<Iterable<T>, K>;

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     * @param keySelector
     * @param valueSelector Selects the map's values from the values in the Stream.
     */
    public asMap<V>(
        keySelector: undefined,
        valueSelector: (value: T, index: number) => V
    ): AsMapWithValue<Iterable<T>, V>;

    /**
     * Provides a readonly Map of the contents of the Stream. If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     * @param valueSelector Selects the map's values from the values in the Stream.
     */
    public asMap<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): ReadonlyMap<K, V>;

    public asMap<K, V>(
        keySelector?: (value: T, index: number) => K,
        valueSelector?: (value: T, index: number) => V
    ): ReadonlyMap<unknown, unknown> {
        if (keySelector === undefined && valueSelector === undefined)
            return this.asMapParameterless();

        return (asMap as Function)(
            this.getSource(),
            keySelector,
            valueSelector
        );
    }

    private cache_asMapParameterless?: ReadonlyMap<any, any>;
    private asMapParameterless(): AsMap<Iterable<T>> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asMapParameterless === undefined)
                this.cache_asMapParameterless = asMap(this.getSource());
            return this.cache_asMapParameterless as any;
        } else {
            return asMap(this.getSource());
        }
    }

    private cache_asSolid?: ReadonlySolid<T>;
    //TODO DOCS
    public asSolid(): ReadonlySolid<T> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asSolid === undefined)
                this.cache_asSolid = asSolid(this.getSource());
            return this.cache_asSolid;
        }
        return asSolid(this.getSource());
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
        if (arguments.length == 1) {
            return reduce(this.getSource(), reduction);
        } else {
            return reduce(this.getSource(), reduction, initialValue);
        }
    }

    // TODO docs
    public reduceAndFinalize<F>(
        reduction: (
            previousResult: DeLiteral<T>,
            current: T,
            index: number
        ) => DeLiteral<T>,
        finalize: (result: DeLiteral<T>, info: ReduceAndFinalizeInfo) => F
    ): F;

    // TODO DOCS
    public reduceAndFinalize<R, F>(
        reduction: (previousResult: R, current: T, index: number) => R,
        finalize: (result: R, info: ReduceAndFinalizeInfo) => F,
        initialValue: R
    ): F;

    public reduceAndFinalize<F>(
        reduction: (previousResult: any, current: T, index: number) => any,
        finalize: (result: any, info: ReduceAndFinalizeInfo) => F,
        initialValue?: any
    ) {
        if (arguments.length > 3) {
            return reduceAndFinalize(
                this.getSource(),
                reduction,
                initialValue,
                finalize
            );
        } else {
            return reduceAndFinalize(this.getSource(), reduction, finalize);
        }
    }

    // TODO DOCS
    public max(): T;
    // TODO DOCS
    public max(comparator: Comparator<T>): T;
    // TODO DOCS
    public max(keySelector: KeySelector<T, any>): T;

    public max(order?: Order<T>){
        return max(this.getSource(), order);
    }
    
    // TODO DOCS
    public min(): T;
    // TODO DOCS
    public min(comparator: Comparator<T>): T;
    // TODO DOCS
    public min(keySelector: KeySelector<T, any>): T;

    public min(order?: Order<T>){
        return min(this.getSource(), order);
    }

    /**
     * @returns Whether the stream contains the given value.
     * @param value
     * @param fromIndex The index at which to start the search. Defaults to 0. Must be a positive integer.
     */
    public includes(value: T, fromIndex?: number | bigint): boolean {
        return includes(this.getSource(), value, fromIndex);
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

    // TODO docs
    public mkString(separator?: any): string;

    // TODO docs
    public mkString(start: any, separator: any, end?: any): string;

    // TODO docs
    public mkString(arg1: any = "", arg2: any = "", arg3: any = ""): string {
        const source = this.getSource();

        if (arguments.length > 1) {
            return mkString(source, arg1, arg2, arg3);
        } else {
            return mkString(source, arg1);
        }
    }

    /**
     * @returns The first value to pass the test or the default value if one wasn't found.
     * @param test
     * @param getDefault Returns the default values.
     */
    public findOrDefault<D>(
        test: (value: T, index: number) => boolean,
        getDefault: () => D
    ): T | D {
        let index = 0;

        for (const value of this) if (test(value, index++)) return value;

        return getDefault();
    }

    /** @returns The first value to pass the test or undefined if one wasn't found. */
    public find(test: (value: T, index: number) => boolean): T | undefined {
        return this.findOrDefault(test, () => undefined);
    }

    /** @returns The last value to pass the test or the default value if one wasn't found. */
    public findLastOrDefault<D>(
        test: (value: T, index: number) => boolean,
        getDefault: () => D
    ): T | D {
        let index = 0;
        let last: T;
        let found = false;

        for (const value of this) {
            if (test(value, index++)) {
                found = true;
                last = value;
            }
        }

        if (found) {
            return last!;
        } else {
            return getDefault();
        }
    }

    /** @returns The last value to pass the test or undefined if one wasn't found. */
    public findLast(test: (value: T, index: number) => boolean): T | undefined {
        return this.findLastOrDefault(test, () => undefined);
    }

    /** @returns The last value in the Stream or the default value if the Stream is empty. */
    public lastOrDefault<D>(getDefault: () => D): T | D {
        return lastOrDefault(this.getSource(), getDefault);
    }

    /** @returns The last value in the Stream or undefined if the Stream is empty. */
    public lastOrUndefined(): T | undefined {
        return lastOrUndefined(this.getSource());
    }

    /**
     * @returns The last value in the Stream.
     * @throws If the Stream is empty.
     */
    public last(): T {
        return last(this.getSource());
    }

    /** @returns The first value in the Stream or the default value if the Stream is empty. */
    public firstOrDefault<D>(getDefault: () => D): T | D {
        for (const value of this) return value;
        return getDefault();
    }

    /** @returns The first value in the Stream or undefined if the Stream is empty. */
    public firstOrUndefined(): T | undefined {
        for (const value of this) return value;
        return undefined;
    }

    /**
     * @returns The first value in the Stream.
     * @throws If the Stream is empty.
     */
    public first(): T {
        for (const value of this) return value;
        throw new Error("Stream has no first value because it it empty");
    }

    /**
     * @returns A random value from the Stream.
     * @throws If the Stream is empty.
     */
    public random(): T;

    /**
     * @returns A Stream of non-unique random values from the original Stream. Non-unique meaning that values are selected with replacement.
     * If the original Stream is empty, an empty Stream is returned regardless of the count requested.
     * @param count How many random values the returned Stream will have, unless the original Stream is empty.
     */
    public random(count: number | bigint): Stream<T>;

    public random(count?: number | bigint): Stream<T> | T {
        if (count === undefined) {
            return random.pickRandom(this.getSource());
        } else {
            requireInteger(require0OrGreater(count));
            return Stream.from(random.pickRandom(this.getSource(), count));
        }
    }

    /** @returns The value at the given index or the value at the given negative index from the end of the Stream (-1 returns the last value, -2 returns the second to last value, etc.).*/
    public atOrDefault<D>(index: number | bigint, getDefault: () => D): T | D {
        return atOrDefault(this.getSource(), index, getDefault);
    }

    // TODO improve docs
    /** @returns The value at the given index or the value at the given negative index from the end of the Stream (-1 returns the last value, -2 returns the second to last value, etc.).*/
    public at(index: number | bigint) {
        return at(this.getSource(), index);
    }

    /**
     * Counts how many values are in the Stream.
     * @returns The number of values in the Stream.
     */
    public count(): number;

    /**
     * counts how many values in the Stream pass the given test.
     * @returns The number of values that passed the test.
     */
    public count(test: (value: T, index: number) => boolean): number;

    public count(test?: (value: T, index: number) => boolean): number {
        if (test === undefined && this.sourceProperties.count !== undefined) {
            return this.sourceProperties.count;
        } else {
            return count(this.getSource(), test);
        }
    }

    /**
     * @returns The single item in the Stream that passes the given test or the default value if no items pass the test or if more than one item passes the test.
     */
    public singleOrDefault<D>(
        test: (value: T, index: number) => boolean,
        getDefault: (reason: "none found" | "too many found") => D
    ): T | D {
        let result: T | undefined = undefined;
        let found = false;
        let index = 0;
        for (const value of this) {
            if (test(value, index++)) {
                if (found) return getDefault("too many found");
                found = true;
                result = value;
            }
        }

        if (found) return result as T;
        return getDefault("none found");
    }

    /**
     * @returns The single item in the Stream that passes the given test or undefined if no items pass the test or if more than one item passes the test.
     */
    public singleOrUndefined(
        test: (value: T, index: number) => boolean
    ): T | undefined {
        return this.singleOrDefault(test, () => undefined);
    }

    /**
     * @returns The single item in the Stream that passes the given test.
     * @throws If no item passes the test or if more than one item passes the test.
     */
    public single(test: (value: T, index: number) => boolean): T {
        return this.singleOrDefault(test, reason => {
            if (reason === "none found") {
                throw new Error("no value found");
            } else {
                throw new Error("more than one value found");
            }
        });
    }

    /**
     * Attempts to get the length of the Stream without iterating it.
     * @returns The Stream's length or undefined if the length could not be found without iterating the Stream.
     */
    public getNonIteratedCountOrUndefined(): number | undefined {
        if (this.sourceProperties.count !== undefined) {
            return this.sourceProperties.count;
        } else {
            return undefined;
        }
    }

    /**
     * Calls the given function with the Stream and returns the result.
     */
    public pipe<R>(next: (stream: this) => R) {
        return next(this);
    }

    /**
     * Calls the given function with the Stream and then returns the Stream.
     */
    public inspect(inspector: (stream: Stream<T>) => void): Stream<T> {
        return new Stream(
            () => {
                const array = asArray(this);
                inspector(
                    new Stream(() => array, {
                        immutable: true,
                        count: array.length,
                    })
                );
                return array;
            },
            {
                immutable: this.sourceProperties.immutable,
                count: this.sourceProperties.count,
                fresh: this.sourceProperties.fresh,
            }
        );
    }

    /**
     * @returns Whether the Stream and the given Iterable are the same length and contain the same values in the same order.
     * @param other The other Iterable to check the Stream against.
     * @param checkEquality Test for whether two values are equal. Defaults to {@link Object.is}.
     */
    public sequenceEqual<O>(
        other: Iterable<O>,
        checkEquality: (a: T, b: O) => boolean = (a, b) => Object.is(a, b)
    ) {
        const source = this.getSource();
        const otherSource = Stream.getSource(other);

        // try to find out if the sequences are of a different length (and therefor not equal)
        const count = getNonIteratedCountOrUndefined(source);
        const otherCount = getNonIteratedCountOrUndefined(otherSource);
        if (
            count !== undefined &&
            otherCount !== undefined &&
            count !== otherCount
        ) {
            return false;
        }

        const iter = source[Symbol.iterator]();
        const otherIter = otherSource[Symbol.iterator]();
        let next: IteratorResult<T>;
        let otherNext: IteratorResult<O>;
        while (
            and(
                !(next = iter.next()).done,
                !(otherNext = otherIter.next()).done
            )
        ) {
            if (!checkEquality(next.value, otherNext.value)) return false;
        }

        return next.done && otherNext.done;
    }

    /**
     * Iterates over the Stream, recording how long it takes.
     * @returns How long in milliseconds it took for the Stream to be Iterated.
     */
    public benchmark(): number;

    /**
     * Iterates over the Stream, recording how long it takes.
     * @param takeTime Called with the time taken (in milliseconds).
     * @returns A Stream over the original Stream's result. Note that subsequent calls to {@link benchmark} will include the time taken to iterate a copy of the original Stream's result instead of the original Stream effectively timing the method calls between calls to {@link benchmark}.
     */
    public benchmark(takeTime: (timeInMilliseconds: number) => void): Stream<T>;

    public benchmark(
        takeTime?: (timeInMilliseconds: number) => void
    ): Stream<T> | number {
        if (takeTime === undefined) {
            const startTime = now();
            for (const _ of this);
            const stopTime = now();

            return startTime - stopTime;
        } else {
            return new Stream(() => {
                const startTime = now();
                const result = [...this];
                const stopTime = now();

                takeTime(stopTime - startTime);

                return result;
            }, this.sourceProperties);
        }
    }

    // TODO docs and better name
    public ifEmpty<R>(
        alternative: Iterable<R> | (() => Iterable<R>)
    ): Stream<T | R> {
        const self = this;
        return Stream.iter(function* () {
            const iter = self[Symbol.iterator]();
            let next = iter.next();

            if (next.done) {
                if (typeof alternative === "function") {
                    yield* alternative();
                } else {
                    yield* alternative;
                }
            } else {
                do {
                    yield next.value;
                } while (!(next = iter.next()).done);
            }
        });
    }

    public asString() {
        const source = this.getSource();
        if (typeof source === "string") {
            return source;
        } else {
            return this.mkString();
        }
    }

    // TODO docs
    public toString() {
        return this.mkString();
    }

    // TODO docs
    public toJSON() {
        return this.asArray();
    }
}

// ====================================================
//                  child classes
// ====================================================

/**
 * A {@link Stream} ordered by a collection of Comparators. Use {@link OrderedStream.thenBy} to add more comparators to sort by.
 */
export class OrderedStream<T> extends Stream<T> {
    protected readonly orderedBy: Order<T>[];
    protected readonly originalGetSource: () => Iterable<T>;
    protected readonly getPreSortedSource?: () => Iterable<T>;

    public constructor(
        getSource: () => Iterable<T>,
        orderedBy: Order<T>[],
        sourceProperties: StreamSourceProperties<T> = {},
        getPreSortedSource?: () => Iterable<T>,
        preSortedSourceProperties: StreamSourceProperties<T> = {}
    ) {
        super(
            () => {
                if (getPreSortedSource !== undefined)
                    return getPreSortedSource();

                const source = getSource();
                const sorted: T[] =
                    sourceProperties.fresh && Array.isArray(source)
                        ? (source as T[])
                        : [...source];

                sorted.sort((a, b) => multiCompare(a, b, orderedBy));

                return sorted;
            },
            getPreSortedSource !== undefined
                ? preSortedSourceProperties
                : { fresh: true, count: sourceProperties.count }
        );

        this.originalGetSource = getSource;
        this.orderedBy = orderedBy;
    }

    //TODO: document all this

    public thenBy(comparator: Comparator<T>): OrderedStream<T>;
    public thenBy(keySelector: (value: T) => any): OrderedStream<T>;
    public thenBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            [...this.orderedBy, order],
            this.sourceProperties
        );
    }

    public thenByDescending(comparator: Comparator<T>): OrderedStream<T>;
    public thenByDescending(keySelector: (value: T) => any): OrderedStream<T>;
    public thenByDescending(order: Order<T>): OrderedStream<T> {
        return this.thenBy(reverseOrder(order));
    }

    public cache(): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            this.orderedBy,
            {},
            eager(this.toArray()),
            { immutable: true, count: this.sourceProperties.count }
        );
    }

    public cached(): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            this.orderedBy,
            {},
            eager(lazyCacheIterable(this.getSource())),
            { immutable: true, count: this.sourceProperties.count }
        );
    }
}

// TODO docs
export class MappedStream<Source, Result> extends Stream<Result> {
    private readonly originalGetSource: () => Iterable<Source>;
    /** Whether any of the mapping functions have an index parameter. */
    private readonly indexNeeded: boolean;
    private readonly mappings:
        | readonly [(value: Source, index: number) => Result]
        | readonly [
              (value: Source, index: number) => any,
              ...((value: any, index: number) => any)[],
              (value: any, index: number) => Result
          ];

    public constructor(
        getSource: () => Iterable<Source>,
        mappings:
            | readonly [(value: Source, index: number) => Result]
            | readonly [
                  (value: Source, index: number) => any,
                  ...((value: any, index: number) => any)[],
                  (value: any, index: number) => Result
              ],
        sourceProperties: StreamSourceProperties<Source> = {}
    ) {
        super(
            () =>
                map(getSource(), (value, index) => {
                    return this.applyMappings(value, index);
                }),
            {
                count: sourceProperties.count,
                immutable: mappings.length === 0 && sourceProperties.immutable,
            }
        );
        this.originalGetSource = getSource;
        this.mappings = mappings;
        this.indexNeeded = this.mappings.some(m => m.length > 1);
    }

    private applyMappings(value: Source, index: number): Result {
        let result: any = value;
        for (let i = 0; i < this.mappings.length; i++) {
            result = this.mappings[i]!(result, index);
        }

        return result;
    }

    public map<NewResult>(
        mapping: (value: Result, index: number) => NewResult
    ): MappedStream<Source, NewResult> {
        return new MappedStream(
            this.originalGetSource,
            [...this.mappings, mapping],
            { count: this.sourceProperties.count }
        );
    }

    public atOrDefault<D>(
        index: number | bigint,
        getDefault: () => D
    ): Result | D {
        let outOfBounds = false;
        const sourceValue = atOrDefault(this.originalGetSource(), index, () => {
            outOfBounds = true;
        });

        if (!outOfBounds) {
            return this.applyMappings(sourceValue!, Number(index));
        } else {
            return getDefault();
        }
    }

    public at(index: number | bigint): Result | undefined {
        return this.atOrDefault(index, () => undefined);
    }

    public count(test?: (value: Result, index: number) => boolean): number {
        if (test === undefined) {
            return (
                this.sourceProperties.count ?? count(this.originalGetSource())
            );
        } else {
            return super.count(test);
        }
    }

    public getNonIteratedCountOrUndefined(): number | undefined {
        return (
            this.sourceProperties.count ??
            getNonIteratedCountOrUndefined(this.originalGetSource())
        );
    }

    public takeAlternating(interval: number | bigint = 2n): Stream<Result> {
        if (this.indexNeeded) return super.takeAlternating(interval);

        requireInteger(require0OrGreater(interval));
        return new MappedStream(
            () => takeAlternating(this.originalGetSource(), interval),
            this.mappings
        );
    }

    public skipAlternating(interval: number | bigint = 2n): Stream<Result> {
        if (this.indexNeeded) return super.skipAlternating(interval);

        requireInteger(require0OrGreater(interval));
        return new MappedStream(
            () => skipAlternating(this.originalGetSource(), interval),
            this.mappings
        );
    }

    public takeSparse(count: number | bigint): Stream<Result> {
        if (this.indexNeeded) return super.takeSparse(count);

        requireInteger(require0OrGreater(count));
        return new MappedStream(
            () => takeSparse(this.originalGetSource(), count),
            this.mappings,
            { ...this.sourceProperties, count: Number(count) }
        );
    }

    public skipSparse(count: number | bigint): Stream<Result> {
        if (this.indexNeeded) return super.skipSparse(count);

        requireInteger(require0OrGreater(count));
        return new MappedStream(
            () => skipSparse(this.originalGetSource(), count),
            this.mappings,
            this.sourceProperties
        );
    }

    public takeRandom(count: number | bigint): Stream<Result> {
        if (this.indexNeeded) return super.takeRandom(count);

        requireInteger(require0OrGreater(count));
        return new MappedStream(
            () => takeRandom(this.originalGetSource(), count),
            this.mappings
        );
    }

    public skipRandom(count: number | bigint): Stream<Result> {
        if (this.indexNeeded) return super.skipRandom(count);

        requireInteger(require0OrGreater(count));
        return new MappedStream(
            () => skipRandom(this.originalGetSource(), count),
            this.mappings
        );
    }

    public skip(count: number | bigint): Stream<Result> {
        if (this.indexNeeded) return super.skip(count);

        requireInteger(require0OrGreater(count));
        return new MappedStream(
            () => skip(this.originalGetSource(), count),
            this.mappings
        );
    }

    public random(): Result;

    public random(count: number | bigint): Stream<Result>;

    public random(count?: number | bigint): Stream<Result> | Result {
        if (this.indexNeeded) return (super.random as Function)(count);

        if (count === undefined) {
            const array = asArray(this.originalGetSource());
            const index = random.int(0, array.length);
            const sourceValue = array[index]!;

            let result: any = this.mappings[0](sourceValue, index);
            for (let i = 1; i < this.mappings.length; i++)
                result = this.mappings[i]!(result, index);

            return result;
        } else {
            return super.random(count);
        }
    }
}

// TODO docs
class FilteredStream<
    Source,
    Result extends Source = Source
> extends Stream<Result> {
    protected readonly originalGetSource: () => Iterable<Source>;
    protected readonly filters: readonly ((
        value: Source,
        index: number
    ) => boolean)[];

    public constructor(
        getSource: () => Iterable<Source>,
        filters: readonly ((value: Source, index: number) => boolean)[],
        sourceProperties: StreamSourceProperties<Source> = {}
    ) {
        super(
            () => {
                return filter<Source, Result>(getSource(), (value, index) => {
                    for (let i = 0; i < filters.length; i++)
                        if (!filters[i]!(value, index)) return false;
                    return true;
                });
            },
            { immutable: sourceProperties.immutable }
        );
        this.originalGetSource = getSource;
        this.filters = filters;
    }

    public filter<NewResult extends Result = Result>(
        test: (value: Result, index: number) => boolean
    ): Stream<NewResult> {
        if (test.length > 1) {
            // test needs an accurate index
            return super.filter(test) as any;
        } else {
            return new FilteredStream<Source, NewResult>(
                this.originalGetSource,
                [...this.filters, test] as any
            ) as any;
        }
    }
}

// ridiculous type filtering:

//TODO docs
export type TypeFilterOption =
    | "number"
    | "bigint"
    | "string"
    | "array"
    | "undefined"
    | "null"
    | "boolean"
    | "true"
    | "false"
    | "symbol"
    | "object"
    | "function"
    | "0"
    | "0n"
    | "emptyString";

export type TypeFilterTest<
    Option extends TypeFilterOption,
    T
> = Option extends "number"
    ? T extends number
        ? T
        : never
    : Option extends "bigint"
    ? T extends bigint
        ? T
        : never
    : Option extends "string"
    ? T extends string
        ? T
        : never
    : Option extends "object"
    ? T extends object
        ? T extends Function
            ? never
            : T extends readonly any[]
            ? never
            : T
        : never
    : Option extends "array"
    ? T extends readonly any[]
        ? T
        : never
    : Option extends "undefined"
    ? T extends undefined
        ? T
        : never
    : Option extends "null"
    ? T extends null
        ? T
        : never
    : Option extends "boolean"
    ? T extends boolean
        ? T
        : never
    : Option extends "true"
    ? T extends true
        ? T
        : never
    : Option extends "false"
    ? T extends false
        ? T
        : never
    : Option extends "symbol"
    ? T extends Symbol
        ? T
        : never
    : Option extends "function"
    ? T extends Function
        ? T
        : never
    : Option extends "0"
    ? T extends 0
        ? T
        : IsNumberLiteral<T> extends false
        ? T extends number
            ? T
            : never
        : never
    : Option extends "0n"
    ? T extends 0n
        ? T
        : IsBigIntLiteral<T> extends false
        ? T extends bigint
            ? T
            : never
        : never
    : Option extends "emptyString"
    ? T extends ""
        ? T
        : IsStringLiteral<T> extends false
        ? T extends string
            ? T
            : never
        : never
    : never;

export type TypeFilterOutTest<Option extends TypeFilterOption, T> =
    | never
    | Option extends "number"
    ? T extends number
        ? never
        : T
    : Option extends "bigint"
    ? T extends bigint
        ? never
        : T
    : Option extends "string"
    ? T extends string
        ? never
        : T
    : Option extends "object"
    ? T extends object
        ? T extends Function
            ? T
            : T extends readonly any[]
            ? T
            : never
        : T
    : Option extends "array"
    ? T extends readonly any[]
        ? never
        : T
    : Option extends "undefined"
    ? T extends undefined
        ? never
        : T
    : Option extends "null"
    ? T extends null
        ? never
        : T
    : Option extends "boolean"
    ? T extends boolean
        ? never
        : T
    : Option extends "true"
    ? T extends true
        ? never
        : T
    : Option extends "false"
    ? T extends false
        ? never
        : T
    : Option extends "symbol"
    ? T extends Symbol
        ? never
        : T
    : Option extends "function"
    ? T extends Function
        ? never
        : T
    : Option extends "0"
    ? T extends 0
        ? never
        : T
    : Option extends "0n"
    ? T extends 0n
        ? never
        : T
    : Option extends "emptyString"
    ? T extends ""
        ? never
        : T
    : T;

function getTypeFilterTest(option: TypeFilterOption): (value: any) => boolean {
    switch (option) {
        case "number":
            return value => typeof value === "number";
        case "array":
            return value => Array.isArray(value);
        case "null":
            return value => value === null;
        case "object":
            return value =>
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value);
        case "string":
            return value => typeof value === "string";
        case "undefined":
            return value => typeof value === "undefined";
        case "bigint":
            return value => typeof value === "bigint";
        case "boolean":
            return value => typeof value === "boolean";
        case "symbol":
            return value => typeof value === "symbol";
        case "function":
            return value => typeof value === "function";
        case "true":
            return value => (value as any) === true;
        case "false":
            return value => (value as any) === false;
        case "0":
            return value => (value as any) === 0;
        case "0n":
            return value => (value as any) === 0n;
        case "emptyString":
            return value => (value as any) === "";
    }
}

export class TypeFilteredStream<
    Source,
    Result extends Source,
    Options extends TypeFilterOption
> extends FilteredStream<Source, Result> {
    public constructor(
        getSource: () => Iterable<Source>,
        tests: ((value: any, index: number) => boolean)[],
        sourceProperties: StreamSourceProperties<Source>
    ) {
        super(getSource, tests, sourceProperties);
    }

    /**
     * Adds another type to filter the Stream to.
     */
    public and<Option extends TypeFilterOption>(
        option: Option extends Options ? never : Option
    ): TypeFilteredStream<
        Source,
        TypeFilterTest<Option, Result>,
        Options | Option
    > {
        const test = getTypeFilterTest(option);

        return new TypeFilteredStream(
            this.originalGetSource,
            [...this.filters, test],
            this.sourceProperties
        ) as any;
    }

    public cache(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(eager(this.toSolid()), [], {
            immutable: true,
        });
    }

    public cached(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(
            eager(lazyCacheIterable(this.getSource()) as any),
            [],
            { immutable: true }
        );
    }
}

export class TypeFilteredOutStream<
    Source,
    Result extends Source,
    Options extends TypeFilterOption
> extends FilteredStream<Source, Result> {
    public constructor(
        getSource: () => Iterable<Source>,
        tests: ((value: any, index: number) => boolean)[],
        sourceProperties: StreamSourceProperties<Source>
    ) {
        super(
            getSource,
            tests.map(test => (v, i) => !test(v, i)),
            sourceProperties
        );
    }

    /**
     * Adds another type to filter out of the stream.
     */
    public and<Option extends TypeFilterOption>(
        option: Option extends Options ? never : Option
    ): TypeFilteredStream<
        Source,
        TypeFilterOutTest<Option, Result>,
        Options | Option
    > {
        const test = getTypeFilterTest(option);

        return new TypeFilteredStream(
            this.originalGetSource,
            [...this.filters, v => !test(v)],
            this.sourceProperties
        ) as any;
    }

    public cache(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(eager(this.toSolid()), [], {
            immutable: true,
        });
    }

    public cached(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(
            eager(lazyCacheIterable(this.getSource()) as any),
            [],
            { immutable: true }
        );
    }
}
