import Stream from "./Stream";
import { StreamableArray } from "./Streamable";
import { getTestData } from "./getTestData";
import {
    average,
    breakSignal,
    DeLiteral,
    distinct,
    isArray,
    random,
    range,
    ValueOfArray,
} from "./utils";
import { inspect } from "util";
import Stopwatch from "./javascriptStopwatch/stopwatch";

async function main() {
    const customers = Stream.of(await getTestData());
    const products = (() => {
        const productNames = [
            "power blaster 9000",
            "super scoot",
            "ajax bleach",
            "just a dead thing",
            "powerBook",
            "apple",
            "orange",
            "banana mania",
            "junk master",
            "message master",
            "in-fruit-inator",
            "I can't believe it's butter",
            "mega string",
            "mega-mart-express",
            "sack of hammers",
            "russian screwdriver",
            "lip bomb",
            "ridiculous soaker",
            "squirt gun",
            "canadian squirt gun",
            "turkey baster",
            "ajax extreme",
            "powdered milk",
            "powdered cheese",
            "gas-cooker",
            "plant-based burger",
            "meat-based veggies",
            "X-treme sunglasses",
            "rocket scooter",
            "lip balm",
            "nuclear lip balm",
            "quarter master",
        ];
        let id = 1;
        return Stream.generate(
            () => ({
                name: random.chooseAndRemove(productNames),
                price: Math.round(Math.random() * 30 * 100) / 100,
                id: id++,
            }),
            productNames.length
        );
    })().lazySolidify();

    const purchases = Stream.generate(
        () => ({
            customerID: customers.random().id,
            product: products.random(),
        }),
        1000
    ).lazySolidify();

    const sw = new Stopwatch();
    console.log("start...");
    sw.restart();
    const result = customers
        .groupJoin(
            purchases,
            c => c.id,
            p => p.customerID,
            (customer, purchases) => ({
                ...customer,
                purchases: purchases.toArray(),
            })
        )
        .benchmark(time => console.log("groupJoin: " + time))

        .filter(c => c.purchases.length > 1)
        .filter(c => c.gender === "Male")
        .benchmark(time => console.log("filter: " + time))

        .orderBy(c => c.purchases.length)
        .thenBy(c => c.first_name)
        .thenBy(c => c.last_name)
        .thenBy(c => c.id)

        // .orderBy(c => c.id)
        // .orderBy(c => c.last_name)
        // .orderBy(c => c.first_name)
        // .orderBy(c => c.purchases.length)

        .benchmark(time => console.log("orderBy: " + time))

        .map(c => ({ ...c, net_worth: random.range(-10, 10) }))
        .map(c => ({ ...c, self_worth: random.range(-10, 10) }))
        .benchmark(time => console.log("map: " + time))
        .distinct(c => "" + c.state)

        .takeSparse(10)
        .benchmark(time => console.log("takeSparse: " + time))
        .asArray();

    const timeToRun = sw.elapsedTimeInMilliseconds;
    // console.log(inspect(result, false, null, true));
    console.log(`Ran query in ${timeToRun} milliseconds.`);
    const nandb = Stream.of([
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
        .filterOut("emptyString")
        .and("number")
        .and("bigint")
        .and("0")
        .and("string")
        .and("0n")
        .and("undefined")
        .skip(0);

    const stm = Stream.of([1, 2, 3, 4, 5] as const);
    console.log(
        stm.concat([["a", "b"], ";alksjdf", ["q", "z"]] as const).asArray()
    );
    console.log(
        stm.concat([["a", "b"], ";alksjdf", ["q", "z"]] as const).asArray()
    );

    const vect1 = Stream.of([1, 2, 3] as const);
    const vect2 = Stream.of([5, "a", 7, 2, true] as const)
        .filterOut("string")
        .and("boolean");

    const dotProduct = vect1
        .merge(vect2, (a, b) => a * b)
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

}
main().catch(e => console.error(e));
