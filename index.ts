export default class Limiter {
	private queues: {
		[key: string]: {
			//priority number
			head: number;
			tail: number;
			elements: {
				[key: string]: Function; //limiter elements
			};
		};
	};

	private used_resolves: number;
	private highest_priority: number | undefined;

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

		this.max_resolves = request_number;
		this.per_seconds = per_seconds;
	}

	/**
	 * Resolves once ready.
	 * @param priority elements with higher priority will resolve before elements with lower priority. Defaults to 0.
	 * @param timeout reject if element waits for longer than this many seconds. Defaults to 0 (never rejects).
	 */
	awaitTurn(priority = 0, timeout = 0): Promise<any> {
		return new Promise((res, rej) => {
			if (this.used_resolves < this.max_resolves) {
				this.resolve(res);
			} else {
				this.push(res, rej, priority, timeout);
			}
		});
	}

	private push(res: Function, rej: Function, priority: number, timeout: number) {
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
			setTimeout(() => {
				if (queue.elements[pos]) {
					delete queue.elements[pos];
					queue.head++;

					if (Object.keys(queue.elements).length == 0) {
						delete this.queues[priority]; //delete empty queue
						if (priority == this.highest_priority) this.highest_priority = this.getHighestPriority();
					}
					rej("Limiter timed out.");
				}
			}, timeout * 1000);
		}
	}

	private resolve(res: Function) {
		this.used_resolves += 1;
		res();

		setTimeout(() => {
			this.doNextResolve();
		}, this.per_seconds * 1000);
	}

	private doNextResolve() {
		this.used_resolves -= 1;
		if (this.getLength() != 0) {
			//resolve next highest priority element
			const queue = this.queues[this.highest_priority!];
			const element = queue.elements[queue.head];
			this.resolve(element);
			delete queue.elements[queue.head];
			queue.head++;

			if (Object.keys(queue.elements).length == 0) {
				delete this.queues[this.highest_priority!]; //delete empty queue
				this.highest_priority = this.getHighestPriority();
			}
			return;
		} else if (this.used_resolves > 0) setTimeout(() => this.doNextResolve(), this.per_seconds * 1000);
	}

	private getHighestPriority() {
		let highest_priority: number | undefined = undefined;
		const priorities = Object.keys(this.queues);
		for (let string_p of priorities) {
			const p = Number(string_p);
			const queue = this.queues[p];

			if (queue.head == queue.tail) delete this.queues[p]; //delete empty queue

			if (highest_priority === undefined || highest_priority < p) highest_priority = p;
		}

		return highest_priority;
	}

	/**
	 * Gets the current queue length, i.e. how many calls to awaitTurn() have not resolved yet.
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
	 * Get how many elements have already been resolved within the last per_seconds seconds.
	 */
	getUsedResolves() {
		return this.used_resolves;
	}
}
