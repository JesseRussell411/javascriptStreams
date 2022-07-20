import Stream from "./Stream";
import { StreamableArray } from "./Streamable";
import { getTestData } from "./getTestData";
import { DeLiteral, isArray, random, range, ValueOf } from "./utils";
import { inspect } from "util";
import Stopwatch from "./javascriptStopwatch/stopwatch";

async function main() {
    const customers = Stream.of(await getTestData());
    const products = (() => {
        let id = 1;
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
        return Stream.generate(
            () => ({
                name: random.chooseAndRemove(productNames),
                price: Math.round(Math.random() * 30 * 100) / 100,
                id: id++,
            }),
            productNames.length
        ).lazySolidify();
    })();

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
        .benchmark(time => console.log("orderBy: " + time))

        .map(c => ({ ...c, net_worth: random.range(-10, 10) }))
        .map(c => ({ ...c, self_worth: random.range(-10, 10) }))
        .benchmark(time => console.log("map: " + time))

        .takeSparse(10)
        .benchmark(time => console.log("takeSparse: " + time))

        .asArray();

    const timeToRun = sw.elapsedTimeInMilliseconds;
    console.log(inspect(result, false, null, true));
    console.log(`Ran query in ${timeToRun} milliseconds.`);
    const nandb = Stream.of([
        1,
        2,
        "sas;dlkfj",
        true,
        () => 21,
        [10, 20, 30],
        null,
        undefined,
        { b: 7 },
    ] as const)
        .filterToType("null")
        .and("array")
        .and("bigint")
        .and("null")
        .and("undefined")
        .and("object")
        .and("boolean")
        .skip(0);
    console.log(JSON.stringify(nandb));

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
}
main().catch(e => console.error(e));
