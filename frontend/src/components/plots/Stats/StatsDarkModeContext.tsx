import { createContext, useContext } from 'react';

export const StatsDarkModeContext = createContext<boolean>(false);

export const useStatsDarkMode = (): boolean => {
    return useContext(StatsDarkModeContext);
};
