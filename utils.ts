import Stream from "./Stream";
import { testDataPromise } from "./getTestData";
import { and } from "./logic";

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

export function isArray<T>(collection: Iterable<T>): collection is T[] {
    return Array.isArray(collection);
}

export function isSet<T>(collection: Iterable<T>): collection is Set<T> {
    return collection instanceof Set;
}

export function isMap<K, V>(collection: Iterable<EntryLike<K, V>>): collection is Map<K, V>{
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

export type ObjectKey = number | string | symbol;
export interface SmartCompareOptions {
    compareObjects?: (
        a: Record<ObjectKey, any>,
        b: Record<ObjectKey, any>
    ) => number;
    compareArrays?: (a: any[], b: any[]) => number;
}

export function smartCompare(
    a: any,
    b: any,
    options: SmartCompareOptions = {}
): number {
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
export type DeLiterall<T> = T extends number
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
