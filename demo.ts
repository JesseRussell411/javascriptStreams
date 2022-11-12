import { inspect } from "util";
import { ValueOfStream } from "./Stream";
import { getCustomers } from "./testData/customers";
import { getProducts } from "./testData/products";
import { getPurchases } from "./testData/purchases";
import { ValueOfArray } from "./utils";

async function main() {
    const [customerData, productData, purchaseData] = await Promise.all([
        getCustomers(),
        getProducts(),
        getPurchases(),
    ]);

    const customers = customerData
        .groupJoin(
            productData
                .join(
                    purchaseData,
                    product => product.id,
                    purchase => purchase.productID,
                    (product, purchase) => ({ purchase, product })
                )
                .cache(),
            c => c.id,
            p => p.purchase.customerID,
            (customer, purchases) => ({
                ...customer,
                purchases: purchases.map(p => p.product),
            })
        )
        .cache();
    
    console.log(inspect(customers.take(2).toArray(),false, null, true));

    type Customer = ValueOfStream<typeof customers>;
    type Product = ValueOfArray<Customer["purchases"]>;

    function simplifyCustomer(customer: Customer): {
        id: Customer["id"];
        firstName: Customer["first_name"];
        lastName: Customer["last_name"];
        purchases: { name: Product["name"]; price: Product["price"] }[];
    } {
        return {
            id: customer.id,
            firstName: customer.first_name,
            lastName: customer.last_name,
            purchases: customer.purchases.map(p => ({
                name: p.name,
                price: p.price,
            })),
        };
    }

    console.log("2 random customers with no purchases:");
    console.log("---------------------------------------");
    console.log(
        customers
            .filter(c => c.purchases.length === 0)
            .map(simplifyCustomer)
            .takeRandom(2)
            .asArray()
    );
    console.log();
    console.log();
    console.log();
    console.log("2 random customers and their total spent:");
    console.log("----------------------------------------------");
    console.log(
        inspect(
            customers
                .filter(c => c.purchases.length < 10)
                .map(simplifyCustomer)
                .map(c => ({
                    ...c,
                    totalSpent: c.purchases.reduce(
                        (total, p) => total + p.price,
                        0
                    ),
                }))
                .takeRandom(2)
                .asArray(),
            false,
            null,
            true
        )
    );
    console.log();
    console.log();
    console.log();
    console.log("Histogram of the number of purchases made per customer");
    console.log("---------------------------------------------------------");
    {
        const grouped = customers
            .groupBy(c => c.purchases.length)
            .orderBy(g => g[0])
            .cache();

        const highestGroup = grouped.last();

        console.log(
            inspect(
                grouped
                    .map(
                        group =>
                            `${group[0]
                                .toString()
                                .padEnd(
                                    highestGroup[0].toString().length + 1,
                                    "-"
                                )}|${"=".repeat(group[1].length)}`
                    )
                    .asArray()
            )
        );
    }
}

main().catch(e => console.error("[Error in main]", e));
