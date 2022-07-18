import Stream, { stream } from "./Stream";
import { StreamableArray } from "./streamable";
import { getTestData } from "./getTestData";
import { DeLiteral, isArray, random, range, ValueOf } from "./utils";
import { inspect } from "util";

async function main() {
    const customers = Stream.of(await getTestData());
    const customersShuffled = customers.shuffle().solidify();
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
        ).solidify();
    })();

    const purchases = Stream.generate(
        () => ({
            customerID: customers.random().id,
            product: products.random(),
        }),
        1000
    );

    console.log("start...");

    console.log(
        inspect(
            customers
                .groupJoin(
                    purchases,
                    c => c.id,
                    p => p.customerID,
                    (customer, purchases) => ({
                        ...customer,
                        purchases: purchases.toArray(),
                    })
                )
                .random(500)
                .map(c => ({
                    ...c,
                    toString: () =>
                        `${c.gender}, ${c.first_name}, ${c.last_name}, ${c.id}`,
                }))
                .if(
                    s => s.count() === 100,
                    s => s.map(c => ({ ...c, yes: true })),
                    s => s.map(c => ({ ...c, yes: false }))
                )
                .orderBy(c => c.gender)
                .branch(
                    s => s.thenBy(c => c.first_name),
                    s =>
                        s.branch(
                            s => s.thenBy(c => c.id),
                            s => s.thenBy(c => c.last_name),
                            s => s.take(1).forEach(c => console.log(c)),
                            (a, b) => [
                                a
                                    .alternate(50)
                                    .map(c => c.toString())
                                    .asArray(),
                                b
                                    .alternate(50)
                                    .map(c => c.toString())
                                    .asArray(),
                            ]
                        ),
                    s => {
                        console.log("doing the thing");
                        s.at(0);
                    },
                    (a, b) => [
                        a
                            .alternate(50)
                            .map(c => c.toString())
                            .asArray(),
                        b,
                    ]
                ),

            false,
            null,
            true
        )
    );

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
