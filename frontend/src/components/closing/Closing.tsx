import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import PlotView from '../common/PlotView/PlotView.js';
import FlagLink from '../common/FlagLink.js';
import Link from '../common/Link.js';
import { theme, createStyles } from '../../styles/design-system.js';
import { useBreakpoint } from '../../hooks/useBreakpoint.js';

// Pure style computation functions
const getThanksStyle = (isMobile: boolean): CSSProperties => ({
    paddingLeft: isMobile ? 10 : 20,
    padding: isMobile ? '20px 10px' : undefined,
    color: theme.colors.textLight,
});

const getPartnerSitesH3Style = (isMobile: boolean): CSSProperties => ({
    marginBottom: '1.5rem',
    textAlign: isMobile ? 'center' : 'left',
});

const styles = createStyles({
    partnerSites: {
        padding: theme.spacing.md,
        color: theme.colors.textLight,
    },
    flagLinks: {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
        justifyContent: 'left',
        maxWidth: 300,
    },
    flagLink: {
        boxShadow: '0 0 20px 1px black',
    }
});

const HistoricalAnalysis = () => {
    const breakpoint = useBreakpoint();
    const isMobile = breakpoint === 'mobile';

    // Memoized computed styles
    const thanksStyle = useMemo(
        () => getThanksStyle(isMobile),
        [isMobile]
    );

    const partnerSitesH3Style = useMemo(
        () => getPartnerSitesH3Style(isMobile),
        [isMobile]
    );

    // Left side content with tabs for different content types
    const rightContent = (
        <div style={styles.partnerSites}>
            <h3 style={partnerSitesH3Style}>Related Projects</h3>
            <div style={styles.flagLinks}>
                <FlagLink
                    url="https://isithotrightnow.com"
                    flagImage="https://flagcdn.com/w320/au.png"
                    title="Australia"
                    customStyle={styles.flagLink}
                />

                <FlagLink
                    url="https://istheukhotrightnow.com"
                    flagImage="https://flagcdn.com/w320/gb.png"
                    title="UK"
                    customStyle={styles.flagLink}
                />

                <FlagLink
                    url="https://scp.geographie.rub.de/isithot/lmss"
                    title="Bochum"
                    customStyle={{
                        backgroundImage: 'none',
                        background: 'linear-gradient(to bottom, #003399 50%, white 50%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        ...styles.flagLink
                    }}
                />

                <FlagLink
                    url="https://hoyextremo.com/"
                    flagImage="https://flagcdn.com/w320/es.png"
                    title="Spain"
                    customStyle={styles.flagLink}
                />
            </div>
        </div>
    );

    // Right side content with the scatter plot
    const leftContent = (
        <div style={thanksStyle}>
            <div className="credits">
                <p>
                    Developed by <Link href="https://www.linkedin.com/in/sebastianfast/">Sebastian Fast</Link><br />
                    Inspired by <Link href="https://isithotrightnow.com">isithotrightnow.com</Link><br />
                </p>
                <p>
                    Special thanks for the inspiration and valuable contributions to<br />
                    <Link href="https://www.theurbanist.com.au/about/">Mat Lipson</Link>, {' '}
                    <Link href="https://jamesgoldie.dev/">James Goldie</Link> und {' '}
                    <Link href="https://scp.geographie.rub.de/isithot/lmss">Jonas Kittner</Link>
                </p>
            </div>

            <div className="participate">
                <p>
                    <strong>Join this project!</strong><br />
                    Ideas, suggestions, or feedback?<br />
                    Visit the <Link href="https://github.com/tsafs/itishotnow">GitHub repo</Link> or <Link href="mailto:kontakt@esistwarm.jetzt">send me a message</Link>
                </p>
            </div>
        </div>
    );

    return (
        <PlotView
            leftContent={leftContent}
            rightContent={rightContent}
            leftWidth={50}
            darkMode={true}
        />
    );
};

export default HistoricalAnalysis;
