/**
 * Geometry Library - Random
 *
 * Simple seeded random generator (LCG) with helpers.
 */

import { TAU } from './constants.js';
import { Vec } from './Vec.js';
import { seedrandom, type PRNGFunction } from './seedrandom.js';

export class RandomGenerator {
    private _rng: PRNGFunction;

    constructor(seed?: unknown) {
        this._rng = seedrandom(seed);
    }

    seed(seed?: unknown): void {
        this._rng = seedrandom(seed);
    }

    random(min?: number, max?: number): number {
        if (max === undefined) {
            max = min === undefined ? 1 : min;
            min = 0;
        } else if (min === undefined) {
            min = 0;
        }
        return min + this._rng() * (max - min);
    }

    randomInt(min?: number, max?: number): number {
        if (max === undefined) {
            max = min === undefined ? 0 : min;
            min = 0;
        } else if (min === undefined) {
            min = 0;
        }

        min = min | 0;
        max = max | 0;

        const integer = Math.abs(this._rng.int32());
        if (max > 0) {
            return min + (integer % (max - min + 1));
        }
        return integer;
    }

    randomDirection(length: number = 1): Vec {
        return new Vec(length, 0).rotateRadians(this.random(TAU));
    }

    randomPointInDisc(radius: number = 1): Vec {
        return this.randomDirection(radius * Math.sqrt(this._rng()));
    }
}

const globalRandomGenerator = new RandomGenerator();

export const _seedGlobalRandom = (seed?: unknown): void => globalRandomGenerator.seed(seed);

export const random = (min?: number, max?: number): number => globalRandomGenerator.random(min, max);
export const randomInt = (min?: number, max?: number): number => globalRandomGenerator.randomInt(min, max);
export const randomDirection = (length?: number): Vec => globalRandomGenerator.randomDirection(length);
export const randomPointInDisc = (radius?: number): Vec => globalRandomGenerator.randomPointInDisc(radius);