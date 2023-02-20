interface Queue {
	head: number;
	tail: number;
	elements: {
		[key: string]: () => void;
	};
}

export default class Limiter {
	private queues: {
		[key: string]: Queue;
	};

	private used_resolves: number;
	private highest_priority: number | undefined;

	private resolve_timers: { [key: string]: number }; //keep track of all timers so we know when next one is done

	max_resolves: number;
	per_seconds: number;

	/**
	 * Creates a new Limiter Instance.
	 * @param request_number How many elements will resolve per seconds_number.
	 * @param per_seconds How long the timeframe for request_number is in seconds. Defaults to 60.
	 */
	constructor(request_number: number, per_seconds = 60) {
		this.queues = {};
		this.used_resolves = 0;
		this.highest_priority = undefined;

		this.resolve_timers = {};

		this.max_resolves = request_number;
		this.per_seconds = per_seconds;
	}

	/**
	 * Resolves once ready.
	 * @param priority elements with higher priority will resolve before elements with lower priority. Defaults to 0.
	 * @param timeout reject if element waits for longer than this many seconds. Defaults to 0 (never rejects).
	 */
	awaitTurn(priority = 0, timeout = 0): Promise<void> {
		return new Promise((res, rej) => {
			if (this.used_resolves < this.max_resolves) {
				this.resolve(res);
			} else {
				this.push(res, rej, priority, timeout);
			}
		});
	}

	private push(res: () => void, rej: (reason: string) => void, priority: number, timeout: number) {
		//create queue for given priority if none exists
		if (!this.queues[priority]) {
			if (this.highest_priority === undefined || priority > this.highest_priority) this.highest_priority = priority;

			this.queues[priority] = {
				head: 0,
				tail: 0,
				elements: {},
			};
		}

		//add to queue
		const queue = this.queues[priority];
		queue.elements[queue.tail] = res;
		const pos = queue.tail;
		queue.tail++;

		//set timeout
		if (timeout != 0) {
			let timer: NodeJS.Timeout;
			timer = setTimeout(() => {
				delete this.resolve_timers[String(timer)];

				if (queue.elements[pos]) {
					delete queue.elements[pos];

					//move each element up to fill "hole" left by timed out element
					let el: (() => void) | undefined = undefined;
					for (let i = queue.head; i < queue.tail; i++) {
						let next_el = queue.elements[i];
						if (el) queue.elements[i] = el;
						if (next_el) el = next_el;
						else break;
					}

					delete queue.elements[queue.head];
					queue.head++;

					if (queue.head == queue.tail) {
						delete this.queues[priority]; //delete empty queue
						if (priority == this.highest_priority) this.highest_priority = this.getHighestPriority();
					}
					rej("Limiter timed out.");
				}
			}, timeout * 1000);

			this.resolve_timers[String(timer)] = Date.now() + timeout * 1000;
		}
	}

	private resolve(res: () => void) {
		res();
		this.used_resolves += 1;

		let timer: NodeJS.Timeout;
		timer = setTimeout(() => {
			delete this.resolve_timers[String(timer)];
			this.doNextResolve();
		}, this.per_seconds * 1000);

		this.resolve_timers[String(timer)] = Date.now() + this.per_seconds * 1000;
	}

	private doNextResolve() {
		this.used_resolves -= 1;
		if (!this.isEmpty()) {
			//resolve next highest priority element
			const queue = this.queues[this.highest_priority!];
			const element = queue.elements[queue.head];
			this.resolve(element);
			delete queue.elements[queue.head];
			queue.head++;

			if (queue.head == queue.tail) {
				delete this.queues[this.highest_priority!]; //delete empty queue
				this.highest_priority = this.getHighestPriority();
			}
		}
	}

	private getHighestPriority() {
		let highest_priority: number | undefined = undefined;
		const priorities = Object.keys(this.queues);
		for (let string_p of priorities) {
			const p = Number(string_p);
			const queue = this.queues[p];

			if (queue.head == queue.tail) {
				delete this.queues[p]; //delete empty queue
				continue;
			}

			if (highest_priority === undefined || highest_priority < p) highest_priority = p;
		}

		return highest_priority;
	}

	/**
	 * Gets the current queue length, i.e. how many calls to `awaitTurn()` have not resolved yet.
	 */
	getLength() {
		let length = 0;
		const priorities = Object.keys(this.queues);
		for (let p of priorities) {
			const queue = this.queues[p];
			length += queue.tail - queue.head;
		}

		return length;
	}

	/**
	 * Checks whether the current queue is empty, i.e. if there are no calls to `awaitTurn()` that have not been resolved yet.
	 */
	isEmpty() {
		const priorities = Object.keys(this.queues);
		for (let p of priorities) {
			const queue = this.queues[p];
			if (queue.tail != queue.head) return false;
		}

		return true;
	}

	/**
	 * Get how many calls to `awaitTurn()` have already been resolved within the last per_seconds seconds
	 * (thus another `request_number - getUsedResolves()` calls can be made right now).
	 */
	getUsedResolves() {
		return this.used_resolves;
	}

	/**
	 * Get how long it will be until the next call to `awaitTurn()` will resolve in seconds (thus calling `awaitTurn()` in x seconds will resolve it instantly).
	 */
	getTimeTillNextResolve() {
		const times = Object.values(this.resolve_timers);
		let fastest_timeout: number | undefined = undefined;
		for (let time of times) {
			if (fastest_timeout === undefined || time < fastest_timeout) fastest_timeout = time;
		}

		const now = Date.now();
		if (!fastest_timeout || fastest_timeout <= now) return 0;
		return (fastest_timeout - now) / 1000;
	}
}
module.exports = Limiter;
