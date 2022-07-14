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
    if (isArray(collection)){
        if (collection.length > 0) return collection[collection.length - 1];
        return undefined;
    }

    let last:T | undefined = undefined;
    for(const value of collection) last = value;
    return last;
}
