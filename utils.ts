import Stream from "./Stream";
import { and } from "./logic";
import { StreamableArray } from "./Streamable";

export function lazy<T>(getter: () => T): () => T {
    let lazyGetter = () => {
        let output: T;
        try {
            output = getter();
        } catch (e) {
            lazyGetter = () => {
                throw e;
            };
            throw e;
        }

        lazyGetter = () => output;
        return output;
    };

    return () => lazyGetter();
}

export function iter<T>(generatorGetter: () => Generator<T>) {
    return {
        [Symbol.iterator]: generatorGetter,
    };
}

export function empty<T>(): Iterable<T> {
    return iter(function* () {
        return;
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
    separator: string = ""
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
    return result.join();
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

export function setAndGet<K, MV, V extends MV>(
    map: Map<K, MV>,
    key: K,
    value: V & MV
): V {
    map.set(key, value);
    return value;
}

export function last<T>(collection: Iterable<T>) {
    if (isArray(collection)) {
        if (collection.length > 0) return collection[collection.length - 1];
        return undefined;
    }

    let last: T | undefined = undefined;
    for (const value of collection) last = value;
    return last;
}

export function at<T>(
    collection: Iterable<T>,
    index: number | bigint
): T | undefined {
    if (isArray(collection)) {
        const usableIndex = Math.trunc(Number(index));
        if (usableIndex < 0) return collection[collection.length + usableIndex];
        return collection[usableIndex];
    } else {
        const usableIndex = BigInt(index);
        if (usableIndex < 0) return at(reverse(collection), -usableIndex);

        let i = 0n;
        for (const value of collection) if (i++ === usableIndex) return value;
    }
}

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

function rateType(value: any) {
    if (value === null) return 8;
    if (Array.isArray(value)) return 2;

    switch (typeof value) {
        case "function":
            return 1;

        //case of array - 2

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

        //case of null - 8
    }
    return -1;
}
export interface SmartCompareOptions {
    compareObjects?: (
        a: Record<ObjectKey, any>,
        b: Record<ObjectKey, any>
    ) => number;
    compareArrays?: (a: readonly any[], b: readonly any[]) => number;
}

export function smartCompare(
    a: any,
    b: any,
    options: SmartCompareOptions = {}
): number {
    if (a === undefined) return 0;
    if (b === undefined) return 0;
    const typeRatingA = rateType(a);
    const typeRatingB = rateType(b);
    if (typeRatingA !== typeRatingB) return typeRatingA - typeRatingB;

    if (typeof a === "string") return a.localeCompare(`${b}`);
    if (typeof b === "string") return `${a}`.localeCompare(b);

    if (typeof a === "bigint" && typeof b === "bigint") return Number(a - b);

    if (
        (typeof a === "number" ||
            typeof a === "bigint" ||
            typeof a === "boolean" ||
            a == null) &&
        (typeof b === "number" ||
            typeof b === "bigint" ||
            typeof b === "boolean" ||
            b == null)
    )
        return asNumber(a) - asNumber(b);

    if (options.compareArrays !== undefined && isArray(a) && isArray(b))
        return options.compareArrays(a, b);

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
export type keySelector<T, K> = (value: T) => K;
export type Order<T> = keySelector<T, any> | Comparator<T>;

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
    keySelector: (value: T) => any
): Comparator<T> {
    return (a, b) => smartCompare(keySelector(a), keySelector(b));
}

export function compareByOrder<T>(a: T, b: T, order: Order<T>) {
    if (orderIsComparator(order)) return order(a, b);
    return smartCompare(order(a), order(b));
}

export function orderIsKeySelector<T>(
    order: Order<T>
): order is (value: T) => any {
    return !orderIsComparator(order);
}

export function orderIsComparator<T>(order: Order<T>): order is Comparator<T> {
    return order.length > 1;
}

export function multiCompare<T>(a: T, b: T, orders: Iterable<Order<T>>) {
    for (const order of orders) {
        const comp = compareByOrder(a, b, order);

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

export function asMap<T extends EntryLike<K, V>, K, V>(
    collection: Iterable<T>
): ReadonlyMap<K, V>;

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

export function append<T>(collection: Iterable<T>, value: T) {
    return iter(function* () {
        for (const value of collection) yield value;
        yield value;
    });
}

export function prepend<T>(collection: Iterable<T>, value: T) {
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

    console.log({ start, end, step });
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

export function getNonEnumeratedCountOrUndefined(
    collection: Iterable<any>
): number | undefined {
    if (isArray(collection)) return collection.length;
    if (isSet(collection)) return collection.size;
    if (collection instanceof Map) return collection.size;
    return undefined;
}

export function distinct<T>(collection: Iterable<T>): Iterable<T> {
    return iter(function* () {
        const returned = new Set<T>();
        for (const value of collection) {
            if (!returned.has(value)) {
                returned.add(value);
                yield value;
            }
        }
    });
}

export function intersect<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
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
                const sizeA = getNonEnumeratedCountOrUndefined(a);
                const sizeB = getNonEnumeratedCountOrUndefined(b);
                if (sizeA !== undefined && sizeB !== undefined) {
                    if (sizeA > sizeB) {
                        set = new Set(a);
                        iterable = b;
                    } else {
                        set = new Set(b);
                        iterable = a;
                    }
                } else {
                    set = new Set(b);
                    iterable = a;
                }
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
            const setOfExcluding = asSet(b);
            for (const value of a) if (!setOfExcluding.has(value)) yield value;
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
    int = (
        lowerBound: number | bigint,
        upperBound: number | bigint
    ): number => {
        const min = Number(lowerBound);
        const max = Number(upperBound);
        return Math.trunc(Math.random() * (max - min) + min);
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
            const index = this.int(0, size);
            return options.splice(index, 1)[0];
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
            "Options is neither an Array, Set, or a Map. This should not be possible unless the type system was ignored."
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
