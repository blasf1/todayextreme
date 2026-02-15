import React, { memo } from 'react';
import StackedPlotView from '../../common/PlotView/StackedPlotView.js';
import StatsTop from './Top.js';
import StatsBottom from './Bottom.js';
import { StatsDarkModeContext } from './StatsDarkModeContext.js';

// Set to false for light mode, true for dark mode
const DARK_MODE = false;

const Stats = memo(() => (
    <StatsDarkModeContext.Provider value={DARK_MODE}>
        <StackedPlotView
            topContent={<StatsTop />}
            bottomContent={<StatsBottom />}
            darkMode={DARK_MODE}
        />
    </StatsDarkModeContext.Provider>
));

Stats.displayName = 'Stats';

export default Stats;
