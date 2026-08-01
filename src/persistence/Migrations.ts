/**
 * @fileoverview Scene-format migrations.
 * @module persistence/Migrations
 */

type MigrationStep = (data: any) => any;

/**
 * Version → migration step. The key is the version a payload currently has;
 * the function returns it upgraded to the NEXT version.
 */
export const MIGRATIONS: Record<string, MigrationStep> = {
    /**
     * 1.0.0 → 2.0.0: the 2.5D release. depth (default 3mm) and z
     * (default 0) became common shape properties.
     */
    '1.0.0': (data: any) => {
        data.version = '2.0.0';
        return data;
    }
};

/**
 * Upgrade a parsed scene payload to the current format by applying each
 * available migration step in sequence.
 */
export function migrate(data: any): any {
    let guard = 0;
    while (data && MIGRATIONS[data.version]) {
        data = MIGRATIONS[data.version](data);
        if (++guard > 100) {
            throw new Error('Migration loop detected; aborting');
        }
    }
    return data;
}