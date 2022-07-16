import Stream from "./Stream";
import { StreamableArray } from "./Streamable";
import { getTestData } from "./getTestData";
import { DeLiterall, isArray, range, ValueOf } from "./utils";
import { inspect } from "util";

async function main() {
    const customers = Stream.of(await getTestData());
    console.log(customers.filter(c => c.state === "FL").count());
}
main().catch(e => console.error(e));
