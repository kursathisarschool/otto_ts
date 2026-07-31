/**
 * @fileoverview Joinery catalogue and geometry planning for laser-cut edges.
 * @module models/joinery
 */

interface JointType {
    id: string;
    label: string;
    desc: string;
}

interface AlignOption {
    id: string;
    label: string;
}

interface JointProfile {
    depthScale: number;
    tooth: string;
    taperRatio?: number;
}

export interface JoineryInput {
    type?: string;
    thicknessMm?: number;
    fingerCount?: number;
    align?: string;
}

export interface JointRenderPlan {
    type: string;
    tooth: string;
    depth: number;
    count: number;
    toothWidth: number;
    taper: number;
    align: string;
    startIndex: number;
}

/**
 * The joints shown in the edge-joinery menu, in display order.
 */
export const JOINT_TYPES: JointType[] = [
    { id: 'finger_joint', label: 'Finger Joint',
        desc: 'Square interlocking tabs — the classic box joint.' },
    { id: 'dovetail', label: 'Dovetail Joint',
        desc: 'Flared tabs that resist being pulled apart.' }
];

/** Alignment options for the first tooth. */
export const ALIGN_OPTIONS: AlignOption[] = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' }
];

/** Legacy / alternate spellings mapped to a canonical JOINT_TYPES id. */
const ALIASES: Record<string, string> = {
    finger_male: 'finger_joint',
    finger_female: 'finger_joint',
    male: 'finger_joint',
    female: 'finger_joint',
    dovetail_male: 'dovetail',
    dovetail_female: 'dovetail'
};

const KNOWN_IDS = new Set(JOINT_TYPES.map(j => j.id));

/** Normalise a stored joinery type to a canonical menu id, or null if unknown. */
export function normalizeJoineryType(type: string | null | undefined): string | null {
    if (!type) return null;
    const t = String(type).toLowerCase();
    if (KNOWN_IDS.has(t)) return t;
    return ALIASES[t] || null;
}

/**
 * Per-joint drawing profile. depthScale multiplies the material-thickness
 * base depth; tooth selects the tab silhouette; taperRatio sets the
 * dovetail flare.
 */
export const JOINT_PROFILES: Record<string, JointProfile> = {
    finger_joint: { depthScale: 1.0, tooth: 'rect' },
    dovetail:     { depthScale: 1.6, tooth: 'trapezoid', taperRatio: 0.2 }
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Plan how a joint renders along an edge. Pure — no canvas, no side effects. */
export function jointRenderPlan(joinery: JoineryInput, length: number): JointRenderPlan {
    const type = normalizeJoineryType(joinery?.type) || 'finger_joint';
    const profile = JOINT_PROFILES[type];

    const thicknessMm = Number(joinery?.thicknessMm);
    const baseDepth = clamp(Number.isFinite(thicknessMm) ? thicknessMm : 0, 0.5, length * 0.45);
    const depth = Math.min(baseDepth * profile.depthScale, length * 0.6);

    const align = joinery?.align === 'right' ? 'right' : 'left';
    const startIndex = align === 'right' ? 1 : 0;

    const preferredWidth = Math.max(depth * 2, 4);
    const autoCount = Math.max(2, Math.floor(length / preferredWidth));

    const requested = Number(joinery?.fingerCount);
    const count = Number.isFinite(requested) && requested >= 2
        ? Math.floor(requested)
        : autoCount;

    const toothWidth = length / count;
    const taper = profile.tooth === 'trapezoid'
        ? Math.min(depth * (profile.taperRatio || 0.2), toothWidth * 0.2)
        : 0;

    return { type, tooth: profile.tooth, depth, count, toothWidth, taper, align, startIndex };
}