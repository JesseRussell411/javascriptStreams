import Stream, { isStream } from "./Stream";
import { and, or } from "./logic";
import { StreamableArray } from "./Streamable";
import { toASCII } from "punycode";
import { isNumberObject } from "util/types";
import { groupCollapsed } from "console";

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
 * Note that this function considers both returns and throws as output. If the original function throws an error, the error will be cached, thrown, and thrown again on all subsequent calls without calling the original function.
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

/**
 * @returns An Iterable over the given Iterator. The output of the Iterable is lazily cached. This means that the first time it's iterated is the only time the Iterator is iterated. After this the cached output of the Iterator is what's iterated
 */
export function lazyCacheIterator<T>(iterator: Iterator<T>): Iterable<T> {
    const cache: T[] = [];
    let done = false;

    return iter(function* () {
        yield* cache;

        if (done) return;

        let next: IteratorResult<T, unknown>;
        while (!(next = iterator.next()).done) {
            cache.push(next.value);
            yield next.value;
        }

        done = true;
    });
}

/**
 * @returns A cached Iterable over the given Iterable. The output of the Iterable is lazily cached. This means that the first time it's iterated is the only time the given Iterable is iterated. After this the cached output of the Iterable is what's iterated
 */
export function lazyCacheIterable<T>(iterable: Iterable<T>): Iterable<T> {
    return lazyCacheIterator(iterable[Symbol.iterator]());
}

/** @returns An Iterable over the Generator from the given function */
export function iter<T>(generatorGetter: () => Generator<T>): Iterable<T> {
    return {
        [Symbol.iterator]: generatorGetter,
    };
}

const emptyIterable = iter(function* () {
    return;
});

/** @returns An empty Iterable. */
export function empty<T>(): Iterable<T> {
    return emptyIterable;
}

export function map<T, R>(
    collection: Iterable<T>,
    mapping: (value: T, index: number) => R
): Iterable<R> {
    if (isArray(collection)) {
        return iter(function* () {
            // take advantage of faster iteration if possible
            for (let i = 0; i < collection.length; i++)
                yield mapping(collection[i]!, i);
        });
    } else {
        return iter(function* () {
            let index = 0;
            for (const value of collection) yield mapping(value, index++);
        });
    }
}

export function filter<T, R extends T = T>(
    collection: Iterable<T>,
    test: (value: T, index: number) => boolean
): Iterable<R>;
export function filter<T>(
    collection: Iterable<T>,
    test: (value: T, index: number) => boolean
): Iterable<T> {
    if (isArray(collection)) {
        // take advantage of faster iteration if possible
        return iter(function* () {
            for (let i = 0; i < collection.length; i++) {
                const value = collection[i]!;
                if (test(value, i)) yield value;
            }
        });
    } else {
        return iter(function* () {
            let index = 0;
            for (const value of collection)
                if (test(value, index++)) yield value;
        });
    }
}

export type BreakSignal = Symbol;
/** Signal for breaking out of a loop. */
export const breakSignal: BreakSignal = Symbol("break signal");

export function forEach<T>(
    collection: Iterable<T>,
    callback: (value: T, index: number) => BreakSignal | void
): void {
    if (isArray(collection)) {
        let index = 0;
        // take advantage of faster iteration if possible
        for (let i = 0; i < collection.length; i++) {
            if (callback(collection[i]!, index++) === breakSignal) break;
        }
    } else {
        let index = 0;
        for (const value of collection) {
            if (callback(value, index++) === breakSignal) break;
        }
    }
}

export function concat<A, B>(a: Iterable<A>, b: Iterable<B>): Iterable<A | B> {
    return iter(function* () {
        yield* a;
        yield* b;
    });
}

export function partialCopy<T>(o: T, toCopy: (keyof T)[]): any {
    const result: any = {};
    for (const key of toCopy) {
        if (Object.prototype.hasOwnProperty.call(o, key)) result[key] = o[key];
    }

    return result;
}

export function isIterable(value: any): value is Iterable<unknown> {
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
    if (isStream(collection)) return collection.asSolid();

    return [...collection];
}

export function includes<T>(collection: Iterable<T>, value: T) {
    if (isSet(collection)) return collection.has(value);
    if (isArray(collection)) return collection.includes(value);
    for (const collectionValue of collection)
        if (Object.is(value, collectionValue)) return true;
    return false;
}

export function join(collection: Iterable<any>, separator: any = ","): string {
    const sepString = `${separator}`;

    if (typeof collection === "string" && sepString === "") return collection;

    if (isArray(collection)) return collection.join(sepString);

    const result: string[] = [];
    const iterator = collection[Symbol.iterator]();

    let next = iterator.next();
    if (next.done) return "";
    result.push(next.value);

    while (!(next = iterator.next()).done) {
        result.push(sepString);
        result.push(next.value);
    }
    return result.join("");
}

export function mkString(collection: Iterable<any>, separator?: any): string;

export function mkString(
    collection: Iterable<any>,
    start: any,
    separator: any,
    end?: any
): string;

export function mkString(
    collection: Iterable<any>,
    arg1: any = "",
    arg2: any = "",
    arg3: any = ""
): string {
    if (arguments.length > 2) {
        return `${arg1}${join(collection, `${arg2}`)}${arg3}`;
    } else {
        return join(collection, `${arg1}`);
    }
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
 * @throws If the Stream is empty.
 */
export function last<T>(collection: Iterable<T>): T {
    function throwEmptyError() {
        throw new Error("collection has no last value because it is empty");
    }
    if (isArray(collection)) {
        if (collection.length > 0) return collection[collection.length - 1]!;
        else throwEmptyError();
    }

    const iter = collection[Symbol.iterator]();
    let next = iter.next();

    if (next.done) throwEmptyError();

    let last: T = next.value;
    while (!(next = iter.next()).done) last = next.value;
    return last;
}

/**
 * @returns The last value in the given Iterable or undefined if the Stream is empty.
 */
export function lastOrUndefined<T>(collection: Iterable<T>): T | undefined {
    return lastOrDefault(collection, () => undefined);
}

/**
 * @returns The last value in the given Iterable or the default value if the Stream is empty.
 */
export function lastOrDefault<T, D>(
    collection: Iterable<T>,
    getDefault: () => D
): T | D {
    if (isArray(collection)) {
        if (collection.length > 0) return collection[collection.length - 1]!;
        else return getDefault();
    }

    const iter = collection[Symbol.iterator]();
    let next = iter.next();

    if (next.done) return getDefault();

    let last: T = next.value;
    while (!(next = iter.next()).done) last = next.value;
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
        for (let i = array.length - 1; i >= 0; i--) yield array[i]!;
    });
}

export function indexOf<T>(
    collection: Iterable<T>,
    value: T,
    fromIndex?: number | bigint
): number | undefined {
    if (isArray(collection)) {
        const result = collection.indexOf(
            value,
            fromIndex === undefined ? undefined : Number(fromIndex)
        );
        if (result === -1) return undefined;
        return result;
    }

    if (fromIndex !== undefined && fromIndex > 0) {
        const result = indexOf(skip(collection, fromIndex), value);
        if (result === undefined) return undefined;
        return result + Number(fromIndex);
    }

    let index = 0;
    for (const collectionValue of collection) {
        if (Object.is(value, collectionValue)) return index;
        index++;
    }
    return undefined;
}

export function count(collection: Iterable<any>): number {
    if (Array.isArray(collection)) return collection.length;
    if (collection instanceof Set) return collection.size;
    if (collection instanceof Map) return collection.size;

    let size = 0;
    for (const _ of collection) size++;
    return size;
}

export type ValueOf<T> = T[keyof T];

export type Difference<T, Exclude> = T extends Exclude ? never : T;
export type Intersection<A, B> = A extends B ? A : never;

export type KeyOfArray<T extends readonly any[] | any[]> = Intersection<
    keyof T,
    number
>;

export type ValueOfArray<T extends readonly any[] | any[]> = T[KeyOfArray<T>];

export type DigitCharacter =
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9";
export type IntCharacter = DigitCharacter | "-";
export type NumberCharacter = IntCharacter | ".";
export type WhitespaceCharacter = " " | "\n" | "\t" | "\r" | "\v" | "\f";
export type IsWhitespaceOnly<T> = T extends WhitespaceCharacter
    ? true
    : T extends `${WhitespaceCharacter}${infer Rest}`
    ? IsWhitespaceOnly<Rest>
    : false;

export type Includes<
    Haystack extends string,
    Needle extends string | number | bigint | boolean | null | undefined
> = Haystack extends `${string}${Needle}${string}` ? true : false;

export type IsStringLiteral<T> = T extends `${infer _}` ? true : false;
export type IsNumberLiteral<T> = T extends number
    ? `${T}` extends `${NumberCharacter}${infer _}`
        ? true
        : false
    : false;

export type IsBigIntLiteral<T> = T extends bigint
    ? `${T}` extends `${IntCharacter}${infer _}`
        ? true
        : false
    : false;

export type IsLiteral<T> = IsStringLiteral<T> extends true
    ? true
    : IsNumberLiteral<T> extends true
    ? true
    : IsBigIntLiteral<T> extends true
    ? true
    : false;

export function asNumber(
    value: boolean | number | bigint | null | undefined
): number {
    if (value === undefined) return 0;
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

/** Compares two values in a way that makes more sense than the default of {@link Array.sort}, which just compares by their ascii string values. Unlike {@link Array.sort}'s default comparison, This comparison function compares numbers by returning their difference. */
export function smartCompare(a: any, b: any): number {
    function rateType(value: any) {
        if (value === null) return 8;
        if (Array.isArray(value)) return 2;

        switch (typeof value) {
            case "function":
                return 1;

            // array -- 2

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

            // null -- 8

            // Array.sort doesn't actually sort undefined values. It just puts all the undefineds at the end of the array even if the comparator says otherwise.
            // So I guess I'll just have to agree with Array.sort here
            case "undefined":
                return 9;
        }
        return -1;
    }

    // first sort by type
    const typeRatingA = rateType(a);
    const typeRatingB = rateType(b);
    if (typeRatingA !== typeRatingB) return typeRatingA - typeRatingB;

    // then by value

    // numeric
    if (typeof a === "number") {
        if (typeof b === "number") return a - b;
        if (typeof b === "bigint") return a - Number(b);
    } else if (typeof a === "bigint") {
        if (typeof b === "number") return Number(a) - b;
        if (typeof b === "bigint") return Number(a - b);
    }

    // boolean
    if (typeof a === "boolean" && typeof b === "boolean") {
        if (a === b) return 0;
        if (a) return 1;
        return -1;
    }

    // arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length - b.length;
    }

    // objects
    if (
        typeof a === "object" &&
        a !== null &&
        typeof b === "object" &&
        b !== null
    ) {
        return Object.values(a).length - Object.values(b).length;
    }

    // if nothing else fits, then compare by string values.
    return `${a}`.localeCompare(`${b}`);
}

export type Comparator<T> = (a: T, b: T) => number;
export type KeySelector<T, K> = (value: T) => K;
export type Order<T> = KeySelector<T, any> | Comparator<T>;

export function reverseOrder<T>(order: Order<T>): Comparator<T> {
    const comparator = orderAsComparator(order);
    return (a, b) => comparator(b, a);
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

export function flat<SubT>(
    collection: Iterable<Iterable<SubT>>
): Iterable<SubT> {
    return iter(function* () {
        for (const value of collection) {
            yield* value;
        }
    });
}

export function zipperMerge<A, B>(
    a: Iterable<A>,
    b: Iterable<B>
): Iterable<A | B> {
    return iter(function* () {
        const iterA = a[Symbol.iterator]();
        const iterB = b[Symbol.iterator]();
        let nextA: IteratorResult<A>;
        let nextB: IteratorResult<B>;

        while (
            and(!(nextA = iterA.next()).done, !(nextB = iterB.next()).done)
        ) {
            yield nextA.value as A;
            yield nextB.value as B;
        }

        if (nextA.done === false) {
            do {
                yield nextA.value as A;
            } while (!(nextA = iterA.next()).done);
        } else if (nextB.done === false) {
            do {
                yield nextB.value as B;
            } while (!(nextB = iterB.next()).done);
        }
    });
}

export function equalLengthZipperMerge<A, B>(
    a: Iterable<A>,
    b: Iterable<B>
): Iterable<A | B> {
    return iter(function* () {
        const iterA = a[Symbol.iterator]();
        const iterB = b[Symbol.iterator]();
        let nextA: IteratorResult<A, A>;
        let nextB: IteratorResult<B, B>;
        while (
            and(!(nextA = iterA.next()).done, !(nextB = iterB.next()).done)
        ) {
            yield nextA.value;
            yield nextB.value;
        }
    });
}

export function looseMerge<A, B>(
    a: Iterable<A>,
    b: Iterable<B>
): [A | undefined, B | undefined];

export function looseMerge<A, B, R>(
    a: Iterable<A>,
    b: Iterable<B>,
    merger: (a: A | undefined, b: B | undefined) => R
): Iterable<R>;

export function looseMerge<A, B>(
    a: Iterable<A>,
    b: Iterable<B>,
    merger: (a: A | undefined, b: B | undefined) => any = (a, b) => [a, b]
): any {
    return iter(function* () {
        const iterA = a[Symbol.iterator]();
        const iterB = b[Symbol.iterator]();
        let nextA: IteratorResult<A>;
        let nextB: IteratorResult<B>;

        while (or(!(nextA = iterA.next()).done, !(nextB = iterB.next()).done)) {
            yield merger(nextA.value, nextB.value);
        }
    });
}

export function merge<A, B>(a: Iterable<A>, b: Iterable<B>): Iterable<[A, B]>;

export function merge<A, B, R>(
    a: Iterable<A>,
    b: Iterable<B>,
    merger: (a: A, b: B) => R
): Iterable<R>;

export function merge<A, B>(
    a: Iterable<A>,
    b: Iterable<B>,
    merger: (a: A, b: B) => any = (a, b) => [a, b]
): any {
    return iter(function* () {
        const iterA = a[Symbol.iterator]();
        const iterB = b[Symbol.iterator]();
        let nextA: IteratorResult<A>;
        let nextB: IteratorResult<B>;

        while (
            and(!(nextA = iterA.next()).done, !(nextB = iterB.next()).done)
        ) {
            yield merger(nextA.value, nextB.value);
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
        yield* collection;
        yield value;
    });
}

export function prepend<T>(collection: Iterable<T>, value: T): Iterable<T> {
    return iter(function* () {
        yield value;
        yield* collection;
    });
}

/** Performs a fisher-yates shuffle on the array (in-place). */
export function shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.trunc(Math.random() * (i + 1));

        const temp = array[i]!;
        array[i] = array[j]!;
        array[j] = temp;
    }
}

export function shuffledToArray<T>(collection: Iterable<T>): T[] {
    const array = [...collection];
    shuffle(array);
    return array;
}

export function shuffled<T>(collection: Iterable<T>): Iterable<T> {
    return iter(function* () {
        yield* shuffledToArray(collection);
    });
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

    if (step === ZERO) throw new Error("arg3 must not be zero");

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

        yield* remaining;
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
): Map<K, V[]>;

export function groupBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): Map<K, T[]>;

export function groupBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => any = value => value
): Map<K, any[]> {
    const groups = new Map<K, any[]>();

    let index = 0;
    for (const value of collection) {
        const key = keySelector(value, index);

        const group = groups.get(key) ?? setAndGet(groups, key, []);

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
    resultSelector: (outer: O, inner: I[]) => R
): Iterable<R> {
    return iter(function* () {
        const innerGrouped = groupBy(inner, innerKeySelector);

        for (const outerValue of outer) {
            const key = outerKeySelector(outerValue);
            const inner = innerGrouped.get(key);
            yield resultSelector(outerValue, inner ?? []);
        }
    });
}

export function innerJoin<O, I, K, R>(
    outer: Iterable<O>,
    inner: Iterable<I>,
    outerKeySelector: (value: O) => K,
    innerKeySelector: (value: I) => K,
    resultSelector: (outer: O, inner: I) => R
) {
    return iter(function* () {
        // const innerIndexed = indexBy(inner, innerKeySelector);
        const innerGrouped = groupBy(inner, innerKeySelector);

        for (const outerValue of outer) {
            const key = outerKeySelector(outerValue);
            const innerGroup = innerGrouped.get(key);
            if (innerGroup !== undefined) {
                for (const innerValue of innerGroup) {
                    yield resultSelector(outerValue, innerValue);
                }
            }
        }
    });
}

export function getNonIteratedCountOrUndefined(
    collection: Iterable<any>
): number | undefined {
    if (isArray(collection)) return collection.length;
    else if (collection instanceof Set) return collection.size;
    else if (collection instanceof Map) return collection.size;
    else if (collection instanceof Stream)
        return collection.getNonIteratedCountOrUndefined();
    else return undefined;
}

export function distinct<T>(
    collection: Iterable<T>,
    identifier?: (value: T) => unknown
): Iterable<T> {
    if (identifier == undefined && isSet(collection)) return collection;
    if (identifier == undefined) identifier = value => value;

    return iter(function* () {
        const returned = new Set<unknown>();

        for (const value of collection) {
            const id = identifier!(value);
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
    /**
     * @returns A number between the lower and upper bounds.
     *
     * @param lowerBound Smallest possible value (inclusive).
     * @param upperBound Largest possible value (exclusive).
     */
    public range = (
        lowerBound: number | bigint,
        upperBound: number | bigint
    ): number => {
        const min = Number(lowerBound);
        const max = Number(upperBound);
        return Math.random() * (max - min) + min;
    };

    /**
     * @returns A whole number between the lower and upper bounds.
     *
     * @param lowerBound Smallest possible value (inclusive).
     * @param upperBound Largest possible value (exclusive).
     */
    public int = (
        lowerBound: number | bigint,
        upperBound: number | bigint
    ): number => {
        return Math.trunc(this.range(lowerBound, upperBound));
    };

    public choice = <T>(options: ReadonlySolid<T> | Solid<T>): T => {
        const size = getNonIteratedCount(options);
        if (size === 0) throw new Error("no options to choose from");
        return at(options, this.int(0, size))!;
    };

    public chooseAndRemove = <T>(options: Solid<T>): T => {
        const size = getNonIteratedCount(options);
        if (size === 0) throw new Error("no options to choose from");
        if (Array.isArray(options)) {
            return options.splice(this.int(0, size), 1)[0]!;
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

    public boolean = (chanceOfTrue: number = 0.5) =>
        this.range(0, 1) < chanceOfTrue;

    public readonly pickRandom: {
        /**
         * @returns A random value from the collection.
         * @throws If the collection is empty.
         */
        <T>(collection: Iterable<T>): T;
        /**
         * @returns An Iterable of non-unique random values from the collection. If the original collection is empty, an empty Iterable is returned regardless of the count requested.
         * @param count How many random values the returned Iterable will have.
         */
        <T>(collection: Iterable<T>, count: number | bigint): Iterable<T>;
    } = <T>(
        collection: Iterable<T>,
        count?: number | bigint
    ): Iterable<T> | T => {
        if (count === undefined) return random.choice(asSolid(collection));
        requireInteger(requirePositive(count));

        const usableCount = BigInt(count);

        return iter(function* () {
            const array = asArray(collection);
            if (array.length === 0) return;
            for (let i = 0n; i < usableCount; i++) yield random.choice(array);
        });
    };
}

export const random = new Random();

export function isSolid<T>(collection: Iterable<T>): collection is Solid<T> {
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
    requireInteger(requirePositive(interval));
    const usableInterval = BigInt(interval);

    if (usableInterval === 0n) return empty<T>();

    if (isArray(collection)) {
        return iter(function* () {
            const resultSize = BigInt(collection.length) / usableInterval;
            const numberInterval = Number(usableInterval);

            for (let i = 0; i < resultSize; i++)
                yield collection[i * numberInterval]!;
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
    requireInteger(requirePositive(interval));
    const usableInterval = BigInt(interval);

    if (usableInterval === 0n) return collection;

    return iter(function* () {
        let i = 0n;
        for (const value of collection) {
            if (i++ % usableInterval !== 0n) yield value;
        }
    });
}

export function skipSparse<T>(collection: Iterable<T>, count: number | bigint) {
    requireInteger(requirePositive(count));
    const usableCount = BigInt(count);
    if (count === 0) return collection;

    const array = [...collection];
    const toSkip = new Set(takeSparse(range(array.length), usableCount));

    return filter(array, (_, index) => !toSkip.has(index));
}

/**
 * Takes a specified number of values from the collection, spread out from the start to the end.
 * @param count How many values to take.
 * @returns An Iterable over the values spread out across the collection.
 */
export function takeSparse<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    requireInteger(requirePositive(count));
    const usableCount = BigInt(count);

    if (count === 0) return empty<T>();

    const solid = asSolid(collection);
    const sourceLength = getNonIteratedCount(solid);
    return take(
        alternating(solid, BigInt(sourceLength) / usableCount),
        usableCount
    );
}

export function skip<T>(collection: Iterable<T>, count: number | bigint) {
    requireInteger(requirePositive(count));
    const usableCount = BigInt(count);
    if (usableCount <= 0n) return collection;

    return iter(function* () {
        const iterator = collection[Symbol.iterator]();
        let next: IteratorResult<T, any>;
        for (let i = 0; i < usableCount; i++) {
            next = iterator.next();
            if (next.done) break;
        }

        while (!(next = iterator.next()).done) yield next.value;
    });
}

export function take<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    requireInteger(count);
    if (count < 0n) return take(reverse(collection), -count);
    const bigintCount = BigInt(count);

    return iter(function* () {
        let i = 0n;
        for (const value of collection) {
            if (i++ >= bigintCount) break;
            yield value;
        }
    });
}

/**
 * Performs a reduction of the values in the collection. Like {@link Array.reduce}.
 * @throws If The collection is empty.
 */
export function reduce<T>(
    collection: Iterable<T>,
    reduction: (
        previousResult: DeLiteral<T>,
        current: T,
        index: number
    ) => DeLiteral<T>
): DeLiteral<T>;

/**
 * Performs a reduction of the values in the collection. Like {@link array.reduce}.
 */
export function reduce<T, R>(
    collection: Iterable<T>,
    reduction: (previousResult: R, current: T, index: number) => R,
    initialValue: R
): R;

export function reduce<T>(
    collection: Iterable<T>,
    reduction: (previousResult: any, current: T, index: number) => any,
    initialValue?: any
): any {
    const iterator = collection[Symbol.iterator]();

    // use faster c-style array iteration if possible
    if (isArray(collection)) {
        let i = 0;
        let result: any;

        // get initial value
        if (arguments.length > 2) {
            result = initialValue;
        } else {
            if (collection.length === 0)
                throw new Error(
                    "reduce of empty Iterable with no initial value"
                );

            result = collection[0]!;
            i++;
        }

        // iterate the rest of the array
        for (; i < collection.length; i++) {
            result = reduction(result, collection[i]!, i);
        }

        return result;
    } else {
        let next: IteratorResult<T>;
        let result: any;
        let index: number;

        // get the initial value
        if (arguments.length > 2) {
            result = initialValue;
            index = 0;
        } else {
            next = iterator.next();
            if (next.done)
                throw new Error(
                    "reduce of empty Iterable with no initial value"
                );
            result = next.value;
            index = 1;
        }

        // iterate the rest of the array
        while (!(next = iterator.next()).done) {
            result = reduction(result, next.value, index);
        }

        return result;
    }
}

export type ReduceAndFinalizeInfo = {
    readonly count: number;
};

export function reduceAndFinalize<T, F>(
    collection: Iterable<T>,
    reduction: (
        previousResult: DeLiteral<T>,
        current: T,
        index: number
    ) => DeLiteral<T>,
    finalize: (result: DeLiteral<T>, info: ReduceAndFinalizeInfo) => F
): F;

export function reduceAndFinalize<T, R, F>(
    collection: Iterable<T>,
    reduction: (previousResult: R, current: T, index: number) => R,
    finalize: (result: R, info: ReduceAndFinalizeInfo) => F,
    initialValue: R
): F;

export function reduceAndFinalize<T, F>(
    collection: Iterable<T>,
    reduction: (previousResult: any, current: T, index: number) => any,
    finalize: (result: any, info: ReduceAndFinalizeInfo) => F,
    initialValue?: any
) {
    if (arguments.length > 3) {
        let count = 0;

        const reduced = reduce(
            collection,
            (...args) => {
                count++;
                return reduction(...args);
            },
            initialValue
        );

        return finalize(reduced, { count });
    } else {
        let count = 1;

        const reduced = reduce(collection, (...args) => {
            count++;
            return reduction(...args);
        });

        return finalize(reduced, { count });
    }
}

export function average(numbers: Iterable<number | bigint>): number | bigint {
    let adder = (a: number | bigint, b: number | bigint): number | bigint => {
        if (typeof a === "bigint" && typeof b === "bigint") {
            return a + b;
        } else {
            adder = (a: number | bigint, b: number | bigint) =>
                Number(a) + Number(b);
            return Number(a) + Number(b);
        }
    };

    const nonIteratedCount = getNonIteratedCountOrUndefined(numbers);
    let count = 1n;

    const total = reduce(
        numbers,
        nonIteratedCount === undefined
            ? (prev, curr) => {
                  count++;
                  return adder(prev, curr);
              }
            : (prev, curr) => adder(prev, curr)
    );

    if (typeof total === "number") {
        if (nonIteratedCount !== undefined) {
            return total / nonIteratedCount;
        } else {
            return total / Number(count);
        }
    } else {
        if (nonIteratedCount !== undefined) {
            return total / BigInt(nonIteratedCount);
        } else {
            return total / count;
        }
    }
}

export function skipRandomToArray<T>(
    collection: Iterable<T>,
    count: number | bigint
): T[] {
    requireInteger(requirePositive(count));
    const usableCount = BigInt(count);

    // TODO find a better way of doing this, there has to be a better way
    const array = [...collection];
    for (let i = 0n; i < usableCount && array.length > 0; i++)
        random.chooseAndRemove(array);

    return array;
}

export function skipRandom<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    return skipRandomToArray(collection, count);
}

export function takeRandom<T>(
    collection: Iterable<T>,
    count: number | bigint
): Iterable<T> {
    return take(shuffled(collection), count);
}

export function skipWhile<T>(
    collection: Iterable<T>,
    test: (value: T, index: number) => boolean
) {
    return iter(function* () {
        const iter = collection[Symbol.iterator]();
        let next: IteratorResult<T>;
        let i = 0;
        while (!(next = iter.next()).done) {
            if (!test(next.value, i++)) break;
        }
        while (!(next = iter.next()).done) {
            yield next.value;
        }
    });
}

export function takeWhile<T>(
    collection: Iterable<T>,
    test: (value: T, index: number) => boolean
) {
    return iter(function* () {
        let i = 0;
        for (const value of collection) {
            if (test(value, i++)) {
                yield value;
            } else {
                break;
            }
        }
    });
}

export function requirePositive(num: number | bigint) {
    if (num < 0) throw new Error(`expected positive number but got ${num}`);
    else return num;
}

export function requireNegative(num: number | bigint) {
    if (num >= 0) throw new Error(`expected negative number but gor ${num}`);
    else return num;
}

export function requireInteger(num: number | bigint) {
    if (typeof num === "bigint") return num;
    if (num % 1 === 0) return num;
    throw new Error(`expected integer but got ${num}`);
}

export function split<T>(
    collection: Iterable<T>,
    deliminator: Iterable<any>
): Iterable<T[]> {
    return iter(function* () {
        const delim = asSolid(deliminator);
        const delimLength = getNonIteratedCount(delim);

        let chunk: T[] = [];

        let delimIter = delim[Symbol.iterator]();
        let next = delimIter.next();
        for (const value of collection) {
            if (Object.is(value, next.value)) {
                next = delimIter.next();
            } else {
                delimIter = delim[Symbol.iterator]();
                next = delimIter.next();
            }

            if (next.done) {
                // remove delim from chunk
                chunk.splice(chunk.length - delimLength + 1, delimLength - 1);

                // reset deliminator iterator
                delimIter = delim[Symbol.iterator]();
                next = delimIter.next();

                // yield and reset chunk
                yield chunk;
                chunk = [];
            } else {
                chunk.push(value);
            }
        }
        yield chunk;
    });
}
