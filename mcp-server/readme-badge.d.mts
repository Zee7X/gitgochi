export function badgeMarkdown(base: string, key: string, opts?: { size?: 'small' | 'full'; badgeKey?: string }): string;
export function insertBadge(readme: string, snippet: string, key: string): { text: string; changed: boolean; where: string };
