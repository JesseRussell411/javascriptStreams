import Stream, { isStream } from "./Stream";
import { and, or } from "./logic";
import { StreamableArray } from "./Streamable";
import { toASCII } from "punycode";
import { isBooleanObject, isNumberObject } from "util/types";
import { groupCollapsed } from "console";
import { AsyncResource } from "async_hooks";

export function getOwnPropertyKeys<K extends keyof any, V>(
    object: Record<K, V>
): (string | symbol)[] {
    return [
        ...Object.getOwnPropertyNames(object),
        ...Object.getOwnPropertySymbols(object),
    ];
}

export function getOwnPropertyEntries<K extends keyof any, V>(
    object: Record<K, V>
): [RealKey<K>, V][] {
    const entries = [] as [RealKey<K>, V][];

    for (const name of Object.getOwnPropertyNames(object)) {
        entries.push([name as any, (object as any)[name]]);
    }

    for (const symbol of Object.getOwnPropertySymbols(object)) {
        entries.push([symbol as any, (object as any)[symbol]]);
    }

    return entries;
}

const nullPrototype = Object.getPrototypeOf({});
export function getHierarchyOf(object: any & {}): (any & {})[] {
    const hierarchy = [];
    let current = object;
    while (current !== nullPrototype && current != null) {
        hierarchy.push(current);
        current = Object.getPrototypeOf(current);
    }

    return hierarchy;
}

export function getAllPropertyNames(object: any & {}): string[] {
    const names = new Set<string>();
    for (const current of getHierarchyOf(object)) {
        for (const name of Object.getOwnPropertyNames(current)) {
            names.add(name);
        }
    }
    return [...names];
}

export function getAllPropertySymbols(object: any & {}): symbol[] {
    const symbols = new Set<symbol>();
    for (const current of getHierarchyOf(object)) {
        for (const symbol of Object.getOwnPropertySymbols(current)) {
            symbols.add(symbol);
        }
    }
    return [...symbols];
}

export function getAllPropertyKeys(object: any & {}): (string | symbol)[] {
    const keys = new Set<string | symbol>();
    for (const current of getHierarchyOf(object)) {
        for (const name of Object.getOwnPropertyNames(current)) {
            keys.add(name);
        }
        for (const symbol of Object.getOwnPropertySymbols(current)) {
            keys.add(symbol);
        }
    }
    return [...keys];
}

export function getAllPropertyDescriptors(
    object: any & {}
): {} & Record<string | symbol, PropertyDescriptor> {
    const descriptors = {} as {} & Record<string | symbol, PropertyDescriptor>;
    const hierarchy = getHierarchyOf(object);
    for (let i = hierarchy.length - 1; i >= 0; i--) {
        const current = hierarchy[i];
        for (const key of getOwnPropertyKeys(current)) {
            descriptors[key] = Object.getOwnPropertyDescriptor(current, key)!;
        }
    }

    return descriptors;
}

export function getAllPropertyEntries(
    object: any & {}
): [string | symbol, any][] {
    const entries = [] as [string | symbol, any][];
    for (const key of getAllPropertyKeys(object)) {
        entries.push([key, object[key]]);
    }
    return entries;
}

//TODO DOCS
export function deepCopy<T>(structure: T): T {
    if (structure === null) return structure;
    if (typeof structure !== "function" && typeof structure !== "object") {
        return structure;
    }

    let copy: any;
    if (structure instanceof Set) {
        copy = new Set();
        for (const value of structure) {
            copy.add(deepCopy(value));
        }
    } else if (structure instanceof Map) {
        copy = new Map();
        for (const [key, value] of structure) {
            copy.set(key, deepCopy(value));
        }
    } else if (structure instanceof Function) {
        copy = (...args: any) => structure(...args);
    } else if (structure instanceof Boolean) {
        copy = new Boolean(structure.valueOf());
    } else if (structure instanceof Number) {
        copy = new Number(structure.valueOf());
    } else if (structure instanceof String) {
        copy = new String(structure.valueOf);
    } else if (Array.isArray(structure)) {
        copy = [];
    } else {
        copy = Object.create(Object.getPrototypeOf(structure));
    }

    for (const key of Object.getOwnPropertyNames(structure)) {
        copy[key] = deepCopy((structure as any)[key]);
    }

    for (const key of Object.getOwnPropertySymbols(structure)) {
        copy[key] = deepCopy((structure as any)[key]);
    }

    return copy;
}

//TODO DOCS
export function deepEquals(a: any, b: any) {
    if (Object.is(a, b)) return true;
    if (a == null || b == null) return false;
    if (typeof a !== "object" || typeof b !== "object") return false;

    if (Array.isArray(a)) {
        if (Array.isArray(b)) {
            if (a.length !== b.length) return false;

            for (let i = 0; i < a.length; i++) {
                if (!deepEquals(a[i], b[i])) return false;
            }
            return true;
        } else return false;
    } else if (Array.isArray(b)) {
        return false;
    } else {
        // TODO? check lengths (including prototype fields)

        for (const field in a) {
            if (!(field in b) || !deepEquals(a[field], b[field])) return false;
        }
        // TODO find better way to do this

        for (const field in b) {
            if (!(field in a)) return false;
        }

        return true;
    }
}

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
 * @returns A cached Iterable over the given Iterable. The output of the Iterable is lazily cached. This means that the first time it's iterated is the only time the given Iterable is iterated. After this the cached output of the Iterable is what's iterated. NOTE: this is unless the original iterable {@link isSolid}, in which case the original iterable is returned and is, therefore, iterated every time.
 */
export function lazyCacheIterable<T>(iterable: Iterable<T>): Iterable<T> {
    if (isSolid(iterable)) {
        return iterable;
    } else {
        return lazyCacheIterator(iterable[Symbol.iterator]());
    }
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
    collection: ReadonlySolid<T>
): collection is readonly any[];

export function isArray<T>(collection: Iterable<T>): collection is T[];

export function isArray(value: any): value is unknown[];

export function isArray(value: any): boolean {
    return Array.isArray(value);
}

export function isSet<T>(
    collection: ReadonlySolid<T>
): collection is ReadonlySet<T>;

export function isSet<T>(collection: Iterable<T>): collection is Set<T>;

export function isSet<T>(value: any): value is Set<unknown>;

export function isSet(value: any): boolean {
    return value instanceof Set;
}

export function isMap<K, V>(
    collection: ReadonlySolid<EntryLike<K, V>>
): collection is ReadonlyMap<K, V>;

export function isMap(
    collection: ReadonlySolid<any>
): collection is ReadonlyMap<unknown, unknown>;

export function isMap<K, V>(
    collection: Iterable<EntryLike<K, V>>
): collection is Map<K, V>;

export function isMap(value: any): value is Map<unknown, unknown>;

export function isMap(value: any): boolean {
    return value instanceof Map;
}

export function isSolid<T>(collection: Iterable<T>): collection is Solid<T>;

export function isSolid(value: any): value is Solid<unknown>;

export function isSolid(value: any): boolean {
    return Array.isArray(value) || value instanceof Set || value instanceof Map;
}

export function asArray<T>(collection: Iterable<T>): readonly T[] {
    if (isArray(collection)) {
        return collection;
    } else if (isStream(collection)) {
        return collection.asArray();
    } else {
        return [...collection];
    }
}

export function asSet<T>(collection: Iterable<T>): ReadonlySet<T> {
    if (isSet(collection)) {
        return collection;
    } else if (isStream(collection)) {
        return collection.asSet();
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

export function includes<T>(
    collection: Iterable<T>,
    value: T,
    fromIndex?: number | bigint
) {
    if (collection instanceof Stream) {
        return collection.includes(value, fromIndex);
    } else if (fromIndex !== undefined) {
        requireInteger(require0OrGreater(fromIndex));
        if (isArray(collection)) {
            return collection.includes(value, Number(fromIndex));
        } else {
            const iterator = collection[Symbol.iterator]();

            for (let i = 0n; i < fromIndex; i++) {
                if (iterator.next().done) return false;
            }

            let next: IteratorResult<T>;
            while (!(next = iterator.next()).done) {
                if (Object.is(value, next.value)) return true;
            }

            return false;
        }
    } else {
        if (isSet(collection)) return collection.has(value);
        if (isArray(collection)) return collection.includes(value);
        for (const collectionValue of collection)
            if (Object.is(value, collectionValue)) return true;
        return false;
    }
}

function mkStringHelper(
    collection: Iterable<any>,
    separator: any = ","
): string {
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
    if (typeof collection === "string" && arg2 === ""){
        // this is an optimization that javascript would probably do on its own, but I don't know if it does.
        if (arg1 === "" && arg3 === ""){
            return collection;
        } else {
            return arg1 + collection + arg2;
        }
    }
    else if (arguments.length > 2) {
        return `${arg1}${mkStringHelper(collection, `${arg2}`)}${arg3}`;
    } else {
        return mkStringHelper(collection, `${arg1}`);
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
    return lastOrDefault(collection, () => {
        throw new Error("collection has no last value because it is empty");
    });
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
        if (collection.length > 0) {
            return collection[collection.length - 1]!;
        } else {
            return getDefault();
        }
    }

    const iter = collection[Symbol.iterator]();
    let next = iter.next();

    if (next.done) return getDefault();

    let last: T = next.value;
    while (!(next = iter.next()).done) last = next.value;

    return last;
}

/** @returns The value at the given index from the start of the given Iterable or the value at the given negative index from the end of the given Iterable (0 returns the first value, -1 returns the last value, -2 returns the second to last value, etc.).*/
export function atOrDefault<T, D>(
    collection: Iterable<T>,
    index: number | bigint,
    getDefault: () => D
): T | D {
    requireInteger(index);

    if (isArray(collection)) {
        if (index >= 0) {
            if (index < collection.length) {
                return collection[Number(index)]!;
            } else {
                return getDefault();
            }
        } else {
            if (-index <= collection.length) {
                return collection[collection.length + Number(index)]!;
            } else {
                return getDefault();
            }
        }
    } else if (index < 0) {
        const maybeSize = getNonIteratedCountOrUndefined(collection);
        if (maybeSize !== undefined) {
            if (-index <= maybeSize) {
                const adjustedIndex = BigInt(maybeSize) + BigInt(index);

                return atOrDefault(collection, adjustedIndex, getDefault);
            } else {
                return getDefault();
            }
        } else {
            return atOrDefault([...collection], index, getDefault);
        }
    } else {
        const maybeSize = getNonIteratedCountOrUndefined(collection);
        if (maybeSize !== undefined && index >= maybeSize) return getDefault();

        let i = 0n;
        for (const value of collection) {
            if (i++ >= index) {
                return value;
            }
        }
        return getDefault();
    }
}

/** @returns The value at the given index from the start of the given Iterable or the value at the given negative index from the end of the given Iterable (0 returns the first value, -1 returns the last value, -2 returns the second to last value, etc.).*/
export function at<T>(
    collection: Iterable<T>,
    index: number | bigint
): T | undefined {
    return atOrDefault(collection, index, () => undefined);
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

export function count<T>(
    collection: Iterable<T>,
    test?: (value: T, index: number) => boolean
): number {
    if (test === undefined) {
        const maybeSize = getNonIteratedCountOrUndefined(collection);

        if (maybeSize !== undefined) {
            return maybeSize;
        } else {
            let size = 0;
            for (const _ of collection) size++;
            return size;
        }
    } else {
        let size = 0;

        if (isArray(collection)) {
            for (let i = 0; i < collection.length; i++) {
                if (test(collection[i]!, i)) size++;
            }
        } else {
            let i = 0;
            for (const value of collection) {
                if (test(value, i++)) size++;
            }
        }
        return size;
    }
}

export function asNumber(
    value: boolean | number | bigint | null | undefined
): number {
    if (value === undefined) return 0;
    return Number(value);
}

export interface SmartCompareOptions {
    compareObjects?: (
        a: Record<keyof any, any>,
        b: Record<keyof any, any>
    ) => number;
    compareArrays?: (a: readonly any[], b: readonly any[]) => number;
}

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
/** Compares two values in a way that makes more sense than the default of {@link Array.sort}, which just compares by their ascii string values. Unlike {@link Array.sort}'s default comparison, This comparison function compares numbers by returning their difference. */
export function smartCompare(a: any, b: any): number {
    // first sort by type
    const typeRatingA = rateType(a);
    const typeRatingB = rateType(b);
    if (typeRatingA !== typeRatingB) return typeRatingA - typeRatingB;

    // then by value

    // string
    if (typeof a === "string" && typeof b === "string"){
        return a.localeCompare(b);
    }

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

    // symbol
    if (typeof a === "symbol" && typeof b === "symbol"){
        if (a.description === undefined){
            if (b.description === undefined){
                return 0;
            } else {
                return -1;
            }
        } else if (b.description === undefined){
            return 1;
        } else {
            return a.description.localeCompare(b.description);
        }
    }

    // if nothing else fits, then compare by string values.
    return `${a}`.localeCompare(`${b}`);
}

export type Comparator<T> = (a: T, b: T) => number;
export type KeySelector<T, K> = (value: T) => K;
export type Order<T> = KeySelector<T, any> | Comparator<T>;

export function stringComparator(a: any, b: any){
    return `${a}`.localeCompare(`${b}`);
}

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

type ShallowFlatArray<I extends readonly any[][]> = I extends readonly [
    infer Head,
    ...infer Tail
]
    ? Head extends readonly [...infer SubHead]
        ? Tail extends readonly []
            ? SubHead
            : Tail extends readonly any[][]
            ? [...SubHead, ...ShallowFlatArray<Tail>]
            : never
        : Tail extends (infer SubTail)[]
        ? (Head | SubTail)[]
        : never
    : I extends readonly (infer SubI)[]
    ? SubI extends readonly (infer SubSubI)[]
        ? SubSubI[]
        : never
    : never;

export type Flat<
    I extends Iterable<any>,
    Depth extends number = 1
> = IsLiteral<Depth> extends false
    ? Iterable<unknown>
    : IsNegative<Depth> extends true
    ? never
    : IsInt<Depth> extends false
    ? never
    : Depth extends 0
    ? I
    : I extends Iterable<infer SubI>
    ? Depth extends 1
        ? SubI extends readonly (infer SubSubI)[]
            ? SubSubI[]
            : SubI
        : SubI extends Iterable<any>
        ? Flat<SubI, Subtract<Depth, 1>>
        : never
    : never;

export function flat<I extends Iterable<any>, D extends number>(
    collection: I,
    depth: number = 1
): Flat<I, D> {
    require0OrGreater(requireInteger(depth));

    return iter(function* () {
        for (const value of collection) {
            if (depth === 1) {
                yield* value;
            } else {
                yield* flat(value, depth - 1);
            }
        }
    }) as any;
}

//TODO DOCS
export function looseZipperMerge<A, B>(
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

export function zipperMerge<A, B>(
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
    | { 0: K; 1: V; [key: keyof any]: any };

export type EntryLikeKey<K> = [K, ...any] | { 0: K; [key: keyof any]: any };

export type EntryLikeValue<V> =
    | [any, V, ...any]
    | { 1: V; [key: keyof any]: any };

export type AsMap<I extends Iterable<any>> = I extends Iterable<infer T>
    ? T extends EntryLike<infer K, infer V>
        ? ReadonlyMap<K, V>
        : T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? ReadonlyMap<unknown, V>
        : ReadonlyMap<unknown, unknown>
    : never;

export type AsMapWithKey<I extends Iterable<any>, K> = I extends Iterable<
    infer T
>
    ? T extends EntryLikeValue<infer V>
        ? ReadonlyMap<K, V>
        : ReadonlyMap<K, unknown>
    : never;

export type AsMapWithValue<I extends Iterable<any>, V> = I extends Iterable<
    infer T
>
    ? T extends EntryLikeKey<infer K>
        ? ReadonlyMap<K, V>
        : ReadonlyMap<unknown, V>
    : never;

export type ToMap<I extends Iterable<any>> = I extends Iterable<infer T>
    ? T extends EntryLike<infer K, infer V>
        ? Map<K, V>
        : T extends EntryLikeKey<infer K>
        ? Map<K, unknown>
        : T extends EntryLikeValue<infer V>
        ? Map<unknown, V>
        : Map<unknown, unknown>
    : never;

export type ToMapWithKey<I extends Iterable<any>, K> = I extends Iterable<
    infer T
>
    ? T extends EntryLikeValue<infer V>
        ? Map<K, V>
        : Map<K, unknown>
    : never;

export type ToMapWithValue<I extends Iterable<any>, V> = I extends Iterable<
    infer T
>
    ? T extends EntryLikeKey<infer K>
        ? Map<K, V>
        : Map<unknown, V>
    : never;

export type ToObject<I extends Iterable<any>> = I extends Iterable<infer T>
    ? T extends EntryLike<infer K, infer V>
        ? K extends keyof any
            ? Record<K, V>
            : never
        : T extends EntryLikeKey<infer K>
        ? K extends keyof any
            ? Record<K, unknown>
            : never
        : T extends EntryLikeValue<infer V>
        ? Record<any, V>
        : Record<any, unknown>
    : never;

export type ToObjectWithKey<
    I extends Iterable<any>,
    K extends keyof any
> = I extends Iterable<infer T>
    ? T extends EntryLikeValue<infer V>
        ? Record<K, V>
        : Record<K, unknown>
    : never;

export type ToObjectWithValue<I extends Iterable<any>, V> = I extends Iterable<
    infer T
>
    ? T extends EntryLikeKey<infer K>
        ? K extends keyof any
            ? Record<K, V>
            : Record<any, V>
        : Record<any, unknown>
    : never;

//TODO DOCS
export function asMap<T>(collection: Iterable<T>): AsMap<Iterable<T>>;

export function asMap<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): AsMapWithKey<Iterable<T>, K>;

export function asMap<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: undefined
): AsMapWithKey<Iterable<T>, K>;

export function asMap<T extends EntryLikeKey<K>, K, V>(
    collection: Iterable<T>,
    keySelector: undefined,
    valueSelector: (value: T, index: number) => V
): AsMapWithValue<Iterable<T>, V>;

export function asMap<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): ReadonlyMap<K, V>;

export function asMap<T, K, V>(
    collection: Iterable<T>,
    keySelector?: (value: T, index: number) => K,
    valueSelector?: (value: T, index: number) => V
): ReadonlyMap<any, any> {
    if (
        isMap(collection) &&
        keySelector === undefined &&
        valueSelector === undefined
    ) {
        return collection;
    } else {
        return (toMap as Function)(collection, keySelector, valueSelector);
    }
}

export function toMap<T>(collection: Iterable<T>): ToMap<Iterable<T>>;

export function toMap<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): ToMapWithKey<Iterable<T>, K>;

export function toMap<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: undefined
): ToMapWithKey<Iterable<T>, K>;

export function toMap<T, V>(
    collection: Iterable<T>,
    keySelector: undefined,
    valueSelector: (value: T, index: number) => V
): ToMapWithValue<Iterable<T>, V>;

export function toMap<T, K, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Map<K, V>;

export function toMap<T, K, V>(
    collection: Iterable<T>,
    keySelector?: (value: T, index: number) => K,
    valueSelector?: (value: T, index: number) => V
): Map<any, any> {
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

export function toObject<T>(collection: Iterable<T>): ToObject<Iterable<T>>;

export function toObject<T, K extends keyof any>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): ToObjectWithKey<Iterable<T>, K>;

export function toObject<T, K extends keyof any>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: undefined
): ToObjectWithKey<Iterable<T>, K>;

export function toObject<T, V>(
    collection: Iterable<T>,
    keySelector: undefined,
    valueSelector: (value: T, index: number) => V
): ToObjectWithValue<Iterable<T>, V>;

export function toObject<T, K extends keyof any, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Record<K, V>;

export function toObject<T, K extends keyof any, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K = v => (v as any)?.[0],
    valueSelector: (value: T, index: number) => V = v => (v as any)?.[1]
): Record<K, V> {
    const object = {} as Record<K, V>;

    let i = 0;
    for (const value of collection) {
        object[keySelector(value, i)] = valueSelector(value, i);
        i++;
    }

    return object;
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

// TODO docs
export function groupBy<K, T>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K
): Map<K, T[]>;

// TODO DOCS
export function groupBy<K, T, V>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V
): Map<K, V[]>;

// TODO DOCS
export function groupBy<K, T, V, G>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => V,
    groupSelector: (group: V[], key: K) => G
): Map<K, G>;

// TODO DOCS
export function groupBy<K, T, G>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: undefined,
    groupSelector: (group: T[], key: K) => G
): Map<K, G>;

export function groupBy<T, K>(
    collection: Iterable<T>,
    keySelector: (value: T, index: number) => K,
    valueSelector: (value: T, index: number) => any = v => v,
    groupSelector?: (group: any[], key: K, index: number) => any
): Map<K, any> {
    const groups = new Map<K, any>();

    let i = 0;
    for (const value of collection) {
        const key = keySelector(value, i);

        const group = groups.get(key);
        if (group === undefined) {
            groups.set(key, [valueSelector(value, i)]);
        } else {
            group.push(valueSelector(value, i));
        }

        i++;
    }

    i = 0;
    if (groupSelector !== undefined) {
        for (const entry of groups) {
            groups.set(entry[0], groupSelector(entry[1], entry[0], i++));
        }
    }

    return groups;
}

// TODO docs
export function groupJoin<O, I, K, R>(
    outer: Iterable<O>,
    inner: Iterable<I>,
    outerKeySelector: (value: O) => K,
    innerKeySelector: (value: I) => K,
    resultSelector: (outer: O, inner: I[]) => R,
    comparison?: (outer: O, inner: I) => boolean
): Iterable<R> {
    if (comparison === undefined) {
        // standard comparison (Object.is), O(n)
        return iter(function* () {
            const innerGrouped = groupBy(inner, innerKeySelector);

            for (const outerValue of outer) {
                const key = outerKeySelector(outerValue);
                const inner = innerGrouped.get(key);
                yield resultSelector(outerValue, inner ?? []);
            }
        });
    } else {
        // nonstandard comparison, O(n^2)
        return iter(function* () {
            const innerCached = [...inner];

            for (const outerValue of outer) {
                const innerGroup: I[] = [];

                for (const innerValue of innerCached) {
                    if (comparison(outerValue, innerValue)) {
                        innerGroup.push(innerValue);
                    }
                }

                yield resultSelector(outerValue, innerGroup);
            }
        });
    }
}

// TODO docs
export function join<O, I, K, R>(
    outer: Iterable<O>,
    inner: Iterable<I>,
    outerKeySelector: (value: O) => K,
    innerKeySelector: (value: I) => K,
    resultSelector: (outer: O, inner: I) => R,
    comparison?: (outer: O, inner: I) => boolean
) {
    if (comparison === undefined) {
        // standard comparison (Object.is), O(n^2 / ?)
        return iter(function* () {
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
    } else {
        // nonstandard comparison, O(n^2)
        return iter(function* () {
            const innerCached = [...inner];
            for (const outerValue of outer) {
                for (const innerValue of innerCached) {
                    if (comparison(outerValue, innerValue)) {
                        yield resultSelector(outerValue, innerValue);
                    }
                }
            }
        });
    }
}

export function leftJoin<O, I, K, R>(
    left: Iterable<O>,
    right: Iterable<I>,
    leftKeySelector: (value: O) => K,
    innerKeySelector: (value: I) => K,
    resultSelector: ((left: O, right: I) => R) & ((left: O) => R),
    comparison?: (left: O, right: I) => boolean
): Iterable<R> {
    if (comparison === undefined) {
        // standard comparison (Object.is), O(n^2 / ?)
        return iter(function* () {
            const innerGrouped = groupBy(right, innerKeySelector);

            for (const leftValue of left) {
                const key = leftKeySelector(leftValue);
                const innerGroup = innerGrouped.get(key);
                if (innerGroup !== undefined && innerGroup.length > 0) {
                    for (const innerValue of innerGroup) {
                        yield resultSelector(leftValue, innerValue);
                    }
                } else {
                    yield resultSelector(leftValue);
                }
            }
        });
    } else {
        // nonstandard comparison, O(n^2)
        return iter(function* () {
            const rightCached = [...right];

            for (const leftValue of left) {
                let matchFound = false;
                for (const rightValue of rightCached) {
                    if (comparison(leftValue, rightValue)) {
                        matchFound = true;
                        yield resultSelector(leftValue, rightValue);
                    }
                }

                if (!matchFound) {
                    yield resultSelector(leftValue);
                }
            }
        });
    }
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
    if (identifier === undefined) {
        if (isSet(collection)) return collection;
        identifier = value => value;
    }

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

/**
 * @returns The intersection of collections, a and b. That is, the values that are in both a and b based on {@link Object.is}. To make the output unique consider using {@link distinct}.
 */
export function intersection<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
    return iter(function* () {
        // if either is a set
        if (isSet(a) && isSet(b)) {
            if (a.size > b.size) {
                for (const value of b) if (a.has(value)) yield value;
            } else {
                for (const value of a) if (b.has(value)) yield value;
            }
        } else if (isSet(a)) {
            for (const value of b) if (a.has(value)) yield value;
        } else if (isSet(b)) {
            for (const value of a) if (b.has(value)) yield value;
        } else {
            // if neither is a set
            const cache = new Set<T>();
            const iter = b[Symbol.iterator]();
            let next: IteratorResult<T>;

            for (const value of a) {
                if (cache.has(value)) {
                    yield value;
                } else {
                    while (!(next = iter.next()).done) {
                        cache.add(next.value);
                        if (Object.is(value, next.value)) yield value;
                    }
                }
            }
        }
    });
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
        requireInteger(require0OrGreater(count));

        const usableCount = BigInt(count);

        return iter(function* () {
            const array = asArray(collection);
            if (array.length === 0) return;
            for (let i = 0n; i < usableCount; i++) yield random.choice(array);
        });
    };
}

export const random = new Random();

export type ReadonlySolid<T> =
    | readonly T[]
    | ReadonlySet<T>
    | (T extends EntryLike<infer K, infer V>
          ? ReadonlyMap<K, V> & Iterable<T>
          : never);

export type Solid<T> =
    | T[]
    | Set<T>
    | (T extends [infer K, infer V] ? Map<K, V> & Iterable<T> : never);

export function takeAlternating<T>(
    collection: Iterable<T>,
    interval: number | bigint = 2n
): Iterable<T> {
    requireInteger(require0OrGreater(interval));
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

export function skipAlternating<T>(
    collection: Iterable<T>,
    interval: number | bigint = 2n
): Iterable<T> {
    requireInteger(require0OrGreater(interval));
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
    requireInteger(require0OrGreater(count));
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
    requireInteger(require0OrGreater(count));
    const usableCount = BigInt(count);

    if (count === 0) return empty<T>();

    const solid = asSolid(collection);
    const sourceLength = getNonIteratedCount(solid);
    return take(
        takeAlternating(solid, BigInt(sourceLength) / usableCount),
        usableCount
    );
}

export function skip<T>(collection: Iterable<T>, count: number | bigint) {
    requireInteger(require0OrGreater(count));
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

//TODO DOCS
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
    initialValue: R,
    finalize: (result: R, info: ReduceAndFinalizeInfo) => F
): F;

export function reduceAndFinalize<T, F>(
    collection: Iterable<T>,
    reduction: (previousResult: any, current: T, index: number) => any,
    initialValueOrFinalize: any,
    finalize?: (result: any, info: ReduceAndFinalizeInfo) => F
) {
    if (arguments.length === 3) {
        const finalize = initialValueOrFinalize as (
            result: any,
            info: ReduceAndFinalizeInfo
        ) => F;

        let count = 1;

        const reduced = reduce(collection, (...args) => {
            count++;
            return reduction(...args);
        });

        return finalize(reduced, { count });
    } else if (arguments.length === 4) {
        const initialValue = initialValueOrFinalize;
        let count = 0;

        const reduced = reduce(
            collection,
            (...args) => {
                count++;
                return reduction(...args);
            },
            initialValue
        );

        return finalize!(reduced, { count });
    } else {
        throw new Error("incorrect number of arguments: " + arguments.length);
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
    requireInteger(require0OrGreater(count));
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

export function require0OrGreater<N extends number | bigint>(
    num: N
): IsNegative<N> extends false ? N : never {
    if (num < 0) throw new Error(`expected 0 or greater but got ${num}`);
    else return num as any;
}

export function requireGreaterThan0<N extends number | bigint>(
    num: N
): Or<IsNegative<N>, Eq<N, 0>> extends false ? N : never {
    if (!(num > 0))
        throw new Error(`expected number greater than 0 but got ${num}`);
    else return num as any;
}

export function requireNegative<N extends number | bigint>(
    num: N
): IsNegative<N> extends true ? N : never {
    if (num >= 0) throw new Error(`expected negative number but gor ${num}`);
    else return num as any;
}

export function requireInteger<N extends number | bigint>(
    num: N
): IsInt<N> extends true ? N : never {
    if (typeof num === "bigint") return num as any;
    if (num % 1 === 0) return num as any;
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

export function withIndex<T>(iterable: Iterable<T>): Iterable<[number, T]> {
    return iter(function* () {
        if (isArray(iterable)) {
            for (let i = 0; i < iterable.length; i++) {
                yield [i, iterable[i]!];
            }
        } else {
            let i = 0;
            for (const value of iterable) {
                yield [i++, value];
            }
        }
    });
}


export function max<T>(collection: Iterable<T>, order: Order<T> = smartCompare): T{
    const comparator = orderAsComparator(order);
    const iter = collection[Symbol.iterator]();
    let next = iter.next();
    
    if (next.done){
        throw new Error("cannot get min or max value from empty Iterable");
    }

    let max = next.value;

    while(!(next = iter.next()).done){
        const value = next.value;
        if (comparator(max, value) < 0){
            max = value;
        }
    }

    return max;
}

export function min<T>(collection: Iterable<T>, order: Order<T> = smartCompare): T{
    return max(collection, reverseOrder(order));
}


// ------------------------------------------
// utility types
// -----------------------------------

export type Replace<T, A, B> = T extends A ? B : T;

export type ValueOf<T> = T extends (infer V)[]
    ? V
    : T extends Iterable<infer V>
    ? V
    : T extends Record<keyof any, infer V>
    ? V
    : T[keyof T];

export type RealKey<K> = Replace<K, number, string>;
export type RealKeyOf<T> = RealKey<keyof T>;

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

export type IsNegative<N extends number | bigint> = IsLiteral<N> extends false
    ? boolean
    : `${N}` extends `-${infer _}`
    ? true
    : false;

export type IsInt<N extends number | bigint> = N extends bigint
    ? true
    : IsNumberLiteral<N> extends false
    ? boolean
    : `${N}` extends `${infer _}.${infer _0}`
    ? false
    : true;

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

export type GenericNumberString<N extends number | bigint> =
    `${N}` extends `${infer S}n` ? S : `${N}`;

export type Extends<A, B> = A extends B ? true : false;

export type And<A extends boolean, B extends boolean> = A extends true
    ? B extends true
        ? true
        : false
    : false;

export type Or<A extends boolean, B extends boolean> = A extends true
    ? true
    : B extends true
    ? true
    : false;

export type Xor<A extends boolean, B extends boolean> = A extends true
    ? B extends true
        ? false
        : true
    : B extends true
    ? true
    : false;

export type Not<B extends boolean | undefined> = B extends true
    ? false
    : B extends false
    ? true
    : undefined;

type TupleOfLength_definition<
    Length extends number | bigint,
    T,
    Accumulator extends T[] = []
> = IsLiteral<Length> extends false
    ? T[]
    : IsNegative<Length> extends true
    ? never
    : IsInt<Length> extends false
    ? never
    : `${Accumulator["length"]}` extends GenericNumberString<Length>
    ? Accumulator
    : TupleOfLength_definition<Length, T, [...Accumulator, T]>;

export type TupleOfLength<
    Length extends number | bigint,
    T = undefined
> = TupleOfLength_definition<Length, T>;

type ArrayMathHack_IsInputSanitary<
    A extends number | bigint,
    B extends number | bigint
> = IsLiteral<A> extends false
    ? false
    : IsInt<A> extends false
    ? false
    : IsNegative<A> extends true
    ? false
    : IsLiteral<B> extends false
    ? false
    : IsInt<B> extends false
    ? false
    : IsNegative<B> extends true
    ? false
    : true;

export type Add<
    A extends number | bigint,
    B extends number | bigint
> = ArrayMathHack_IsInputSanitary<A, B> extends false
    ? number
    : [...TupleOfLength<A>, ...TupleOfLength<B>]["length"];

type Subtract_definition<
    A extends number | bigint,
    B extends number | bigint,
    Gap extends any[] = []
> = A extends bigint
    ? B extends bigint
        ? bigint
        : number
    : B extends bigint
    ? number
    : ArrayMathHack_IsInputSanitary<A, B> extends false
    ? number
    : [...TupleOfLength<B>, ...Gap]["length"] extends A
    ? Gap["length"]
    : Subtract_definition<A, B, [...Gap, any]>;

export type Subtract<A extends number, B extends number> = Subtract_definition<
    A,
    B
>;

export type Eq<A extends number | bigint, B extends number | bigint> = And<
    IsLiteral<A>,
    IsLiteral<B>
> extends false
    ? boolean
    : GenericNumberString<A> extends GenericNumberString<B>
    ? true
    : false;

type Lt_definition<
    A extends number | bigint,
    B extends number | bigint,
    Gap extends any[] = [any]
> = Or<Extends<A, bigint>, Extends<B, bigint>> extends true
    ? boolean
    : ArrayMathHack_IsInputSanitary<A, B> extends false
    ? boolean
    : A extends B
    ? false
    : [...TupleOfLength<A>, ...Gap]["length"] extends B
    ? true
    : [...TupleOfLength<B>, ...Gap]["length"] extends A
    ? false
    : Lt_definition<A, B, [...Gap, any]>;

export type Lt<
    A extends number | bigint,
    B extends number | bigint
> = Lt_definition<A, B, [any]>;

export type Gt<A extends number | bigint, B extends number | bigint> = Not<
    Or<Lt<A, B>, Eq<A, B>>
>;

export type Lte<A extends number | bigint, B extends number | bigint> = Or<
    Lt<A, B>,
    Eq<A, B>
>;
export type Gte<A extends number | bigint, B extends number | bigint> = Or<
    Gt<A, B>,
    Eq<A, B>
>;

export interface Maybe<T> {
    readonly value: T | undefined;
    readonly isDefined: boolean;

    match<R>(ifDefined: (value: T) => R, ifUndefined: () => R): R;
    match<R>(ifDefined: (value: T) => R, ifUndefined?: () => R): R | undefined;

    or<O>(alternative: O | (() => O)): this | Some<O>;
}

export interface Some<T> extends Maybe<T> {
    readonly value: T;

    readonly isDefined: true;

    match<R>(ifDefined: (value: T) => R, ifUndefined?: () => R): R;

    or<O>(_alternative: O | (() => O)): this;
}

export interface None<T = any> extends Maybe<T> {
    get value(): undefined;

    get isDefined(): false;

    match<R>(ifDefined: (value: never) => R, ifUndefined: () => R): R;
    match<R>(ifDefined: (value: never) => R, ifUndefined?: () => R): undefined;

    or<O>(alternative: O | (() => O)): Some<O>;
}

class SomeInstance<T> implements Some<T> {
    readonly value: T;

    get isDefined(): true {
        return true;
    }

    constructor(value: T) {
        this.value = value;
    }

    get match() {
        const self = this;
        return (ifDefined: (value: T) => any): any => {
            return ifDefined(self.value);
        };
    }

    get or() {
        const self = this;
        return () => self;
    }
}

class NoneInstance implements None {
    get value(): undefined {
        return undefined;
    }

    get isDefined(): false {
        return false;
    }

    match<R>(ifDefined: (value: never) => R, ifUndefined: () => R): R;
    match<R>(ifDefined: (value: never) => R, ifUndefined?: () => R): undefined;
    match<R>(
        _ifDefined: (value: never) => R,
        ifUndefined?: () => R
    ): R | undefined {
        return ifUndefined?.();
    }

    or<O>(alternative: O | (() => O)): Some<O> {
        if (alternative instanceof Function) {
            return Some(alternative());
        } else {
            return Some(alternative);
        }
    }
}

export function Some<T>(value: T): Some<T> {
    return new SomeInstance(value);
}

export function None<T = any>(): None<T> {
    return new NoneInstance();
}