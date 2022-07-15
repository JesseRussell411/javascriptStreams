import { and } from "./logic";
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
} from "./utils";

export default class Stream<T> implements Iterable<T>, Streamable<T> {
    private getSource: () => Iterable<T>;

    private constructor(getSource: () => Iterable<T>) {
        this.getSource = getSource;
    }

    /** @returns An empty stream. */
    public static of<T>(): Stream<T>;
    /** @returns A Stream of the collection. */
    public static of<T>(collection: Iterable<T>): Stream<T>;
    public static of<T>(source?: Iterable<T>) {
        return new Stream(() => source ?? []);
    }

    /** @returns A Stream of the collection from the given function. */
    public static from<T>(sourceGetter: () => Iterable<T>) {
        return new Stream(sourceGetter);
    }

    /** @returns A Stream of the generator from the given function. */
    public static iter<T>(generatorGetter: () => Generator<T>) {
        return new Stream(() => iter(generatorGetter));
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
    public forEach(
        callback: (value: T, index: number, stream: this) => Symbol | void
    ): this {
        let index = 0;
        for (const value of this) {
            if (callback(value, index++, this) === breakSignal) break;
        }

        return this;
    }

    /** @returns A Stream of the given mapping from the original Stream. Like {@link Array.map}. */
    public map<R>(
        mapping: (value: T, index: number, stream: this) => R
    ): Stream<R> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) yield mapping(value, index++, self);
        });
    }

    /**
     * @returns A stream of the values that pass the filter. Like {@link Array.filter}.
     * @param filter Whether the given value passes the filter. Return true to include the value in the returned Stream and false to not include it.
     */
    public filter(
        filter: (value: T, index: number, stream: this) => boolean
    ): Stream<T> {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self)
                if (filter(value, index, self)) yield value;
        });
    }

    /**
     * Groups the values in the Stream by the given key selector.
     * @param keySelector Specifies group to put each value in by the key it returns.
     * @returns A Stream over the groups. Each value is an Array where the first item is the group's key and the second item is the groups values.
     */
    public groupBy<K>(
        keySelector: (value: T, index: number, stream: this) => K
    ): Stream<[K, Streamable<T> & T[]]> {
        return Stream.from(() => {
            const groups = new Map<K, StreamableArray<T>>();

            let index = 0;
            for (const value of this) {
                const key = keySelector(value, index++, this);

                const group =
                    groups.get(key) ??
                    setAndGet(groups, key, new StreamableArray());

                group.push(value);
            }
            return groups;
        });
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

    public orderBy(getProperty: (value: T) => any): Stream<T> {
        return this.sort((a, b) =>
            smartCompare(getProperty(a), getProperty(b))
        );
    }

    public orderByDescending(getProperty: (value: T) => any): Stream<T> {
        return this.sort((a, b) =>
            smartCompare(getProperty(b), getProperty(a))
        );
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
    public takeWhile(test: (value: T, index: number, stream: this) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) {
                if (!test(value, index++, self)) break;
                yield value;
            }
        });
    }

    public skipWhile(test: (value: T, index: number, stream: this) => boolean) {
        const self = this;
        return Stream.iter(function* () {
            let index = 0;
            for (const value of self) if (test(value, index++, self)) break;
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

    public distinct(
        identifier: (value: T) => any = (value) => value
    ): Stream<T> {
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
        return this.filter((value) => value !== undefined) as any;
    }

    public nonNull(): Stream<T extends null ? never : T> {
        return this.filter((value) => value !== null) as any;
    }

    public undefined(): Stream<T extends undefined ? T : undefined> {
        return this.filter((value) => value === undefined) as any;
    }

    public null(): Stream<T extends null ? T : null> {
        return this.filter((value) => value === null) as any;
    }

    public nullableObjects(): Stream<
        T extends object | null ? T : object | null
    > {
        return this.filter((value) => typeof value === "object") as any;
    }

    public objects(): Stream<T extends object ? T : object> {
        return this.filter(
            (value) => value !== null && typeof value === "object"
        ) as any;
    }

    public numbers(): Stream<T extends number ? T : number> {
        return this.filter((value) => typeof value === "bigint") as any;
    }

    public bigints(): Stream<T extends bigint ? T : bigint> {
        return this.filter((value) => typeof value === "bigint") as any;
    }

    public strings(): Stream<T extends string ? T : string> {
        return this.filter((value) => typeof value === "string") as any;
    }

    public booleans(): Stream<T extends boolean ? T : boolean> {
        return this.filter((value) => typeof value === "boolean") as any;
    }

    public functions(): Stream<T extends Function ? T : Function> {
        return this.filter(
            (value) => typeof value === "function" || value instanceof Function
        ) as any;
    }

    public toArray(): T[] {
        return [...this];
    }

    public toSet(): Set<T> {
        return new Set(this);
    }

    public stream(): Stream<T> {
        return Stream.of(this.asArray());
    }

    public asArray(): readonly T[] {
        return asArray(this.getSource());
    }

    public asSet(): ReadonlySet<T> {
        return asSet(this.getSource());
    }

    public toMap<K, V>(
        keySelector: (value: T, index: number, stream: this) => K,
        valueSelector: (value: T, index: number, stream: this) => V
    ): Map<K, V> {
        const map = new Map<K, V>();

        let index = 0;
        for (const value of this) {
            map.set(
                keySelector(value, index, this),
                valueSelector(value, index, this)
            );
            index++;
        }

        return map;
    }

    public reduce<R>(
        reduction: (
            previousResult: R,
            current: T,
            index: number,
            stream: this
        ) => R,
        initialValue: R
    ): R;

    public reduce(
        reduction: (
            previousResult: T,
            current: T,
            index: number,
            stream: this
        ) => T
    ): T | undefined;

    public reduce(
        reduction: (
            previousResult: any,
            current: T,
            index: number,
            stream: this
        ) => any,
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
            result = reduction(result, next.value, index, this);
        }

        return result;
    }

    public includes(value: T): boolean {
        return includes(this.getSource(), value);
    }

    /** @returns Whether the Stream conains any value. */
    public some(): boolean;

    /** @returns Whether the stream contains any values that pass the given test. */
    public some(
        test: (value: T, index: number, stream: this) => boolean
    ): boolean;

    public some(
        test: (value: T, index: number, stream: this) => boolean = () => true
    ): boolean {
        let index = 0;
        for (const value of this) if (test(value, index++, this)) return true;
        return false;
    }

    /** @returns Whether the Stream is empty. */
    public none(): boolean;
    /** @returns Whether none of the values in the stream pass the given test. */
    public none(
        test: (value: T, index: number, stream: this) => boolean
    ): boolean;
    public none(
        test: (value: T, index: number, stream: this) => boolean = () => true
    ): boolean {
        return !this.some(test);
    }

    /** Whether all values in the Stream pass the given test. */
    public every(
        test: (value: T, index: number, stream: this) => boolean
    ): boolean {
        let index = 0;
        for (const value of this) if (!test(value, index++, this)) return false;
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

    public find(
        test: (value: T, index: number, stream: this) => boolean
    ): T | undefined {
        let index = 0;
        for (const value of this) if (test(value, index++, this)) return value;
        return undefined;
    }

    public findIndex(
        test: (value: T, index: number, stream: this) => boolean
    ): number | undefined {
        let index = 0;
        for (const value of this) {
            if (test(value, index, this)) return index;
            index++;
        }
        return undefined;
    }

    public indexOf(value: T): number | undefined {
        return this.findIndex((streamValue) => Object.is(value, streamValue));
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
}
