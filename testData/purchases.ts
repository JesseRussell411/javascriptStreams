import Stream from "../Stream";
import { lazy, random } from "../utils";
import { getCustomers } from "./customers";
import { getProducts } from "./products";

export const getPurchases = lazy(async () => {
    const customers = await getCustomers();
    const products = await getProducts();
    return customers
        .map(c =>
            Stream.generate(
                () => ({ customerID: c.id, productID: products.random().id }),
                random.int(0, 10)
            )
        )
        .flat()
        .cache();
});
