# Minimal async/await Rate Limiter

Super simple promise-based Rate Limiter:

- comes in at 8.567 Bytes and Zero Dependencies
- fully typed
- maintains in-order execution and supports priorities
- constant O(1) runtime, no matter the queue length or priorities

## Installation

```shell
npm install priority-queue --save
```

## Full Usage

Simply import, then create a new Limiter Instance. The first parameter describes how many request are allowed within the timeframe of the second paramter (in seconds).

For example, allow 5 requests per 10 seconds:

```javascript
import Limiter from "priority-queue";

const limiter = new Limiter(5, 10);

(async () => {
	while (true) {
		await limiter.awaitTurn();

		//do requests...
	}
})();
```

The default priority is 0. Higher priorities will execute before lower ones. Requests with the same priority are resolve in-order of function calling.

```javascript
await limiter.awaitTurn(1); //priority 1, will execute before default priority 0.
```

Lastly, you can specify the maximum duration a request can wait for their turn. Promise will reject when waiting longer:

```javascript
try {
	await limiter.awaitTurn(0, 30); //timeout if waiting for longer than 30 seconds.
} catch (err) {
	console.log(err); //on timeout: "Limiter timed out."
}
```

### License

MIT