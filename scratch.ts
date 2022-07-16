import Stream from "./Stream";
import { StreamableArray } from "./Streamable";
import { getTestData } from "./getTestData";
import { DeLiterall, isArray, range, ValueOf } from "./utils";
import { inspect } from "util";

async function main() {
    const customers = Stream.of(await getTestData());
    const customersShuffled = customers.shuffle().stream();
    const purchases = Stream.generate(
        () => ({
            customer: customersShuffled.random(),
            price: Math.round(Math.random() * 30 * 100) / 100,
        }),
        1000
    );
    console.log(
        inspect(
            customers
                .groupJoin(
                    purchases,
                    c => c,
                    p => p.customer,
                    (customer, purchases) => ({
                        ...customer,
                        purchases: purchases.toArray(),
                    })
                )
                .filter(c => c.purchases.length > 1)
                .toArray(),
            false,
            null,
            true
        )
    );
}
main().catch(e => console.error(e));
