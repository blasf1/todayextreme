import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PAGE_NAME } from '../../constants/page.js';
import { theme, createStyles } from '../../styles/design-system.js';
import { useBreakpointDown } from '../../hooks/useBreakpoint.js';
// Import GitHub icon from react-icons
import { FaGithub } from 'react-icons/fa';

const styles = createStyles({
    footer: {
        backgroundColor: '#fefefe',
        borderTop: '1px solid #e5e5e5',
        padding: '20px 0',
        marginTop: theme.spacing.lg,
    },
    container: {
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    containerMobile: {
        padding: '0 10px',
    },
    links: {
        display: 'flex',
        gap: theme.spacing.lg,
        marginBottom: 10,
    },
    linksMobile: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
    },
    link: {
        color: theme.colors.textDark,
        textDecoration: 'none',
        transition: 'color 0.2s',
    },
    copyright: {
        color: theme.colors.textDark,
        fontSize: '0.9rem',
    },
});

interface HoverLinkProps {
    to?: string;
    href?: string;
    target?: string;
    rel?: string;
    children: ReactNode;
}

const HoverLink = ({ to, href, target, rel, children }: HoverLinkProps) => {
    const [isHovered, setIsHovered] = useState(false);

    const linkStyle = {
        ...styles.link,
        ...(isHovered && {
            color: '#0066cc',
            textDecoration: 'underline',
        }),
    };

    if (to) {
        return (
            <Link
                to={to}
                style={linkStyle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {children}
            </Link>
        );
    }

    return (
        <a
            href={href}
            target={target}
            rel={rel}
            style={linkStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {children}
        </a>
    );
};

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const isMobile = useBreakpointDown('mobile');

    return (
        <footer style={styles.footer}>
            <div style={{
                ...styles.container,
                ...(isMobile && styles.containerMobile),
            }}>
                <div style={{
                    ...styles.links,
                    ...(isMobile && styles.linksMobile),
                }}>
                    <HoverLink to="/">Home</HoverLink>
                    <HoverLink to="/impressum">Legal Notice</HoverLink>
                    <HoverLink
                        href="https://github.com/tsafs/itishotnow"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <FaGithub /> GitHub
                    </HoverLink>
                    {/* Add more links here as needed */}
                </div>
                <div style={styles.copyright}>
                    © {currentYear} {PAGE_NAME}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
