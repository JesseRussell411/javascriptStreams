# javascriptStreams
My inspiration for this project was obviously Linq from C# (one of my favorite features in C#).
Linq allows the programmer to write SQL-like queries against any class that implements the IEnumerable interface.
This means that you can interface with virtually any datastructure in C# using a powerful declarative query syntax.
Unsurprisingly, someone has already written a version of this for Javascript.
It can be found here: https://github.com/neuecc/linq.js/ and I would highly recomend it, even over my own implemenation, because it's finished if for no other reason.

As impressive as Linq.js is, I think my own implementation has at least one advantage and that is the fact that it is written in modern TypeScript, taking advantage of
modern es6 features.

##examples of usage:

Some basic operations
```
console.log(
  Stream.of(1, 2, 3, 4, 5, 6, 7, 8, 9)
    // filter to even numbers only
    .filter(n => n % 2 === 0)
    // convert the numbers to bigints
    .map(n => BigInt(n))
    // get the total
    .reduce((total, current) => total + current, 0n));
```

#From demo.ts

Joining customers with their purchases
```
const customers = customerData
	.groupJoin(
		productData
			.innerJoin(
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
```

Querying customers that haven't purchased anything and limiting the result to two random customers.
```
console.log(
	customers
		.filter(c => c.purchases.length === 0)
		.map(simplifyCustomer)
		.takeRandom(2)
		.asArray()
);
```

Constructing a histogram of how many items customers purchased.
```
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
```
