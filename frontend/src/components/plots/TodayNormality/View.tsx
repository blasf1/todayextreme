import { createPlotView } from '../../common/PlotView/createPlotView.js';
import TodayNormalityLeftSide from './LeftSide.js';
import TodayNormalityRightSide from './RightSide.js';

const TodayNormality = createPlotView({
    leftContent: TodayNormalityLeftSide,
    rightContent: TodayNormalityRightSide,
    config: {
        leftWidth: 0,
        title: "Is today's temperature normal?",
        titleSide: 'right',
        darkMode: false,
    },
});

export default TodayNormality;
