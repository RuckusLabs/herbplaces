import { createContext, useContext } from 'react';

export const ManagementContext = createContext(null);
export function useManagement() { return useContext(ManagementContext); }
