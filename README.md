# Minimal async/await Rate Limiter

Super simple promise-based Rate Limiter:

- comes in at 8.248 Bytes and Zero Dependencies
- fully typed
- maintains in-order execution and supports priorities
- constant O(1) runtime, no matter the queue length or priorities

## Installation

```shell
npm install priority-limiter --save
```

## Usage

Simply import, then create a new Limiter Instance. The first parameter describes how many request are allowed within the timeframe of the second paramter (in seconds).

For example, allow 5 requests per 10 seconds:

```javascript
import Limiter from "priority-limiter";

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

# Documentation

## new Limiter(request_number, per_seconds)

- `request_number` {Number} How many elements will resolve per seconds_number.
- `per_seconds` {Number} How long the timeframe for request_number is in seconds. Defaults to 60.

Creates a new Limiter Instance.

## awaitTurn([priority, timeout])

- `priority` {Number} elements with higher priority will resolve before elements with lower priority. Defaults to 0.
- `timeout` {Number} reject if element waits for longer than this many seconds. Defaults to 0 (never rejects).

Resolves once ready. Use `await` to wait until you can continue.

## getLength()

Gets the current queue length, i.e. how many calls to `awaitTurn()` have not been resolved yet.

## isEmpty()

Checks whether the queue is empty, i.e. if there are no calls to `awaitTurn()` that have not been resolved yet.

## getUsedResolves()

Get how many calls to `awaitTurn()` have already been resolved within the last per_seconds seconds (thus another `request_number - getUsedResolves()` calls can be made right now).

## License

MIT
