import { ReadStream, ReadVResult } from "fs";
import { userInfo } from "os";
import Stopwatch from "./javascriptStopwatch/stopwatch";
import getStopwatchClass from "./javascriptStopwatch/stopwatch";
import { and, or } from "./logic";
import { Streamable, StreamableArray } from "./Streamable";
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
    setAndGet,
    isArray,
    last,
    at,
    count,
    smartCompare,
    zipperMerge,
    equalLengthZipperMerge as equalLengthZipperMerge,
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
    alternating as takeAlternating,
    getNonIteratedCount,
    alternatingSkip as skipAlternating,
    eager,
    distinct,
    map,
    filter,
    skipSparse,
    takeSparse,
    ValueOfArray,
    IsWhitespaceOnly,
    lazyCacheIterator,
    lastOrUndefined,
    lastOrDefault,
    empty,
    indexOf,
    looseMerge as looseMerge,
    merge,
    lazyCacheIterable,
    IsNumberLiteral,
    IsBigIntLiteral,
    IsStringLiteral,
    concat,
    skipRandomToArray,
    take,
    skipRandom,
    takeRandom,
    forEach,
    BreakSignal,
    ReduceAndFinalizeInfo,
    reduce,
    reduceAndFinalize,
} from "./utils";

/** Properties of a Stream's source. */
export interface StreamSourceProperties<T> {
    /** Whether the Iterable from {@link Stream.getSource} is a new instance every time that can be modified safely. */
    readonly oneOff?: boolean;
    /** Whether the values in the Iterable from {@link Stream.getSource} will never change. Note that this doesn't mean the values themselves can't be mutable (like if the values are object, they can have mutable fields), it just means that the values can't be swapped out with other values, can't be re-arranged, or removed and values cannot be added into the source. Essentially, the source can't change but the values in the source can. */
    readonly immutable?: boolean;
}

// TODO docs
export default class Stream<T> implements Iterable<T> {
    /** Returns the Source Iterable that the Stream is over. */
    protected readonly getSource: () => Iterable<T>;
    /** Properties of the Source. */
    protected readonly sourceProperties: StreamSourceProperties<T>;

    /** For the case of a Stream of a Stream of a Stream... etc. Gets the non-Stream source at the bottom. */
    protected static getBaseSourceOf<T>(source: Iterable<T>) {
        while (source instanceof Stream) source = source.getSource();
        return source;
    }

    /** For the case of a Stream of a Stream of a Stream... etc. Gets the non-Stream source at the bottom. */
    protected getBaseSource() {
        return Stream.getBaseSourceOf(this.getSource());
    }

    public constructor(
        getSource: () => Iterable<T>,
        sourceProperties: StreamSourceProperties<T> = {}
    ) {
        this.sourceProperties = sourceProperties;
        this.getSource = getSource;
    }

    /** @returns An empty Stream of the given type. */
    public static empty<T>(): Stream<T> {
        return new Stream<T>(() => [], { oneOff: true, immutable: true });
    }

    /** @return A Stream of the given values. */
    public static literal<T>(...values: T[]) {
        return new Stream(() => values, { immutable: true });
    }

    /** @returns A Stream of the given collection or an empty Stream if undefined is given. */
    public static of<T>(source: Iterable<T> | undefined) {
        return new Stream(eager(source ?? []), {});
    }

    /** @returns A Stream of the collection from the given function. */
    public static from<T>(sourceGetter: () => Iterable<T>) {
        return new Stream(sourceGetter, {});
    }

    /** @returns A Stream of the generator from the given function. */
    public static iter<T>(generatorGetter: () => Generator<T>) {
        return new Stream(eager(iter(generatorGetter)), {});
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
        return new Stream(eager(range(_startOrEnd, _end, _step)), {
            immutable: true,
        });
    }

    /** Generate a new Stream from the given generator function. */
    public static generate<T>(
        from: (index: number) => T,
        length: number | bigint
    ) {
        return Stream.of(generate(from, length));
    }

    /** @returns An iterator over the Stream. */
    public [Symbol.iterator]() {
        return Stream.getBaseSourceOf(this.getSource())[Symbol.iterator]();
    }

    /**
     * Calls the callback on each value in the Stream. Like {@link Array.forEach}.
     * @param callback What to call for each value. If {@link breakSignal} is returned, iteration is stopped.
     * @returns The Stream.
     */
    public forEach(
        callback: (value: T, index: number) => BreakSignal | void
    ): this {
        forEach(this.getBaseSource(), callback);
        return this;
    }

    /**
     * @param mapping The mapping function. Not guarantied to be run for every value in the Stream if not necessary.
     * @returns A Stream of the given mapping from the original Stream. Like {@link Array.map}.
     */
    public map<R>(mapping: (value: T, index: number) => R): Stream<R> {
        return new MappedStream(this.getSource, [mapping]);
    }

    /**
     * @returns A stream of the values that pass the filter. Like {@link Array.filter}.
     * @param test Whether the given value passes the filter. Return true to include the value in the returned Stream and false to not include it.
     */
    public filter(test: (value: T, index: number) => boolean): Stream<T> {
        // return new Stream(eager(filter(this.getBaseSource(), test)), {});
        return new FilteredStream(this.getSource, [test]);
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
        const usableTimes = BigInt(times);
        if (usableTimes < 0n) return this.reverse().repeat(-usableTimes);

        const self = this;
        return new Stream(
            eager(
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
                })
            ),
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
    /**
     * Groups the values in the Stream by the given key selector and then applying a mapping to the values using the value selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @param valueSelector The mapping to apply to the values after the grouping.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K, V>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => V
    ): Stream<[K, StreamableArray<V>]>;
    public groupBy<K>(
        keySelector: (value: T, index: number) => K,
        valueSelector: (value: T, index: number) => any = value => value
    ): Stream<[K, StreamableArray<T>]> {
        return new Stream(
            () => groupBy(this.getBaseSource(), keySelector, valueSelector),
            {
                oneOff: true,
            }
        );
    }

    // TODO write documentation for this.
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

    // TODO docs
    public indexBy<K>(keySelector: (value: T, index: number) => K) {
        return new Stream(
            () => {
                const index = new Map<K, T>();

                const source = this.getBaseSource();

                let i = 0;
                for (const value of this)
                    index.set(keySelector(value, i++), value);

                return index;
            },
            { oneOff: true }
        );
    }

    /**
     * An out-of-place sort of the values in the Stream based on the given comparator. Like {@link Array.sort}.
     * @returns A Stream of the original Streams values sorted by the comparator.
     * @params comparator How to sort the values. If omitted, the values are sorted in ascending, ASCII order.
     */
    public sort(comparator?: (a: T, b: T) => number): Stream<T> {
        return Stream.from(() => {
            const sorted = this.toArray();
            sorted.sort(comparator);
            return sorted;
        });
    }

    /**
     * Sorts the Stream from least to greatest based on the key from the given key selector function.
     */
    public orderBy(keySelector: (value: T) => any): OrderedStream<T>;
    /**
     * Sorts the Stream from least to greatest using the given comparator function.
     */
    public orderBy(comparator: Comparator<T>): OrderedStream<T>;
    public orderBy(order: Order<T>): OrderedStream<T> {
        return new OrderedStream(
            this.getSource,
            [order],
            this.sourceProperties
        );
    }

    /**
     * Sorts the Stream from greatest to least based on the key from the given key selector function.
     */
    public orderByDescending(keySelector: (value: T) => any): OrderedStream<T>;
    /**
     * Sorts the Stream from greatest to least using the given comparator function.
     */
    public orderByDescending(comparator: Comparator<T>): OrderedStream<T>;
    public orderByDescending(order: Order<T>): OrderedStream<T> {
        return this.orderBy(reverseOrder(order));
    }

    /**
     * Sorts the Stream from least to greatest.
     */
    public order(): OrderedStream<T> {
        return this.orderBy(value => value);
    }

    /**
     * Sorts the Stream from greatest to least.
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
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Takes every n value in the Stream.
     * @param interval The interval on which to take. Defaults to 2.
     */
    public takeAlternating(interval: number | bigint = 2n): Stream<T> {
        return new Stream(
            eager(takeAlternating(this.getBaseSource(), interval)),
            this.sourceProperties
        );
    }

    /**
     * Skips every n value in the Stream.
     * @param interval The interval on which to skip. Defaults to 2.
     */
    public skipAlternating(interval: number | bigint = 2n): Stream<T> {
        return new Stream(
            eager(skipAlternating(this.getBaseSource(), interval)),
            this.sourceProperties
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
            eager(
                iter(function* () {
                    let index = 0;
                    for (const value of self)
                        if (test(value, index++)) {
                            yield value;
                            break;
                        }

                    yield* self;
                })
            ),
            { immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Takes a number of values from the start of the Stream.
     */
    public take(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().take(-count).reverse();
        if (usableCount === 0) return Stream.empty<T>();
        return this.takeWhile((_, index) => index < usableCount);
    }

    /**
     * Skips a number of values from the start of the Stream.
     */
    public skip(count: number | bigint): Stream<T> {
        const usableCount = Math.trunc(Number(count));
        if (usableCount < 0) return this.reverse().skip(-count).reverse();
        if (usableCount === 0) return this;
        return this.skipWhile((_, index) => index < usableCount);
    }

    /**
     * Takes a specified number of values from the Stream, spread out from the start to the end.
     * @param count How many values to take from the Stream.
     * @returns A Stream of values spread out across the original Stream.
     */
    public takeSparse(count: number | bigint): Stream<T> {
        return new Stream(
            eager(takeSparse(this.getBaseSource(), count)),
            this.sourceProperties
        );
    }

    /**
     * Skips a specified number of values in the Stream, spread out from the start to the end.
     * @param count How many values to skip.
     * @returns A Stream of values spread out across the original Stream.
     */
    public skipSparse(count: number | bigint): Stream<T> {
        return new Stream(
            eager(skipSparse(this.getBaseSource(), count)),
            this.sourceProperties
        );
    }

    /**
     * Takes a number of random values from the Stream. The values to be taken are essentially taken without replacement. The same item is never taken twice.
     */
    public takeRandom(count: number | bigint): Stream<T> {
        if (BigInt(count) < 0n || Number(count) < 0)
            throw new Error(
                `count must be 0 or greater but ${count} was given`
            );
        return this.shuffle().take(count);
    }

    /**
     * Skips a number of random values in the Stream. The values to be skipped are essentially taken without replacement. The same item is never skipped twice.
     */
    public skipRandom(count: number | bigint): Stream<T> {
        return new Stream(
            eager(skipRandomToArray(this.getBaseSource(), count)),
            { oneOff: true }
        );
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
            }
        );
    }

    /**
     * Inserts the Iterable at the given index.
     * @param other What to insert.
     * @param at Where to insert. Must be 0 or greater.
     */
    public insert<O>(other: Iterable<O>, at: number | bigint): Stream<T | O> {
        const usableAt = BigInt(at);
        // TODO add upper bound.
        if (usableAt < 0n)
            throw new Error(`at must be 0 or greater but ${at} was given`);
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
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
            }
        );
    }

    /**
     * Inserts the value into the Stream at the given index.
     * @param value What to insert.
     * @param at Where to insert. Must be 0 or greater.
     */
    public insertValue(value: T, at: number | bigint) {
        const usableAt = BigInt(at);

        //TODO add upper bound
        //TODO insert from end if at is negative
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
            this.sourceProperties
        );
    }

    /**
     * Removes duplicated values from the Stream.
     */
    public distinct(identifier?: (value: T) => any): Stream<T> {
        const self = this;
        return new Stream(eager(distinct(this.getBaseSource(), identifier)), {
            immutable:
                this.sourceProperties.immutable && identifier === undefined
                    ? true
                    : undefined,
        });
    }

    /**
     * Removes a number of values from the Stream. Similar to {@link Array.splice}.
     * @param start Where to start the removal.
     * @param deleteCount How many values to remove.
     */
    public remove(start: number | bigint, deleteCount: number | bigint = 1) {
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
            this.sourceProperties
        );
    }

    /** @returns A Stream over the original Stream in random order. */
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

    /**
     * Appends the value to the end of the Stream.
     */
    public append(value: T) {
        return new Stream(eager(append(this.getBaseSource(), value)), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Appends the value to the start of the Stream.
     */
    public prepend(value: T) {
        return new Stream(eager(append(this.getBaseSource(), value)), {
            immutable: this.sourceProperties.immutable,
        });
    }

    /**
     * Appends the values from the given Iterable to the end of the Stream if they aren't already in the Stream. Essentially performing a union operation between the Stream and the given Iterable.
     * @param needed
     * @returns
     */
    public with(needed: Iterable<T>): Stream<T> {
        return new Stream(eager(including(this.getBaseSource(), needed)), {
            immutable:
                this.sourceProperties.immutable &&
                needed instanceof Stream &&
                needed.sourceProperties.immutable,
        });
    }

    /**
     * Removes all the values found in the given Iterable from the Stream. Essentially performing a difference operation between the Stream and the given Iterable.
     * @param remove What not to include in the returned stream.
     * @returns A Stream of all the values in the original Stream that are not found in the given Iterable.
     */
    public without(remove: Iterable<T>): Stream<T> {
        return new Stream(eager(excluding(this.getBaseSource(), remove)), {
            immutable:
                this.sourceProperties.immutable &&
                remove instanceof Stream &&
                remove.sourceProperties.immutable,
        });
    }

    // TODO docs
    public looseMerge<O>(other: Iterable<O>): Stream<[T, O]>;
    // TODO docs
    public looseMerge<O, R>(
        other: Iterable<O>,
        merger: (t: T | undefined, o: O | undefined) => R
    ): Stream<R>;
    public looseMerge<O>(
        other: Iterable<O>,
        merger: (t: T | undefined, o: O | undefined) => any = (t, o) => [t, o]
    ): Stream<any> {
        return new Stream(eager(looseMerge(this, other, merger)), {
            immutable:
                this.sourceProperties.immutable &&
                other instanceof Stream &&
                other.sourceProperties.immutable,
        });
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
        return new Stream(eager(merge(this, other, merger)), {
            immutable:
                this.sourceProperties.immutable &&
                other instanceof Stream &&
                other.sourceProperties.immutable,
        });
    }

    /** Performs a zipper merge with the given Iterable. */
    public zipperMerge<O>(other: Iterable<O>): Stream<T | O> {
        return new Stream(eager(zipperMerge(this.getBaseSource(), other)), {
            immutable:
                this.sourceProperties.immutable &&
                other instanceof Stream &&
                other.sourceProperties.immutable,
        });
    }

    // TODO docs
    public equalLengthZipperMerge<O>(other: Iterable<O>): Stream<T | O> {
        return new Stream(
            eager(equalLengthZipperMerge(this.getBaseSource(), other)),
            {
                immutable:
                    this.sourceProperties.immutable &&
                    other instanceof Stream &&
                    other.sourceProperties.immutable,
            }
        );
    }

    /** Keeps only the values that are in both the Stream and the given Iterable */
    public intersect(other: Iterable<T>): Stream<T> {
        return new Stream(eager(intersection(this.getBaseSource(), other)), {
            immutable:
                this.sourceProperties.immutable &&
                other instanceof Stream &&
                other.sourceProperties.immutable,
        });
    }

    /** Keeps only the values in the Stream that aren't undefined. For more advanced type filtering try {@link filterTo} and {@link filterOut}. */
    public defined(): Stream<T extends undefined ? never : T> {
        return new Stream(
            eager(filter(this.getBaseSource(), value => value !== undefined)),
            this.sourceProperties
        ) as any;
    }

    /** Keeps only the values in the Stream that aren't null. For more advanced type filtering try {@link filterTo} and {@link filterOut}. */
    public nonNull(): Stream<T extends null ? never : T> {
        return new Stream(
            eager(filter(this.getBaseSource(), value => value !== null)),
            this.sourceProperties
        ) as any;
    }

    /** Does the same thing as {@link Array.copyWithin} but of course it doesn't modify the original source. */
    public copyWithin(
        target: number | bigint,
        start: number | bigint,
        end: number | bigint | undefined
    ) {
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
            { oneOff: true, immutable: this.sourceProperties.immutable }
        );
    }

    /**
     * Normally Streams are recalculated every iteration in order to stay consistent with the Stream's source. This method records the result of the stream and returns a new Stream of that recording. The returned Stream no longer follows changes to the original source and iterating the new Stream doesn't iterate the original Stream.
     *
     * The copy of the Stream is made at call time. For lazy execution use {@link lazySolidify}.
     */
    public solidify(): Stream<T> {
        return new Stream(eager(this.toSolid()), { immutable: true });
    }

    /** Lazy version of {@link solidify}. The Stream is copied on the first iteration of the result which is cached for later iterations. */
    public lazySolidify(): Stream<T> {
        return new Stream(
            lazy(() => this.toSolid()),
            { immutable: true }
        );
    }

    /**
     * Copies the Stream into an Array. The Array is safe to modify.
     *
     * If the Array does not need to be modifiable, consider using {@link Stream.asArray} instead.
     */
    public toArray(): T[] {
        let source = this.getSource();
        if (this.sourceProperties.oneOff && Array.isArray(source))
            return source;
        source = Stream.getBaseSourceOf(source);

        return [...source];
    }

    /**
     * Copies the Stream into a Set. The Set is safe to modify.
     *
     * If the Set does not need to be modifiable, consider using {@link Stream.asSet} instead.
     */
    public toSet(): Set<T> {
        let source = this.getSource();
        if (this.sourceProperties.oneOff && source instanceof Set)
            return source;
        source = Stream.getBaseSourceOf(source);

        return new Set(source);
    }

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     */
    public toMap(): T extends EntryLike<infer K, infer V>
        ? Map<K, V>
        : T extends EntryLikeKey<infer K>
        ? Map<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? Map<unknown, V>
        : Map<unknown, unknown>;

    /**
     * Copies the Stream into a Map. The Map is safe to modify.
     *
     * If the Map does not need to be modifiable, consider using {@link Stream.asMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public toMap<K>(
        keySelector: (value: T, index: number) => K
    ): T extends EntryLikeValue<infer V> ? ReadonlyMap<K, V> : never;

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
    ): T extends EntryLikeKey<infer K> ? ReadonlyMap<K, V> : never;

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
    ): ReadonlyMap<K, V> {
        let source = this.getSource();
        if (
            this.sourceProperties.oneOff &&
            keySelector === undefined &&
            valueSelector === undefined &&
            source instanceof Map
        )
            return source;

        source = Stream.getBaseSourceOf(source);

        return toMap(source, keySelector as any, valueSelector as any);
    }

    public toSolid(): Solid<T> {
        let source = this.getSource();
        if (this.sourceProperties.oneOff) {
            if (Array.isArray(source)) return source;
            if (source instanceof Set) return source;
            if (source instanceof Map) return source as any;
        }
        source = Stream.getBaseSourceOf(source);
        return [...source];
    }

    private cache_asArray?: readonly T[];
    /**
     * Provides a readonly Array of the contents of the Stream. If the Array needs to be modifiable consider using {@link Stream.toArray} instead.
     */
    public asArray(): readonly T[] {
        if (this.sourceProperties.immutable) {
            if (this.cache_asArray === undefined)
                this.cache_asArray = asArray(this.getBaseSource());
            return this.cache_asArray;
        }
        return asArray(this.getBaseSource());
    }

    private cache_asSet?: ReadonlySet<T>;
    /**
     * Provides a readonly Set of the contents of the Stream. If the Set needs to be modifiable consider using {@link Stream.toSet} instead.
     */
    public asSet(): ReadonlySet<T> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asSet === undefined)
                this.cache_asSet = asSet(this.getBaseSource());
            return this.cache_asSet;
        }
        return asSet(this.getBaseSource());
    }

    private cache_asMapParameterless?: ReadonlyMap<any, any>;
    private asMapParameterless(): T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? ReadonlyMap<unknown, V>
        : ReadonlyMap<unknown, unknown> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asMapParameterless === undefined)
                this.cache_asMapParameterless = asMap(this.getBaseSource());
            return this.cache_asMapParameterless as any;
        }
        return asMap(this.getBaseSource());
    }

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     */
    public asMap(): T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? ReadonlyMap<unknown, V>
        : ReadonlyMap<unknown, unknown>;

    /**
     * Provides a readonly Map of the contents of the Stream.
     *
     * If the Map needs to be modifiable consider using {@link Stream.toMap} instead.
     * @param keySelector Selects the map's keys from the values in the Stream.
     */
    public asMap<K>(
        keySelector: (value: T, index: number) => K
    ): T extends EntryLikeValue<infer V> ? ReadonlyMap<K, V> : never;

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
    ): T extends EntryLikeKey<infer K> ? ReadonlyMap<K, V> : never;

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
    ): ReadonlyMap<K, V> {
        if (keySelector === undefined && valueSelector === undefined)
            return this.asMapParameterless() as any;
        return asMap(
            this.getBaseSource(),
            keySelector as any,
            valueSelector as any
        );
    }

    private cache_asSolid?: ReadonlySolid<T>;
    public asSolid(): ReadonlySolid<T> {
        if (this.sourceProperties.immutable) {
            if (this.cache_asSolid === undefined)
                this.cache_asSolid = asSolid(this.getBaseSource());
            return this.cache_asSolid;
        }
        return asSolid(this.getBaseSource());
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
        if (arguments.length > 1) {
            return reduce(this.getBaseSource(), reduction, initialValue);
        } else {
            return reduce(this.getBaseSource(), reduction);
        }
    }

    public reduceAndFinalize<F>(
        reduction: (
            previousResult: DeLiteral<T>,
            current: T,
            index: number
        ) => DeLiteral<T>,
        finalize: (result: DeLiteral<T>, info: ReduceAndFinalizeInfo) => F
    ): F;

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
                this.getBaseSource(),
                reduction,
                finalize,
                initialValue
            );
        } else {
            return reduceAndFinalize(this.getBaseSource(), reduction, finalize);
        }
    }

    /** @returns Whether the stream contains the given value. */
    public includes(value: T): boolean {
        return includes(this.getBaseSource(), value);
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
     * Adds all the values in the Stream into a string, separated by the specified separator string. Like {@link Array.join}.
     * @param separator Put in between the values in the resulting string. Defaults to a comma (,).
     */
    public join(separator: string = ","): string {
        return join(this.getBaseSource(), separator);
    }

    /** Returns a Stream with sub-Iterable elements concatenated into it. */
    public flat(): Stream<T extends Iterable<infer SubT> ? SubT : T> {
        const self = this;
        return Stream.iter(function* () {
            for (const value of self) {
                if (isIterable(value)) yield* value;
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

    /** @returns The index of the last value to pass the test or undefined if one wasn't found. */
    public findLastIndex(
        test: (value: T, index: number) => boolean
    ): number | undefined {
        let index = 0;
        let result: number | undefined = undefined;
        for (const value of this) {
            if (test(value, index)) result = index;
            index++;
        }
        return result;
    }

    /** @returns The first index of the given value or undefined if the value isn't found. */
    public indexOf(value: T, fromIndex?: number | bigint): number | undefined {
        return indexOf(this.getBaseSource(), value, fromIndex);
    }

    /** @returns The last index of the given value or undefined if the value isn't found. */
    public lastIndexOf(
        value: T,
        fromIndex?: number | bigint
    ): number | undefined {
        const lastIndex = this.toArray().lastIndexOf(
            value,
            fromIndex === undefined ? undefined : Number(fromIndex)
        );
        if (lastIndex === -1) return undefined;
        return lastIndex;
    }

    /** @returns The first value in the Stream or undefined if the Stream is empty. */
    public firstOrUndefined(): T | undefined {
        for (const value of this) return value;
        return undefined;
    }

    /** @returns The last value in the Stream or undefined if the Stream is empty. */
    public lastOrUndefined(): T | undefined {
        return lastOrUndefined(this.getBaseSource());
    }

    /** @returns The first value in the Stream or the default value if the Stream is empty. */
    public firstOrDefault<D>(getDefault: () => D): T | D {
        for (const value of this) return value;
        return getDefault();
    }

    /** @returns The last value in the Stream or the default value if the Stream is empty. */
    public lastOrDefault<D>(getDefault: () => D): T | D {
        return lastOrDefault(this.getBaseSource(), getDefault);
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
     * @returns The last value in the Stream.
     * @throws If the Stream is empty.
     */
    public last(): T {
        return last(this.getBaseSource());
    }

    /**
     * @returns A random value from the Stream.
     * @throws If the Stream is empty.
     */
    public random(): T;

    /**
     * @returns A Stream of non-unique random values from the original Stream. If the original Stream is empty, an empty Stream is returned regardless of the count requested.
     * @param count How many random values the returned Stream will have.
     */
    public random(count: number | bigint): Stream<T>;

    public random(count?: number | bigint): Stream<T> | T {
        if (count === undefined) {
            return random.pickRandom(this.getBaseSource());
        } else {
            return Stream.of(random.pickRandom(this.getBaseSource(), count));
        }
    }

    /** @returns The value at the given index or the value at the given negative index from the end of the Stream (-1 returns the last value, -2 returns the second to last value, etc.).*/
    public at(index: number | bigint) {
        return at(this.getBaseSource(), index);
    }

    /**
     * Counts how many values are in the Stream.
     * @returns The number of values in the Stream.
     * */
    public count(): number {
        return count(this.getBaseSource());
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
        return getNonIteratedCountOrUndefined(this.getBaseSource());
    }

    /**
     * Calls the given function with the Stream and returns the result.
     */
    public then<R>(next: (stream: this) => R) {
        return next(this);
    }

    /**
     * @returns Whether the Stream and the given Iterable are the same length and contain the same values in the same order.
     * @param other The other Iterable to check the Stream against.
     * @param checkEquality Test for whether two values are equal. Defaults to {@link Object.is}.
     */
    public sequenceEqual(
        other: Iterable<T>,
        checkEquality: (a: T, b: T) => boolean = (a, b) => Object.is(a, b)
    ) {
        const source = this.getBaseSource();
        const otherSource =
            other instanceof Stream ? other.getBaseSource() : other;

        {
            const count = getNonIteratedCountOrUndefined(source);
            const otherCount = getNonIteratedCountOrUndefined(otherSource);
            if (
                count !== undefined &&
                otherCount !== undefined &&
                count !== otherCount
            )
                return false;
        }

        const iter = source[Symbol.iterator]();
        const otherIter = otherSource[Symbol.iterator]();
        let next;
        let otherNext;
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
        const stopwatch = new Stopwatch();

        if (takeTime === undefined) {
            stopwatch.restart();
            this.solidify();
            stopwatch.stop();
            return stopwatch.elapsedTimeInMilliseconds;
        } else {
            return new Stream(
                () => {
                    stopwatch.restart();
                    const result = this.solidify();
                    stopwatch.stop();
                    takeTime(stopwatch.elapsedTimeInMilliseconds);
                    return result.getSource();
                },
                { immutable: this.sourceProperties.immutable }
            );
        }
    }

    public toString() {
        return this.join(",");
    }

    public toJSON() {
        return this.asArray();
    }
}

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
                    sourceProperties.oneOff && Array.isArray(source)
                        ? (source as T[])
                        : [...source];

                sorted.sort((a, b) => multiCompare(a, b, orderedBy));

                return sorted;
            },
            getPreSortedSource !== undefined
                ? preSortedSourceProperties
                : { oneOff: true }
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

    public solidify(): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            this.orderedBy,
            {},
            eager(this.toArray()),
            { oneOff: true, immutable: true }
        );
    }

    public lazySolidify(): OrderedStream<T> {
        return new OrderedStream(
            this.originalGetSource,
            this.orderedBy,
            {},
            lazy(() => this.toArray()),
            { oneOff: true, immutable: true }
        );
    }
}

// TODO docs
export class MappedStream<Source, Result> extends Stream<Result> {
    private readonly originalGetSource: () => Iterable<Source>;

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
              ]
    ) {
        super(() =>
            map(Stream.getBaseSourceOf(getSource()), (value, index) => {
                let result = mappings[0]!(value, index);
                for (let i = 1; i < mappings.length; i++)
                    result = mappings[i]!(result, index);
                return result;
            })
        );
        this.originalGetSource = getSource;
        this.mappings = mappings;
    }

    public map<NewResult>(
        mapping: (value: Result, index: number) => NewResult
    ): MappedStream<Source, NewResult> {
        return new MappedStream(this.originalGetSource, [
            ...this.mappings,
            mapping,
        ]);
    }

    private getBaseOfOriginalSource(): Iterable<Source> {
        return Stream.getBaseSourceOf(this.originalGetSource());
    }

    public at(index: number | bigint): Result | undefined {
        const sourceValue = at(this.getBaseOfOriginalSource(), index);

        if (sourceValue === undefined) return undefined;

        const indexAsNumber = Number(index);

        let result: any = this.mappings[0](sourceValue, indexAsNumber);
        for (let i = 1; i < this.mappings.length; i++)
            result = this.mappings[i]!(result, indexAsNumber);

        return result;
    }

    public count(): number {
        return count(this.getBaseOfOriginalSource());
    }

    public getNonIteratedCountOrUndefined(): number | undefined {
        return getNonIteratedCountOrUndefined(this.getBaseOfOriginalSource());
    }

    public takeAlternating(
        interval: number | bigint = 2n
    ): MappedStream<Source, Result> {
        return new MappedStream(
            eager(takeAlternating(this.getBaseOfOriginalSource(), interval)),
            this.mappings
        );
    }

    public skipAlternating(
        interval: number | bigint = 2n
    ): MappedStream<Source, Result> {
        return new MappedStream(
            eager(skipAlternating(this.getBaseOfOriginalSource(), interval)),
            this.mappings
        );
    }

    public takeSparse(count: number | bigint): MappedStream<Source, Result> {
        return new MappedStream(
            eager(takeSparse(this.getBaseOfOriginalSource(), count)),
            this.mappings
        );
    }

    public skipSparse(count: number | bigint): MappedStream<Source, Result> {
        return new MappedStream(
            eager(skipSparse(this.getBaseOfOriginalSource(), count)),
            this.mappings
        );
    }

    public takeRandom(count: number | bigint): MappedStream<Source, Result> {
        return new MappedStream(
            eager(takeRandom(this.getBaseOfOriginalSource(), count)),
            this.mappings
        );
    }

    public skipRandom(count: number | bigint): MappedStream<Source, Result> {
        return new MappedStream(
            eager(skipRandom(this.getBaseOfOriginalSource(), count)),
            this.mappings
        );
    }

    public random(): Result;

    public random(count: number | bigint): Stream<Result>;

    public random(count?: number | bigint): Stream<Result> | Result {
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
        filters: readonly ((value: Source, index: number) => boolean)[]
    ) {
        super(() => {
            return filter<Source, Result>(
                Stream.getBaseSourceOf(getSource()),
                (value, index) => {
                    for (let i = 0; i < filters.length; i++)
                        if (!filters[i]!(value, index)) return false;
                    return true;
                }
            );
        });
        this.originalGetSource = getSource;
        this.filters = filters;
    }

    public filter<NewR extends Result = Result>(
        test: (value: Result, index: number) => boolean
    ): FilteredStream<Source, NewR> {
        return new FilteredStream<Source, NewR>(this.originalGetSource, [
            ...this.filters,
            test,
        ] as any);
    }
}

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
    protected readonly sourceProperties: StreamSourceProperties<Source>;
    public constructor(
        getSource: () => Iterable<Source>,
        tests: ((value: any, index: number) => boolean)[],
        sourceProperties: StreamSourceProperties<Source>
    ) {
        super(getSource, tests);
        this.sourceProperties = sourceProperties;
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

    public solidify(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(eager(this.toSolid()), [], {
            immutable: true,
        });
    }

    public lazySolidify(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(
            lazy(() => this.toSolid()),
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
    protected readonly sourceProperties: StreamSourceProperties<Source>;
    public constructor(
        getSource: () => Iterable<Source>,
        tests: ((value: any, index: number) => boolean)[],
        sourceProperties: StreamSourceProperties<Source>
    ) {
        super(
            getSource,
            tests.map(test => (v, i) => !test(v, i))
        );
        this.sourceProperties = sourceProperties;
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

    public solidify(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(eager(this.toSolid()), [], {
            immutable: true,
        });
    }

    public lazySolidify(): TypeFilteredStream<Source, Result, Options> {
        return new TypeFilteredStream(
            lazy(() => this.toSolid()),
            [],
            { immutable: true }
        );
    }
}
