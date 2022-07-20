import Stream from "./Stream";
import { and } from "./logic";
import { StreamableArray } from "./Streamable";

/**
 * @returns Returns a function which returns the given value.
 */
export function eager<T>(result: T): () => T {
    return () => result;
}

/**
 * Creates a cached version of the given function.
 * @returns The cached version of the function. The original function is called once on the first call of the returned function and the result is cached. Subsequent calls return the cached result of the first call without calling the original function.
 *
 * Note that this function consideres both returns and throws as output. If the original function throws an error, the error will be cached, thrown, and thrown again on all subsequent calls without calling the original function.
 */
export function lazy<T>(getter: () => T): () => T {
    let resultGetter = () => {
        let output: T;
        try {
            output = getter();
        } catch (e) {
            resultGetter = () => {
                throw e;
            };
            throw e;
        }

        resultGetter = () => output;
        return output;
    };

    return () => resultGetter();
}

/** @returns An Iterable over the Generator from the given function */
export function iter<T>(generatorGetter: () => Generator<T>) {
    return {
        [Symbol.iterator]: generatorGetter,
    };
}

const emptyIterable = iter(function* () {
    return;
});

/** @returns An emtpy Iterable. */
export function empty<T>(): Iterable<T> {
    return emptyIterable;
}

export function map<T, R>(
    collection: Iterable<T>,
    mapping: (value: T, index: number) => R
): Iterable<R> {
    return iter(function* () {
        let index = 0;
        for (const value of collection) yield mapping(value, index++);
    });
}

export function filter<T>(collection: Iterable<T>, test: (value: T, index: number) => boolean): Iterable<T>;
export function filter<T>(
    collection: Iterable<T>,
    test: (value: T, index: number) => boolean
): Iterable<T> {
    return iter(function* () {
        let index = 0;
        for (const value of collection) if (test(value, index++)) yield value;
    });
}

export function concat<A, B>(a: Iterable<A>, b: Iterable<B>): Iterable<A | B> {
    return iter(function* () {
        for (const value of a) yield value;
        for (const value of b) yield value;
    });
}

export function combine<
    O1 extends Record<any, any>,
    O2 extends Record<any, any>
>(o1: O1, o2: O2): O1 & O2 {
    const result = { ...o1 } as Record<any, any>;

    for (const key in o2 as object) {
        result[key] = o2[key];
    }

    return result;
}

export function partialCopy<T>(o: T, toCopy: (keyof T)[]): any {
    const result: any = {};
    for (const key of toCopy) {
        if (Object.prototype.hasOwnProperty.call(o, key)) result[key] = o[key];
    }

    return result;
}

export function isIterable<T>(value: any): value is Iterable<unknown> {
    return typeof value?.[Symbol.iterator] === "function";
}

export function isArray<T>(
    collection: T[] | Set<T> | ReadonlySet<T>
): collection is T[];
export function isArray<T>(
    collection: Iterable<T>
): collection is T[] | readonly T[];
export function isArray<T>(
    collection: Iterable<T>
): collection is T[] | readonly T[] {
    return Array.isArray(collection);
}

export function isSet<T>(
    collection: T[] | readonly T[] | Set<T>
): collection is Set<T>;
export function isSet<T>(
    collection: Iterable<T>
): collection is Set<T> | ReadonlySet<T>;
export function isSet<T>(collection: Iterable<T>): boolean {
    return collection instanceof Set;
}

export function isMap<K, V>(
    collection:
        | Map<K, V>
        | EntryLike<K, V>[]
        | readonly EntryLike<K, V>[]
        | Set<EntryLike<K, V>>
        | ReadonlySet<EntryLike<K, V>>
): collection is Map<K, V>;
export function isMap<K, V>(
    collection: Iterable<EntryLike<K, V>>
): collection is Map<K, V> | ReadonlyMap<K, V>;
export function isMap<K, V>(collection: Iterable<EntryLike<K, V>>): boolean {
    return collection instanceof Map;
}

export function asArray<T>(collection: Iterable<T>): readonly T[] {
    if (isArray(collection)) {
        return collection;
    } else {
        return [...collection];
    }
}

export function asSet<T>(collection: Iterable<T>): ReadonlySet<T> {
    if (isSet(collection)) {
        return collection;
    } else {
        return new Set(collection);
    }
}

export function asSolid<T>(collection: Iterable<T>): ReadonlySolid<T> {
    if (isArray(collection)) return collection;
    if (isSet(collection)) return collection;
    if (collection instanceof Map) return collection as any;
    return [...collection];
}

export function includes<T>(collection: Iterable<T>, value: T) {
    if (isArray(collection)) return collection.includes(value);
    if (isSet(collection)) return collection.has(value);
    for (const collectionValue of collection)
        if (Object.is(value, collectionValue)) return true;
    return false;
}

export function join(
    collection: Iterable<any>,
    separator: string = ","
): string {
    if (isArray(collection)) return collection.join(separator);

    const result: string[] = [];
    const iterator = collection[Symbol.iterator]();
    let next = iterator.next();
    if (next.done) return "";
    result.push(next.value);

    while (!(next = iterator.next()).done) {
        result.push(separator);
        result.push(next.value);
    }
    return result.join("");
}

/** Signal for breaking out of a loop. */
export const breakSignal = Symbol("breakSignal");

export function forEach<T>(
    collection: Iterable<T>,
    callback: (value: T, index: number) => Symbol | void
): void {
    let index = 0;
    for (const value of collection) {
        if (callback(value, index++) === breakSignal) break;
    }
}

export function numberComparator(a: number, b: number): number {
    return a - b;
}

export function bigintComparator(a: bigint, b: bigint): number {
    return Number(a - b);
}

/** Adds the key and value to the map and the returns the value */
export function setAndGet<K, MV, V extends MV>(
    map: Map<K, MV>,
    key: K,
    value: V & MV
): V {
    map.set(key, value);
    return value;
}

/**
 * @returns The last value in the given Iterable.
 */
export function last<T>(collection: Iterable<T>) {
    if (isArray(collection)) {
        if (collection.length > 0) return collection[collection.length - 1];
        return undefined;
    }

    let last: T | undefined = undefined;
    for (const value of collection) last = value;
    return last;
}

/** @returns The value at the given index from the start of the given Iterable or the value at the given negative index from the end of the given Iterable (0 returns the first value, -1 returns the last value, -2 returns the second to last value, etc.).*/
export function at<T>(
    collection: Iterable<T>,
    index: number | bigint
): T | undefined {
    if (isArray(collection)) {
        const numberIndex = Math.trunc(Number(index));
        if (numberIndex < 0) return collection[collection.length + numberIndex];
        return collection[numberIndex];
    } else {
        const numberIndex = Number(index);
        if (numberIndex < 0) {
            const array = [...collection];
            return array[array.length - numberIndex];
        }
        const bigintIndex = BigInt(index);

        let i = 0n;
        for (const value of collection) if (i++ >= bigintIndex) return value;
    }
}

/** @returns An Iterable over the given Iterable in reverse order. */
export function reverse<T>(collection: Iterable<T>): Iterable<T> {
    return iter(function* () {
        const array = asArray(collection);
        for (let i = array.length - 1; i >= 0; i--) yield array[i];
    });
}

export function count(collection: Iterable<any>): number {
    if (isArray(collection)) return collection.length;
    if (isSet(collection)) return collection.size;
    if (collection instanceof Map) return collection.size;

    let size = 0;
    for (const _ of collection) size++;
    return size;
}
export type ValueOf<T> = T[keyof T];

export function asNumber(
    value: boolean | number | bigint | null | undefined
): number {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value == null) return 0;
    return Number(value);
}

export type ObjectKey = number | string | symbol;

export interface SmartCompareOptions {
    compareObjects?: (
        a: Record<ObjectKey, any>,
        b: Record<ObjectKey, any>
    ) => number;
    compareArrays?: (a: readonly any[], b: readonly any[]) => number;
}

/** Compares two values in a way that makes more sense the default of {@link Array.sort}, which just compares by their ascii string values. Unlike {@link Array.sort}'s default comparison, This comparison function compares numbers by returning their difference. */
export function smartCompare(
    a: any,
    b: any,
    options: SmartCompareOptions = {}
): number {
    function rateType(value: any) {
        if (value === null) return 8;
        if (Array.isArray(value)) return 2;

        switch (typeof value) {
            case "function":
                return 1;

            // array - 2

            case "object":
                return 3;
            case "symbol":
                return 4;
            case "boolean":
                return 5;

            case "number":
                return 6;
            case "bigint":
                return 6;

            case "string":
                return 7;

            // null - 8

            // Array.sort doesn't actually sort undefined values. It just puts all the undefineds at the end of the array even if the comparator says otherwise.
            // So I guess I'll just have to agree with Array.sort here
            case "undefined":
                return 9;
        }
        return -1;
    }
    // firts sort by type
    const typeRatingA = rateType(a);
    const typeRatingB = rateType(b);
    if (typeRatingA !== typeRatingB) return typeRatingA - typeRatingB;

    // then value

    // numeric
    if (typeof a === "number") {
        if (typeof b === "number") return a - b;
        if (typeof b === "bigint") return a - Number(b);
    } else if (typeof a === "bigint") {
        if (typeof b === "number") return Number(a) - b;
        if (typeof b === "bigint") return Number(a - b);
    }

    // arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (options.compareArrays !== undefined)
            return options.compareArrays(a, b);
        else return a.length - b.length;
    }

    if (
        options.compareObjects !== undefined &&
        typeof a === "object" &&
        a !== null &&
        typeof b === "object" &&
        b !== null
    )
        return options.compareObjects(a, b);

    return `${a}`.localeCompare(`${b}`);
}

export type Comparator<T> = (a: T, b: T) => number;
export type KeySelector<T, K> = (value: T) => K;
export type Order<T> = KeySelector<T, any> | Comparator<T>;

export function reverseOrder<T>(order: Order<T>): Comparator<T> {
    if (orderIsComparator(order)) {
        return (a, b) => order(b, a);
    } else {
        return (a, b) => keySelectorToComparator(order)(b, a);
    }
}

export function orderAsComparator<T>(
    order: Order<T>
): typeof order extends Comparator<T> ? typeof order : Comparator<T> {
    if (orderIsComparator(order)) return order;
    return keySelectorToComparator(order);
}

export function keySelectorToComparator<T>(
    keySelector: KeySelector<T, any>
): Comparator<T> {
    return (a, b) => compareByKeySelector(keySelector, a, b);
}

export function compareByOrder<T>(order: Order<T>, a: T, b: T) {
    if (orderIsComparator(order)) return order(a, b);
    return compareByKeySelector(order, a, b);
}

export function compareByKeySelector<T>(
    keySelector: KeySelector<T, any>,
    a: T,
    b: T
) {
    return smartCompare(keySelector(a), keySelector(b));
}

export function orderIsKeySelector<T>(
    order: Order<T>
): order is KeySelector<T, any> {
    return !orderIsComparator(order);
}

export function orderIsComparator<T>(order: Order<T>): order is Comparator<T> {
    return order.length > 1;
}

export function multiCompare<T>(a: T, b: T, orders: Iterable<Order<T>>) {
    for (const order of orders) {
        const comp = compareByOrder(order, a, b);

        if (comp !== 0) return comp;
    }
    return 0;
}

export function merge<A, B>(a: Iterable<A>, b: Iterable<B>): Iterable<A | B> {
    return iter(function* () {
        const iterA = a[Symbol.iterator]();
        const iterB = b[Symbol.iterator]();
        let nextA;
        let nextB;

        while (and(!(nextA = iterA.next()), !(nextB = iterB.next()))) {
            yield nextA.value as A;
            yield nextB.value as B;
        }

        if (nextA?.done === false) {
            do {
                yield nextA.value as A;
            } while (!(nextA = iterA.next()).done);
        } else if (nextB?.done === false) {
            do {
                yield nextB.value as B;
            } while (!(nextB = iterB.next()).done);
        }
    });
}

// about literal types https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types
export type DeLiteral<T> = T extends number
    ? number
    : T extends string
    ? string
    : T extends boolean
    ? boolean
    : T;

export type EntryLike<K, V> =
    | [K, V, ...any]
    | { 0: K; 1: V; [key: ObjectKey]: any };
export type EntryLikeKey<K> = [K, ...any] | { 0: K; [key: ObjectKey]: any };
export type EntryLikeValue<V> =
    | [any, V, ...any]
    | { 1: V; [key: ObjectKey]: any };

export function asMap<T>(
    collection: Iterable<T>
): T extends EntryLike<infer K, infer V>
    ? ReadonlyMap<K, V>
    : T extends EntryLikeKey<infer K>
    ? ReadonlyMap<K, unknown>
    : T extends EntryLikeValue<infer V>
    ? ReadonlyMap<unknown, V>
    : ReadonlyMap<unknown, unknown>;

export function asMap<T extends EntryLikeValue<V>, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): ReadonlyMap<K, V>;

export function asMap<T extends EntryLikeKey<K>, K, V>(
    collection: Iterable<T>,
    keySelector: undefined,
    valueSelector: (value: T, index: number) => V
): ReadonlyMap<K, V>;

export function asMap<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): ReadonlyMap<K, V>;

export function asMap<T, K, V>(
    collection: Iterable<T>,
    keySelector?: (value: T, index: number) => K,
    valueSelector?: (value: T, index: number) => V
): Map<K, V> {
    if (
        collection instanceof Map &&
        keySelector === undefined &&
        valueSelector === undefined
    )
        return collection;

    return toMap(collection, keySelector as any, valueSelector as any);
}

export function toMap<T extends EntryLike<K, V>, K, V>(
    collection: Iterable<T>
): Map<K, V>;

export function toMap<T extends EntryLikeValue<V>, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): Map<K, V>;

export function toMap<T extends EntryLikeKey<K>, K, V>(
    collection: Iterable<T>,
    keySelector: undefined,
    valueSelector: (value: T, index: number) => V
): Map<K, V>;

export function toMap<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Map<K, V>;

export function toMap<T, K, V>(
    collection: Iterable<T>,
    keySelector?: (value: T, index: number) => K,
    valueSelector?: (value: T, index: number) => V
): Map<K, V> {
    const map = new Map<K, V>();
    const keyS = keySelector ?? (value => (value as any)?.[0]);
    const valueS = valueSelector ?? (value => (value as any)?.[1]);

    let index = 0;
    for (const value of collection) {
        map.set(keyS(value, index), valueS(value, index));
        index++;
    }

    return map;
}

export function append<T>(collection: Iterable<T>, value: T): Iterable<T> {
    return iter(function* () {
        for (const value of collection) yield value;
        yield value;
    });
}

export function prepend<T>(collection: Iterable<T>, value: T): Iterable<T> {
    return iter(function* () {
        yield value;
        for (const value of collection) yield value;
    });
}

/** Performs a fisher-yates shuffle on the array (in-place). */
export function shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.trunc(Math.random() * (i + 1));

        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

export function shuffled<T>(collection: Iterable<T>): Iterable<T> {
    const array = [...collection];
    shuffle(array);
    return array;
}

export function range(
    start: bigint,
    end: bigint,
    step: bigint
): Iterable<bigint>;
export function range(start: bigint, end: bigint): Iterable<bigint>;
export function range(end: bigint): Iterable<bigint>;

export function range(
    start: number | bigint,
    end: number | bigint,
    step: number | bigint
): Iterable<number>;
export function range(
    start: number | bigint,
    end: number | bigint
): Iterable<number>;
export function range(end: number | bigint): Iterable<number>;

export function range(_startOrEnd: any, _end?: any, _step?: any): any {
    const useNumber =
        typeof _startOrEnd === "number" ||
        typeof _end === "number" ||
        typeof _step === "number";

    const ZERO = useNumber ? 0 : (0n as any);
    const ONE = useNumber ? 1 : (1n as any);

    let start: any;
    let end: any;
    let step: any;
    if (_step !== undefined) {
        start = _startOrEnd;
        end = _end;
        step = _step;
    } else if (_end !== undefined) {
        start = _startOrEnd;
        end = _end;
        step = ONE;
    } else {
        start = ZERO;
        end = _startOrEnd;
        step = ONE;
    }

    if (useNumber) {
        start = Number(start);
        end = Number(end);
        step = Number(step);
    }

    if (step === ZERO) throw new Error("Step must not be zero.");

    if (step < ZERO && start < end) return empty();
    if (step > ZERO && start > end) return empty();

    const test = step > ZERO ? (i: any) => i < end : (i: any) => i > end;

    return iter(function* () {
        for (let i = start; test(i); i += step) yield i;
    });
}

export function generate<T>(
    from: (index: number) => T,
    length: number | bigint
) {
    const usableLength = Number(length);
    return iter(function* () {
        for (let i = 0; i < usableLength; i++) yield from(i);
    });
}

export function including<T>(
    collection: Iterable<T>,
    other: Iterable<T>
): Iterable<T> {
    return iter(function* () {
        const remaining = new Set(other);
        for (const value of collection) {
            remaining.delete(value);
            yield value;
        }

        for (const value of remaining) yield value;
    });
}

export function excluding<T>(
    collection: Iterable<T>,
    other: Iterable<T>
): Iterable<T> {
    return iter(function* () {
        const setOfExcluding = asSet(other);
        for (const value of collection)
            if (!setOfExcluding.has(value)) yield value;
    });
}

export function indexBy<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): Map<K, T>;
export function indexBy<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Map<K, V>;

export function indexBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => any = value => value
) {
    const index = new Map<K, any>();

    let i = 0;
    for (const value of collection) {
        index.set(keySelector(value, i), valueSelector(value, i));
        i++;
    }
    return index;
}

export function groupBy<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Map<K, StreamableArray<V>>;

export function groupBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): Map<K, StreamableArray<T>>;

export function groupBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => any = value => value
): Map<K, StreamableArray<any>> {
    const groups = new Map<K, StreamableArray<any>>();

    let index = 0;
    for (const value of collection) {
        const key = keySelector(value, index);

        const group =
            groups.get(key) ??
            setAndGet(groups, key, new StreamableArray<any>());

        group.push(valueSelector(value, index));
        index++;
    }

    return groups;
}

export function groupJoin<O, I, K, R>(
    outer: Iterable<O>,
    inner: Iterable<I>,
    outerKeySelector: (value: O) => K,
    innerKeySelector: (value: I) => K,
    resultSelector: (outer: O, inner: Iterable<I>) => R
): Iterable<R> {
    return iter(function* () {
        const innerGrouped = groupBy(inner, innerKeySelector);
        let index = 0;
        for (const outerValue of outer) {
            const key = outerKeySelector(outerValue);
            const inner = innerGrouped.get(key);
            yield resultSelector(outerValue, inner ?? []);
        }
    });
}

export function getNonIteratedCountOrUndefined(
    collection: Iterable<any>
): number | undefined {
    if (isArray(collection)) return collection.length;
    if (isSet(collection)) return collection.size;
    if (collection instanceof Map) return collection.size;
    return undefined;
}

export function distinct<T>(
    collection: Iterable<T>,
    identifier: (value: T) => any = value => value
): Iterable<T> {
    return iter(function* () {
        const returned = new Set<any>();
        for (const value of collection) {
            const id = identifier(value);
            if (!returned.has(id)) {
                returned.add(id);
                yield value;
            }
        }
    });
}

export function intersection<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
    return distinct(
        iter(function* () {
            let set: ReadonlySet<T>, iterable: Iterable<T>;
            if (isSet(a) && isSet(b)) {
                if (a.size > b.size) {
                    set = a;
                    iterable = b;
                } else {
                    set = b;
                    iterable = a;
                }
            } else if (isSet(a)) {
                set = a;
                iterable = b;
            } else if (isSet(b)) {
                set = b;
                iterable = a;
            } else {
                const sizeA = getNonIteratedCountOrUndefined(a);
                const sizeB = getNonIteratedCountOrUndefined(b);
                let other: Iterable<T>;
                if (sizeA !== undefined && sizeB !== undefined) {
                    if (sizeA > sizeB) {
                        other = a;
                        iterable = b;
                    } else {
                        other = b;
                        iterable = a;
                    }
                } else {
                    other = b;
                    iterable = a;
                }
                const iter = other[Symbol.iterator]();
                let next;

                const cache = new Set<T>();

                for (const value of iterable) {
                    if (cache.has(value)) yield value;

                    while (!(next = iter.next()).done) {
                        cache.add(next.value);
                        if (Object.is(value, next.value)) {
                            yield value;
                            break;
                        }
                    }
                }

                return;
            }

            for (const value of iterable) if (set.has(value)) yield value;
        })
    );
}

export function union<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
    return distinct(concat(a, b));
}

export function difference<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
    return distinct(
        iter(function* () {
            const bSet = asSet(b);
            for (const value of a) if (!bSet.has(value)) yield value;
        })
    );
}

export function getNonIteratedCount(
    collection: readonly any[] | ReadonlySet<any> | ReadonlyMap<any, any>
): number {
    if (isArray(collection)) return collection.length;
    return collection.size;
}

export class Random {
    // one day, I'll add a seed parameter to this class.
    range = (
        lowerBound: number | bigint,
        upperBound: number | bigint
    ): number => {
        const min = Number(lowerBound);
        const max = Number(upperBound);
        return Math.random() * (max - min) + min;
    };

    int = (
        lowerBound: number | bigint,
        upperBound: number | bigint
    ): number => {
        return Math.trunc(this.range(lowerBound, upperBound));
    };

    choice = <T>(options: ReadonlySolid<T>): T => {
        const size = getNonIteratedCount(options);
        if (size === 0) throw new Error("no options to choose from");
        return at(options, this.int(0, size))!;
    };

    chooseAndRemove = <T>(
        options:
            | T[]
            | Set<T>
            | (T extends [infer K, infer V] ? Map<K, V> : never)
    ): T => {
        const size = getNonIteratedCount(options);
        if (size === 0) throw new Error("no options to choose from");
        if (Array.isArray(options)) {
            return options.splice(this.int(0, size), 1)[0];
        } else if (options instanceof Set) {
            const result = at(options, this.int(0, size))!;
            options.delete(result);
            return result;
        } else if (options instanceof Map) {
            const result = at(options, this.int(0, size))!;
            options.delete(result?.[0]);
            return result as any;
        }
        throw new Error(
            "Options is neither an Array, Set, or Map. This should not be possible unless the type system was ignored."
        );
    };
}

export const random = new Random();

export function isSolid<T>(
    collection: Iterable<T>
): collection is Solid<T> | ReadonlySolid<T> {
    return (
        Array.isArray(collection) ||
        collection instanceof Set ||
        collection instanceof Map
    );
}

export type ReadonlySolid<T> =
    | readonly T[]
    | ReadonlySet<T>
    | (T extends [infer K, infer V] ? ReadonlyMap<K, V> & Iterable<T> : never);

export type Solid<T> =
    | T[]
    | Set<T>
    | (T extends [infer K, infer V] ? Map<K, V> & Iterable<T> : never);

export function alternating<T>(
    collection: Iterable<T>,
    interval: number | bigint = 2n
): Iterable<T> {
    const usableInterval = BigInt(interval);
    if (usableInterval < 0)
        throw new Error(
            `interval must be 0 or greater but ${interval} was given`
        );

    if (usableInterval === 0n) return empty<T>();

    if (isArray(collection)) {
        return iter(function* () {
            const resultSize = BigInt(collection.length) / usableInterval;
            const numberInterval = Number(usableInterval);

            for (let i = 0; i < resultSize; i++)
                yield collection[i * numberInterval];
        });
    } else {
        return iter(function* () {
            let i = 0n;
            for (const value of collection) {
                if (i++ % usableInterval === 0n) yield value;
            }
        });
    }
}

export function alternatingSkip<T>(
    collection: Iterable<T>,
    interval: number | bigint = 2n
): Iterable<T> {
    const usableInterval = BigInt(interval);
    if (usableInterval < 0)
        throw new Error(
            `interval must be 0 or greater but ${interval} was given`
        );

    if (usableInterval === 0n) return collection;

    return iter(function* () {
        let i = 0n;
        for (const value of collection) {
            if (i++ % usableInterval !== 0n) yield value;
        }
    });
}

export function skipSparse<T>(collection: Iterable<T>, count: number | bigint) {
    const usableCount = BigInt(count);
    if (count < 0)
        throw new Error(`count must be 0 or greater but ${count} was given`);

    if (count === 0) return collection;

    const array = [...collection];
    const toSkip = new Set(takeSparse(range(array.length), usableCount));

    return filter(array, (_, index) => !toSkip.has(index));
}

/**
 * Takes a specified number of values from the collection, spread out from the start to the end.
 * @param count How many values to take.
 * @returns An Iterable over the values spread out accross the collection.
 */
export function takeSparse<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    const usableCount = BigInt(count);
    if (count < 0)
        throw new Error(`count must be 0 or greater but ${count} was given`);

    if (count === 0) return Stream.empty<T>();

    const solid = asSolid(collection);
    const sourceLength = getNonIteratedCount(solid);
    return take(
        alternating(solid, BigInt(sourceLength) / usableCount),
        usableCount
    );
}

export function take<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    const bigintCount = BigInt(count);
    if (count < 0n) return take(reverse(collection), -count);

    return iter(function* () {
        let i = 0n;
        for (const value of collection) {
            if (i++ >= bigintCount) break;
            yield value;
        }
    });
}
