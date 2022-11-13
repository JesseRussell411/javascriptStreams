import Stream from "./Stream";
import fs from "fs/promises";
import { StreamableArray } from "./Streamable";
import {
    average,
    breakSignal,
    DeLiteral,
    distinct,
    isArray,
    KeyOfArray,
    lazy,
    random,
    range,
    split,
    ValueOfArray,
} from "./utils";
import { inspect } from "util";
import Stopwatch from "./javascriptStopwatch/stopwatch";
import { getCurves } from "crypto";

import { getCustomers } from "./testData/customers";
import { getPurchases } from "./testData/purchases";
import { getProducts } from "./testData/products";

type ResultOfPromise<T extends Promise<any>> = T extends Promise<infer PT>
    ? PT extends Promise<any>
        ? ResultOfPromise<PT>
        : PT
    : never;

type ResultsOfPromises<T extends readonly [...Promise<any>[]]> = {
    [K in keyof T]: ResultOfPromise<T[K]>;
};

async function manyPromises<T extends readonly [...Promise<any>[]]>(
    many: T
): Promise<ResultsOfPromises<T>> {
    const result = [];
    for (const promise of many) {
        result.push(await promise);
    }
    return result as any;
}

async function main() {
    const [customers, purchases, products] = await manyPromises([
        getCustomers(),
        getPurchases(),
        getProducts(),
    ] as const);

    const sw = new Stopwatch();
    console.log("start...");
    sw.restart();
    const nandb = Stream.from([
        1,
        2,
        3,
        0,
        4n,
        0n,
        "sas;dlkfj",
        true,
        false,
        false,
        () => 21,
        "",
        "",
        [10, 20, 30],
        null,
        undefined,
        { b: 7 },
        Symbol(),
        "\n   ",
    ] as const)
        .filterOut("undefined")
        .and("null")
        .skip(0);

    const test = nandb.filterTo("0").and("0n");

    const stm = Stream.from([1, 2, 3, 4, 5] as const);
    console.log(
        stm.concat([["a", "b"], ";alksjdf", ["q", "z"]] as const).asArray()
    );
    console.log(
        stm.concat([["a", "b"], ";alksjdf", ["q", "z"]] as const).asArray()
    );

    const vect1 = Stream.from([1, 2, 3] as const);
    const vect2 = Stream.from([5, "a", 7, 2, true] as const)
        .filterOut("string")
        .and("boolean");

    const dotProduct = vect1
        .merge(vect2, (a, b) => a * b)
        .ifEmpty([0])
        .reduce((p, c) => p + c);
    console.log(dotProduct);

    console.log(
        vect1.reduceAndFinalize(
            (prev, current) => prev + current,
            (r, info) => r / info.count,
            0
        )
    );

    // console.log(nandb.asArray());

    // console.log(inspect(customers.groupJoin(customers, c => c.first_name, oc => oc.first_name, ())))

    // var a = Stream.range(0, 20);
    // var b = stream(10, 20, 30, 40, 7, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 7);
    // var intersection = a.intersect(b);

    // console.log("===========");
    // console.log(intersection.map(n => `${n}`).reduce((s, c) => s + ", " + c));
    // console.log("===========");
    // console.log(a.asArray());
    // console.log(a.insert(["a", "b", "c"], 2).asArray());

    // const arr = b.toArray();
    // console.log(b.asArray());
    // arr[2] = 1999999;
    // console.log(b.asArray());

    sw.reset();

    const testStream = Stream.range(1000000n);

    const total = testStream.reduce((p, c) => p + c);
    console.log(total);
    console.log(typeof total);

    const result = customers
        .groupJoin(
            purchases.join(
                products,
                purchase => purchase.productID,
                product => product.id,
                (purchase, product) => ({
                    customerID: purchase.customerID,
                    product,
                })
            ),
            c => c.id,
            p => p.customerID,
            (customer, purchases) => ({
                ...customer,
                purchases: purchases,
            })
        )
        .orderBy(c => c.purchases.length)
        .map(c => c.purchases)
        .takeSparse(5)
        .toArray();

    console.log(inspect(result, false, null, true));

    console.log(
        Stream.from("->1->2->->3->4->5->")
            .split("->")
            .map(c => c.join(""))
            .asArray()
    );

    console.log(Stream.of(1, 2, 3, 4).mkString());
    console.log(Stream.of(1, 2, 3, 4).mkString(","));
    console.log(Stream.of(1, 2, 3, 4).mkString("[", ","));
    console.log(Stream.of(1, 2, 3, 4).mkString("[", ",", "]"));
    console.log(
        Stream.of(1, 6, 9, 3, 4, 9, 9, 9, 2, 3, 4, 1, 5, 5, 6, 7, 4, 2)
            .orderDescending()
            .asArray()
    );

    console.log(Stream.from("abc").mkString(",", "", "]"));

    console.log(Stream.of(1, 2, 3, 4, 5).mkString());

    console.log(Stream.of("a", "b", "c", "d", "e").withIndex().asArray());

    console.log(
        Stream.of<[number, string]>([1, "one"], [2, "two"], [3, "three"]).asMap(
            e => 2 > e[0],
            e => 9n
        )
    );

    const m = new Map([
        [1, "one"],
        [2, "two"],
    ]);

    console.log(m === Stream.from(m).asMap());
    console.log(Stream.from("aAbBcCdD").partition(2).asMap());

    const vector1 = [1, 2, 3] as const;
    const vector2 = [5, 2, 3] as const;

    const dotProduct12 = Stream.from(vector1)
        .merge(vector2, (a, b) => a * b)
        .reduce((t, c) => t + c);

    console.table({ vector1, vector2, dotProduct12 });
    
}
main().catch(e => console.error(e));
