import logo from '../../public/job-hunt official text.png';
let pendingLogo: Promise<Uint8Array> | undefined;
export function loadAnalyticsLogo(): Promise<Uint8Array> {
    if (!pendingLogo)
        pendingLogo = Promise.resolve().then(async () => {
            if (!logo.width || !logo.height)
                throw new Error('Invalid logo dimensions');
            if (logo.src.startsWith('data:image/png;base64,'))
                return Uint8Array.from(atob(logo.src.split(',')[1]), character => character.charCodeAt(0));
            const response = await fetch(logo.src, { signal: AbortSignal.timeout(10000) });
            if (!response.ok)
                throw new Error('Logo request failed');
            return new Uint8Array(await response.arrayBuffer());
        }).catch(() => {
            pendingLogo = undefined;
            throw new Error('Could not load the Job Hunt logo. Please retry the PDF export.');
        });
    return pendingLogo;
}
export const analyticsLogoSize = { width: 44, height: 44 * logo.height / logo.width };
