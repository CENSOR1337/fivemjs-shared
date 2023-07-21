import { WordObject } from "./WordObject";
import { Vector3 } from "./utils/Vector3";
import { Dispatcher } from "./utils/Dispatcher";
import { Tickpool } from "./TickPool";

interface listenerType {
	id: number;
	type: "enter" | "exit" | "overlapping";
}

export class Collision extends WordObject {
	public static readonly all = new Array<Collision>();
	public playersOnly: boolean = false;
	public readonly id: string;
	private interval: NodeJS.Timer;
	private insideEntities: Set<number> = new Set();
	private destroyed: boolean = false;
	private listeners = {
		enter: new Dispatcher(),
		exit: new Dispatcher(),
		overlapping: new Dispatcher(),
	};
	private tickpool = new Tickpool();
	private tickpoolIds = new Map<number, number>();

	protected constructor(id: string, pos: Vector3) {
		super(pos);
		this.id = id;
		this.interval = setInterval(this.onTick.bind(this), 300);
		Collision.all.push(this);

		this.onBeginOverlap((entity) => {
			const poolId = this.tickpool.add(() => {
				this.listeners.overlapping.broadcast(entity);
			});
			this.tickpoolIds.set(entity, poolId);
		});

		this.onEndOverlap((entity) => {
			const poolId = this.tickpoolIds.get(entity);
			if (!poolId) return;
			this.tickpool.remove(poolId);
			this.tickpoolIds.delete(entity);
		});
	}

	public onBeginOverlap(callback: (entity: number) => void): listenerType {
		const id = this.listeners.enter.add(callback);
		return { id: id, type: "enter" };
	}

	public onOverlapping(callback: (entity: number) => void): listenerType {
		const id = this.listeners.overlapping.add(callback);
		return { id: id, type: "overlapping" };
	}

	public onEndOverlap(callback: (entity: number) => void) {
		const id = this.listeners.exit.add(callback);
		return { id: id, type: "exit" };
	}

	public off(listener: listenerType) {
		const dispatcher = this.listeners[listener.type];
		if (!dispatcher) return;
		dispatcher.remove(listener.id);
	}

	public destroy() {
		this.destroyed = true;
		this.onTick();
		this.tickpool.destroy();
		const index = Collision.all.indexOf(this);
		if (index < 0) return;
		Collision.all.splice(index, 1);
	}

	private onTick() {
		if (this.destroyed) {
			clearInterval(this.interval);
			for (const handle of this.insideEntities) {
				this.listeners.exit.broadcast(handle);
			}
			this.insideEntities.clear();
			return;
		}

		const entities = this.getRevelantEntities();

		for (const handle of this.insideEntities) {
			const isValid = this.isEntityValid(handle);
			if (!isValid) {
				this.insideEntities.delete(handle);
				this.listeners.exit.broadcast(handle);
			}
		}

		for (const handle of entities) {
			if (this.insideEntities.has(handle)) continue;
			const isValid = this.isEntityValid(handle);
			if (isValid) {
				if (!this.insideEntities.has(handle)) {
					this.insideEntities.add(handle);
					this.listeners.enter.broadcast(handle);
				}
			}
		}
	}

	protected isPosInside(pos: Vector3) {
		// implement in child class
		return false;
	}

	protected isEntityInside(entity: number) {
		// implement in child class
		return false;
	}

	protected isEntityValid(entity: number) {
		if (!DoesEntityExist(entity)) return false;
		if (!this.isEntityInside(entity)) return false;
		return true;
	}

	protected getRevelantEntities(): number[] {
		// implement in child class
		return [];
	}
}
