// Timezone utility functions for handling GMT+2 (Poland) timezone
// This ensures consistent behavior between localhost and production server

/**
 * Get current timestamp in Poland timezone (GMT+2)
 * This works regardless of server timezone settings
 */
export function getPolandTime() {
    return new Date(new Date().getTime() + (2 * 60 * 60 * 1000));
}

/**
 * Get current timestamp in Poland timezone as PostgreSQL compatible string
 * This can be used in SQL queries
 */
export function getPolandTimeSQL() {
    const now = getPolandTime();
    return now.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Convert any date to Poland timezone
 */
export function toPolandTime(date) {
    return new Date(date.getTime() + (2 * 60 * 60 * 1000));
}
