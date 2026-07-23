/**
 * Lightweight seedrandom-compatible PRNG (Alea algorithm).
 * Provides a function that returns numbers in [0,1) and has .int32().
 *
 * This is not the full seedrandom package, but is deterministic and
 * matches the API used by the original library.
 */

/** A function that generates [0,1) numbers, with an extra .int32() method attached. */
export interface PRNGFunction {
    (): number;
    int32(): number;
}

const mash = () => {
    let n = 0xefc8249d;
    const mashFn = (data: unknown): number => {
        data = String(data);
        for (let i = 0; i < (data as string).length; i++) {
            n += (data as string).charCodeAt(i);
            let h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 0x100000000;
        }
        return (n >>> 0) * 2.3283064365386963e-10;
    };
    return mashFn;
};

/** Create a seeded PRNG function. */
export const seedrandom = (seed: unknown): PRNGFunction => {
    const mashFn = mash();
    let s0 = mashFn(' ');
    let s1 = mashFn(' ');
    let s2 = mashFn(' ');

    s0 -= mashFn(seed);
    if (s0 < 0) s0 += 1;
    s1 -= mashFn(seed);
    if (s1 < 0) s1 += 1;
    s2 -= mashFn(seed);
    if (s2 < 0) s2 += 1;

    let c = 1;

    const prng = (() => {
        const t = 2091639 * s0 + c * 2.3283064365386963e-10;
        s0 = s1;
        s1 = s2;
        s2 = t - (c = t | 0);
        return s2;
    }) as PRNGFunction;

    prng.int32 = () => {
        return (prng() * 0x100000000) | 0;
    };

    return prng;
};